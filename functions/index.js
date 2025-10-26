const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

// IMPORTANT: Read environment variables directly using process.env
// These variables must be set during deployment (e.g., using a .env file or Firebase CLI)
const GMAIL_EMAIL = process.env.GMAIL_EMAIL;
const GMAIL_PASSWORD = process.env.GMAIL_PASSWORD;
const APP_ID = process.env.APP_ID || "default-app-id"; // Assuming you set APP_ID during deployment

// 1. Configure your email transporter
const transporter = nodemailer.createTransport({
  service: "gmail", // or your email provider
  auth: {
    // Read variables from process.env
    user: GMAIL_EMAIL,       
    pass: GMAIL_PASSWORD,
  },
});

// 2. Cloud Function to send reminder (with CommonJS export)
exports.sendReminder = functions.https.onCall(async (data, context) => {
  
  // *** MANUAL CORS REMOVED: Firebase automatically handles CORS for onCall functions. ***
  
  try {
    // ⚠️ SIMPLIFIED AUTHENTICATION CHECK: We rely on the client to authenticate.
    // We check for the UID, which is passed in context.auth if authenticated.
    const senderUid = context.auth?.uid;

    if (!senderUid) {
      throw new functions.https.HttpsError('unauthenticated', 'The request must include a valid authentication token.');
    }
    
    // 3. Validate input
    const { userId, amount } = data;
    if (!userId || !amount) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing userId or amount."
      );
    }
    
    // 4. Fetch the recipient user's email
    // Use the correctly loaded APP_ID from process.env
    // NOTE: This assumes user documents (containing 'email') are stored under their UID.
    const userDocRef = admin.firestore().doc(`artifacts/${APP_ID}/users/${userId}`);
    const userDocSnapshot = await userDocRef.get();
    
    // Check for the email field
    let recipientEmail = userDocSnapshot.data()?.email;
    let recipientName = userDocSnapshot.data()?.friendName || "Friend"; // Fallback name

    // If email is not found directly, check the profile subcollection (as a fallback)
    if (!recipientEmail) {
        const profileDoc = await admin.firestore().doc(`artifacts/${APP_ID}/users/${userId}/profile/data`).get();
        recipientEmail = profileDoc.data()?.email;
    }

    if (!recipientEmail || typeof recipientEmail !== "string") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `User ${userId} does not have a valid email to send reminder to. Check Firestore path.`
      );
    }
    
    // 5. Compose email
    const mailOptions = {
      // Use the securely loaded email as the sender
      from: `FairSplit Reminder <${GMAIL_EMAIL}>`,
      to: recipientEmail,
      subject: `Payment Reminder: ₹${(amount / 100).toFixed(2)}`,
      text: `Hello ${recipientName},\n\nThis is a reminder that you owe ₹${(amount / 100).toFixed(2)} to your friend.\n\nPlease make the payment at your earliest convenience.\n\nThank you,\nThe FairSplit Team`,
    };

    // 6. Send email
    await transporter.sendMail(mailOptions);

    console.log(`Reminder sent to ${recipientEmail} for ₹${(amount / 100).toFixed(2)}`);
    return { success: true, message: `Reminder sent to ${recipientEmail}` };
  } catch (error) {
    console.error("Error sending reminder:", error);
    // Ensure HttpsError is returned
    if (error.code) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", error.message);
  }
});
