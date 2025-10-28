# 💸 FairSplit: Real-time Expense Splitting with Firebase

FairSplit is a sleek, real-time expense management application built using **React** and the **Firebase** platform. It allows users to easily split bills with friends, track balances, and send automated email reminders for outstanding debts.

The application leverages **Firestore** for real-time data synchronization and **Cloud Functions** for critical backend logic, such as synchronizing expense records and sending external notifications.

---

## ✨ Core Features

* **Secure Authentication:** User management via Firebase Email/Password Auth.
* **Real-time Tracking:** Instant updates to expenses, friends lists, and invitation statuses using Firestore listeners.
* **Atomic Data Sync:** Expenses are mirrored atomically between users using **Firestore Batch Writes** to ensure balances are always consistent for both parties.
* **Settle Up:** Bulk settlement of all outstanding debts with a friend in a single, synchronized database transaction.
* **Email Reminders (Cloud Functions):** Integration with a secure, authenticated Firebase Cloud Function (`sendReminder`) to notify friends who owe you money.
* **Reciprocal Friend System:** Manages two-way friendship connections and invitation acceptance via synchronized batch writes.
* **Minimalist UI:** A clean, dark-themed, and responsive interface (using utility classes from a framework like Tailwind CSS).

---

## 🛠️ Tech Stack

* **Frontend:** React (with hooks like `useState`, `useEffect`, `useCallback`, `useMemo`), Next.js/Vite (implied by `"use client"`).
* **Backend:** Firebase (Authentication, Firestore, Cloud Functions).
* **Language:** JavaScript.
* **Styling:** Tailwind CSS (implied by class names).
* **Icons:** Lucide-React.

---

## 🚀 Setup & Installation

To run FairSplit, you need a Firebase project and a standard React environment.

### 1. Firebase Project Setup

1.  **Create Project:** Set up a new project in the [Firebase Console](https://console.firebase.google.com/).
2.  **Enable Services:**
    * Enable **Firestore** (start in production mode).
    * Enable **Authentication** (Email/Password provider).
    * Enable **Cloud Functions** (ensure you're on the Blaze plan for external calls).
3.  **Deploy Cloud Function:** You must deploy a Cloud Function named **`sendReminder`** to the `us-central1` region. This function handles the logic for fetching the friend's email and sending the reminder.
    * **Crucially,** the function must be an `onCall` type and configured with environment variables for a transactional email service (e.g., Gmail credentials or a dedicated service like SendGrid, as noted in the source code comments).

### 2. Configuration

Replace the fallback configuration within the `App.js` file with your actual project details:

```javascript
const FALLBACK_FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID", // IMPORTANT: For functions
  // ... other details
  appId: "YOUR_APP_ID", // IMPORTANT: Used for the multi-tenant data path
};
3. Local DevelopmentAssuming you are using a Node.js environment (e.g., Next.js, Vite):Bash# 1. Install dependencies
npm install firebase react react-dom lucide-react

# 2. Add Tailwind CSS (if not already set up)

# 3. Paste the provided code into your main component file (e.g., App.js or page.js)

# 4. Start the development server
npm run dev
🧠 Technical Deep DiveData Synchronization IntegrityThe two most complex operations—adding an expense and settling up—rely on Firestore Batch Writes to guarantee data integrity across both users' collections:OperationUser 1 ActionUser 2 Action (Mirror)GuaranteeAdd ExpenseCreates document in .../users/U1/expenses with split: -1000Creates document in .../users/U2/expenses with split: +1000Both documents are written or neither is, preserving balance.Settle UpQueries/updates all isSettled: false docs to true in U1's collection.Queries/updates all isSettled: false docs to true in U2's collection.All related debts are marked settled simultaneously.Cloud Function Security (Avoiding 401 Errors)The application handles authenticated calls to Cloud Functions securely:The sendReminderCore function explicitly calls await user.getIdToken(true); before invoking the function. This forces a fresh ID token, proactively preventing the common 401 Unauthenticated error that can occur when client tokens expire mid-session. The httpsCallable wrapper then uses this refreshed token for the secure API call.Firestore Data StructureData is stored within a "multi-tenant" structure scoped by appId to allow for easy segregation if the application were to scale or handle multiple environments:/artifacts/{appId}
    /public/data/invitations    (For pending friend requests)
    /users/{userId}
        /friends                (Metadata about friends: ID, email, name)
        /expenses               (Individual expense records)
🤝 ContributionThis code provides a robust base for a modern split-expense app. Feel free to use and expand upon its features, especially the synchronization logic, which is the heart of its reliability.
