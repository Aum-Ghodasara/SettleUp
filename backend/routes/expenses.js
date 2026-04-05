// backend/routes/expenses.js
const express = require('express');
const router = express.Router();

// CREATE: Add a new expense
router.post('/add', async (req, res) => {
    try {
        const { userId, friendId, expenseData } = req.body;
        const appId = 'default-app-id'; // Match your frontend appId
        
        // Write to user's collection
        const userExpenseRef = req.db.collection('artifacts').doc(appId)
            .collection('users').doc(userId).collection('expenses').doc();
        
        await userExpenseRef.set(expenseData);

        // Reverse the split for the friend's collection
        const friendExpenseData = {
            ...expenseData,
            split: -expenseData.split,
            userId: friendId,
            friendId: userId,
        };

        const friendExpenseRef = req.db.collection('artifacts').doc(appId)
            .collection('users').doc(friendId).collection('expenses').doc(userExpenseRef.id);
        
        await friendExpenseRef.set(friendExpenseData);

        res.status(201).json({ message: 'Expense added successfully', id: userExpenseRef.id });
    } catch (error) {
        console.error("Error adding expense:", error);
        res.status(500).json({ error: 'Failed to add expense' });
    }
});

// READ: Get overall stats for a user (Demonstrating server-side logic)
router.get('/stats/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const appId = 'default-app-id';
        
        const expensesSnapshot = await req.db.collection('artifacts').doc(appId)
            .collection('users').doc(userId).collection('expenses')
            .where('isSettled', '==', false)
            .get();

        let totalOwedToYou = 0;
        let totalYouOwe = 0;

        expensesSnapshot.forEach(doc => {
            const split = doc.data().split;
            if (split < 0) totalOwedToYou += Math.abs(split);
            if (split > 0) totalYouOwe += split;
        });

        res.status(200).json({ 
            totalOwedToYou, 
            totalYouOwe,
            netBalance: totalOwedToYou - totalYouOwe
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

module.exports = router;