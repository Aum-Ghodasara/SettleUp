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
```

3. Local DevelopmentAssuming you are using a Node.js environment (e.g., Next.js, Vite):Bash# 1. Install dependencies
npm install firebase react react-dom lucide-react

**2. Add Tailwind CSS (if not already set up)**

**3. Paste the provided code into your main component file (e.g., App.js or page.js)**

**4. Start the development server**
npm run dev

## 🧠 Technical Deep Dive

The reliability and real-time nature of **FairSplit** are built upon several key architectural decisions, focusing on **Firestore’s transactional integrity** and **robust security practices** for serverless Cloud Functions.

---

### 🔁 Data Synchronization Integrity: Atomic Operations

The most complex operations — **adding an expense** and **settling up a balance** — rely on **Firestore Batch Writes** to guarantee **atomic data integrity** across two distinct user collections.

This design ensures that every financial transaction either completes **fully for both users** or **fails entirely**, preventing mismatched balances or inconsistent states.

| Operation | User 1 Action | User 2 Action (Mirror) | Integrity Guarantee |
|------------|----------------|------------------------|---------------------|
| **Add Expense** | Creates a document in `/users/U1/expenses` with `split: -1000` | Creates a mirrored document in `/users/U2/expenses` with `split: +1000` | **Atomicity:** Both documents are written or neither is, perfectly preserving the balance. |
| **Settle Up** | Queries and updates all `isSettled: false` docs to `true` in U1’s collection | Performs the same update in U2’s collection | **Synchronization:** All related debts are marked settled simultaneously across both users. |

This dual-write approach, handled in a single batch operation, enforces strict transactional consistency while maintaining real-time updates through Firestore’s listeners.

---

### 🔐 Cloud Function Security (Avoiding 401 Errors)

**FairSplit** employs a proactive strategy to prevent the common **`401 Unauthenticated`** error that can occur when a client’s Firebase ID token expires mid-session.

The application ensures every Cloud Function call is executed with a **freshly validated token**, maintaining end-to-end trust between client and serverless backend.

#### ✅ Core Logic:

1. **Token Refresh:**  
   Before invoking a Cloud Function, the app explicitly requests a new ID token:
   ```js
   await user.getIdToken(true);
Guaranteed Authorization:
This call forces Firebase to retrieve a fresh, valid token from the server, ensuring the next operation is fully authenticated.

Secure Function Call:
The refreshed token is automatically used when invoking the callable function, e.g.:


const sendReminder = httpsCallable(functions, "sendReminder");
await sendReminder({ friendId });
This token-refresh workflow guarantees that all serverless function calls (like sendReminder) are secure, authenticated, and fail-safe, even during extended user sessions.
    /public/data/invitations    (For pending friend requests)
    /users/{userId}
        /friends                (Metadata about friends: ID, email, name)
        /expenses               (Individual expense records)

🤝 ContributionThis code provides a robust base for a modern split-expense app. Feel free to use and expand upon its features, especially the synchronization logic, which is the heart of its reliability.
