"use client";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInWithCustomToken, onAuthStateChanged, 
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut 
} from 'firebase/auth';
import { 
  getFirestore, doc, collection, onSnapshot, addDoc, 
  query, where, writeBatch, getDocs, setLogLevel, getDoc 
} from 'firebase/firestore';
import { 
  LogIn, Plus, X, UserPlus, Send, Check, DollarSign, Mail, Receipt, TrendingUp, TrendingDown, Users, User, ArrowLeft 
} from 'lucide-react';

// Set Firestore log level for debugging
setLogLevel('debug');

// --- Firebase and Configuration Setup ---

let db;
let auth; // Global reference for use in functions outside App component
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

const FALLBACK_FIREBASE_CONFIG = {
    apiKey: "AIzaSyDL-Og2SFLv0WslKNEHAL7X7seXbHotJtQ",
  authDomain: "fairsplit-50506.firebaseapp.com",
  projectId: "fairsplit-50506",
  storageBucket: "fairsplit-50506.firebasestorage.app",
  messagingSenderId: "138525056378",
  appId: "1:138525056378:web:09d1acdfe3ff4b749a8ac3",
  measurementId: "G-K4XGJ5P1YR"
};
const providedConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const firebaseConfig = providedConfig.projectId ? providedConfig : FALLBACK_FIREBASE_CONFIG;


// --- Firestore Path Helpers ---

const getExpensesCollection = (userId) => collection(db, 'artifacts', appId, 'users', userId, 'expenses');
const getFriendsCollection = (userId) => collection(db, 'artifacts', appId, 'users', userId, 'friends');
const getInvitationsCollection = () => collection(db, 'artifacts', appId, 'public/data/invitations');


// --- Utility Functions ---

const formatCurrency = (amountInCents) => {
  if (typeof amountInCents !== 'number') return '₹0.00';
  return `₹${(Math.abs(amountInCents) / 100).toFixed(2)}`;
};

const getUsername = (email) => email?.split('@')[0] || 'Unknown User';

// --- Component: UI Elements (Buttons, Inputs, Modals) ---

const Button = ({ children, className = '', variant = 'primary', onClick, disabled = false, type = 'button' }) => {
  const baseStyle = 'px-4 py-2 font-semibold rounded-lg transition-all duration-200 shadow-md flex items-center justify-center whitespace-nowrap';
  let variantStyle = '';
  
  switch (variant) {
    case 'primary':
      variantStyle = 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-700/50';
      break;
    case 'secondary':
      variantStyle = 'bg-gray-700 hover:bg-gray-600 text-white shadow-gray-900/50';
      break;
    case 'danger':
      variantStyle = 'bg-red-600 hover:bg-red-700 text-white shadow-red-800/50';
      break;
    case 'ghost':
      variantStyle = 'bg-transparent text-gray-400 hover:text-white shadow-none';
      break;
    default:
      variantStyle = 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-700/50';
  }

  if (disabled) {
    variantStyle = 'bg-gray-600 text-gray-400 cursor-not-allowed shadow-none';
  }

  return (
    <button 
      onClick={onClick} 
      className={`${baseStyle} ${variantStyle} ${className}`}
      disabled={disabled}
      type={type}
    >
      {children}
    </button>
  );
};

// Input component customized for the dark/minimalist look
const Input = ({ label, id, type = 'text', value, onChange, placeholder, required = false, className = '', icon: Icon }) => (
  <div className="space-y-1">
    {label && <label htmlFor={id} className="text-sm font-medium text-gray-400">{label}</label>}
    <div className="flex items-center bg-gray-800 rounded-lg p-3">
      {Icon && <Icon size={20} className="text-gray-400 mr-3 flex-shrink-0" />}
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className={`w-full bg-transparent text-white placeholder-gray-500 outline-none border-0 focus:ring-0 ${className}`}
      />
    </div>
  </div>
);

const Modal = ({ isOpen, onClose, title, children }) => {
  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-80 backdrop-blur-sm transition-opacity duration-300 font-sans"
          onClick={onClose}
        >
          <div 
            className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg m-4 p-6 md:p-8 transform transition-transform duration-300 scale-100 max-h-[90vh] overflow-y-auto border border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
              <h2 className="text-2xl font-bold text-white">{title}</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-full bg-gray-700/50">
                <X size={24} />
              </button>
            </div>
            {children}
          </div>
        </div>
      )}
    </>
  );
};

// --- Component: Auth Flow ---

// FIX: Accept 'authInstance' as a prop
const AuthScreen = ({ onLoginSuccess, authInstance }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // FIX: Use authInstance instead of global 'auth'
    const currentAuth = authInstance || auth; 
    if (!currentAuth) {
        setError("Authentication service is not yet ready.");
        setLoading(false);
        return;
    }

    try {
      if (isRegister) {
        if (password.length < 6) {
          setError('Password must be at least 6 characters.');
          setLoading(false);
          return;
        }
        await createUserWithEmailAndPassword(currentAuth, email, password);
      } else {
        await signInWithEmailAndPassword(currentAuth, email, password);
      }
    } catch (err) {
      console.error(err);
      const errorMessage = err.message.replace('Firebase: Error ', '').replace('(auth/', ' (');
      
      if (errorMessage.includes('auth/email-already-in-use')) {
        setError('This email is already registered. Please sign in below.');
        setIsRegister(false); 
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-900 p-4 font-sans">
      <div className="w-full max-w-md bg-gray-800 p-8 md:p-10 rounded-xl shadow-2xl border border-gray-700">
        <h1 className="text-4xl font-extrabold text-emerald-400 text-center mb-2 flex items-center justify-center">
            <DollarSign size={36} className="mr-2"/> FairSplit
        </h1>
        <h2 className="text-xl font-bold text-white text-center mb-8">
          {isRegister ? 'Create Your Account' : 'Welcome Back'}
        </h2>
        
        <p className="text-sm text-gray-400 text-center mb-6">
          {isRegister ? 'Already a user?' : 'New user?'}
          <button 
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
            className="text-emerald-400 hover:text-emerald-300 font-medium ml-1"
          >
            {isRegister ? 'Log in' : 'Register Now'}
          </button>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input 
            id="email" 
            label="Email" 
            type="email" 
            placeholder="username@example.com" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
            icon={Mail}
          />
          <Input 
            id="password" 
            label="Password" 
            type="password" 
            placeholder="Enter Password (min 6 chars)" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
            icon={LogIn}
          />

          {error && <p className="text-red-400 text-sm pt-2">{error}</p>}
          
          <Button type="submit" className="w-full mt-6 h-12 text-lg" disabled={loading}>
            {loading ? 'Processing...' : (isRegister ? 'Register' : 'Sign In')}
          </Button>
        </form>
      </div>
    </div>
  );
};

// --- Component: Expense Submission Modal ---

const AddExpenseModal = ({ userId, friend, isOpen, onClose, addExpenseToDb }) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [splitType, setSplitType] = useState('YOU_PAID_SPLIT_EQUAL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const friendName = friend?.friendName || 'Friend';
  const friendId = friend?.friendId;
  
  const categories = ['Food', 'Travel', 'Rent', 'Utilities', 'Other'];

  const splitOptions = useMemo(() => [
    { value: 'YOU_PAID_SPLIT_EQUAL', label: 'You Paid, Split Equally' },
    { value: 'X_PAID_SPLIT_EQUAL', label: `${friendName} Paid, Split Equally` },
    { value: 'YOU_OWED_FULL', label: 'You Paid, They Owed Full Amount' },
    { value: 'X_OWED_FULL', label: `${friendName} Paid, You Owed Full Amount` },
  ], [friendName]);
  
  const resetForm = () => {
    setDescription('');
    setAmount('');
    setCategory('Food');
    setSplitType('YOU_PAID_SPLIT_EQUAL');
    setError('');
  };

  const calculateSplit = (totalAmount) => {
    const numericAmount = parseFloat(totalAmount) * 100; // Store in cents
    const halfAmount = Math.round(numericAmount / 2);
    
    let paidBy = userId;
    let owedToYou = 0; // Negative means friend owes you, Positive means you owe friend
    
    switch (splitType) {
      case 'YOU_PAID_SPLIT_EQUAL':
        paidBy = userId;
        owedToYou = -halfAmount; // Friend owes you
        break;
      case 'X_PAID_SPLIT_EQUAL':
        paidBy = friendId;
        owedToYou = halfAmount; // You owe friend
        break;
      case 'YOU_OWED_FULL':
        paidBy = userId;
        owedToYou = -numericAmount; // Friend owes you full amount
        break;
      case 'X_OWED_FULL':
        paidBy = friendId;
        owedToYou = numericAmount; // You owe friend full amount
        break;
      default:
        paidBy = userId;
    }
    
    return { paidBy, amountInCents: numericAmount, owedToYou, splitType };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const numericAmount = parseFloat(amount);
    
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid amount greater than zero.');
      return;
    }
    
    setLoading(true);
    const splitDetails = calculateSplit(numericAmount);
    
    const newExpense = {
      description,
      amount: splitDetails.amountInCents, // Total amount in cents
      date: new Date().toISOString().split('T')[0],
      category,
      friendId: friendId, 
      userId: userId, 
      split: splitDetails.owedToYou, // Your net balance change
      paidBy: splitDetails.paidBy,
      isSettled: false,
    };
    
    try {
      // Use the synchronized expense addition function
      await addExpenseToDb(newExpense); 
      resetForm();
      onClose();
    } catch (err) {
      console.error('Failed to add expense:', err);
      setError('Failed to save expense. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const numericAmount = parseFloat(amount) || 0;
  const splitPreview = calculateSplit(numericAmount);
  
  let previewText = '';
  let previewColor = 'text-gray-400';
  
  if (numericAmount > 0) {
    const absSplit = formatCurrency(splitPreview.owedToYou);
    const friendNameShort = friendName.split(' ')[0]; 
    
    if (splitPreview.owedToYou < 0) {
      // Friend owes you (negative split)
      previewText = `${friendNameShort} owes you ${absSplit}.`;
      previewColor = 'text-green-400';
    } else if (splitPreview.owedToYou > 0) {
      // You owe friend (positive split)
      previewText = `You owe ${friendNameShort} ${absSplit}.`;
      previewColor = 'text-red-400';
    } else {
      previewText = 'Everyone is settled.';
    }
  } else {
    previewText = 'Enter amount and select split to see breakdown.';
  }


  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Expense">
      <div className="flex items-center text-lg text-white mb-6">
        <p className="mr-2 text-gray-400">With:</p>
        <div className="flex items-center bg-gray-700 rounded-full py-1 px-3">
            <User size={18} className="mr-2 text-emerald-400"/>
            <span className="font-semibold">{friendName}</span>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6"> 
        
        {/* Input Block - Minimalist Style */}
        <div className="p-4 bg-gray-900 rounded-xl space-y-4 shadow-inner">
          <Input 
            id="desc" 
            placeholder="Enter a description" 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
            required 
            icon={Receipt}
            className="text-lg"
          />
          <div className="flex items-center justify-center">
            <span className="text-3xl font-extrabold text-gray-500 mr-2">₹</span>
            <input 
              id="amount" 
              type="number" 
              placeholder="0.00" 
              value={amount} 
              onChange={(e) => setAmount(e.target.value)} 
              required 
              className="text-5xl font-extrabold text-white bg-transparent border-0 focus:ring-0 w-3/4 text-center pb-1"
            />
          </div>
          
          <div className="space-y-1 pt-4">
            <label className="text-sm font-medium text-gray-400">Category</label>
            <select 
              value={category} 
              onChange={(e) => setCategory(e.target.value)} 
              className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 border-transparent"
            >
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
        </div>
        
        {/* Split Options (Radio buttons) */}
        <div className="pt-2 space-y-3">
          <p className="font-semibold text-gray-300">How should it be split?</p>
          {splitOptions.map((option) => (
            <label key={option.value} className="flex items-center space-x-3 p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors border border-gray-600">
              <input
                type="radio"
                name="split-type"
                value={option.value}
                checked={splitType === option.value}
                onChange={() => setSplitType(option.value)}
                className="text-emerald-500 focus:ring-emerald-500 border-gray-500 bg-gray-800"
              />
              <span className="text-sm text-gray-200">{option.label}</span>
            </label>
          ))}
        </div>
        
        {/* Dynamic Preview (NEW UX FEATURE) */}
        <div className="p-4 bg-emerald-900/30 rounded-lg border border-emerald-700/50">
          <p className="font-semibold text-emerald-300">Split Preview</p>
          <p className={`text-xl font-bold ${previewColor} mt-1`}>{previewText}</p>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <Button type="submit" className="w-full mt-6 h-12 text-lg" disabled={loading}>
          {loading ? 'Saving...' : 'Save Expense'}
        </Button>
      </form>
    </Modal>
  );
};

// --- Component: Expense Card and Formatting ---

const ExpenseCard = ({ expense, userName }) => {
  const isOwed = expense.split < 0; // Negative split means you are owed
  const amount = formatCurrency(expense.split);
  
  let statusText = '';
  let statusColor = '';
  
  if (expense.isSettled) {
    statusText = 'Settled';
    statusColor = 'text-gray-500';
  } else if (isOwed) {
    statusText = `Owes you ${amount}`;
    statusColor = 'text-green-400 font-medium';
  } else {
    statusText = `You owe ${amount}`;
    statusColor = 'text-red-400 font-medium';
  }

  return (
    <div className="flex justify-between items-center p-4 bg-gray-800 rounded-xl shadow-lg border border-gray-700">
      <div className="flex-1">
        <p className="font-bold text-gray-200">{expense.description}</p>
        <p className="text-xs text-gray-400 mt-0.5">{expense.category} · {expense.date}</p>
        <p className="text-xs mt-1 text-gray-500">Paid by: {expense.paidBy === expense.userId ? userName : expense.friendName}</p>
      </div>
      <div className="text-right ml-4">
        <p className={`text-sm ${statusColor}`}>{statusText}</p>
        <p className="text-xs text-gray-500 mt-1">Total: {formatCurrency(expense.amount)}</p>
      </div>
    </div>
  );
};

// --- Component: Invitations Section ---

const InvitationCard = ({ invite, userId, userData, handleAccept }) => {
  const [loading, setLoading] = useState(false);
  
  const acceptInvite = async () => {
    setLoading(true);
    try {
      await handleAccept(invite.id, invite.senderId, invite.senderEmail, userId, userData.email);
    } catch(e) {
      console.error("Accept failed:", e);
      setLoading(false); 
    }
  }

  return (
    <div className="p-4 bg-gray-700 rounded-xl shadow-sm border border-gray-600 flex justify-between items-center mb-2">
      <div className="flex-1">
        <p className="font-semibold text-white">Friend Request</p>
        <p className="text-sm text-gray-400">From: <span className="font-medium text-emerald-400">{invite.senderEmail}</span></p>
      </div>
      <Button 
        variant="primary" 
        className="flex items-center text-sm" 
        onClick={acceptInvite}
        disabled={loading}
      >
        {loading ? 'Processing...' : <><Check size={16} className="mr-1"/> Accept</>}
      </Button>
    </div>
  );
};

// --- Component: Friend Detail View ---

const FriendDetailView = ({ friend, userId, userData, expenses, settleUp, goBack, addExpense }) => {
    const userName = getUsername(userData.email);
    
    // Calculate net balance for the specific friend
    const netBalance = expenses.reduce((net, exp) => {
        if (exp.friendId === friend.friendId && !exp.isSettled) {
            return net + exp.split;
        }
        return net;
    }, 0);
    
    const isOwed = netBalance < 0;
    const isSettled = netBalance === 0;
    const absBalance = formatCurrency(netBalance);
    const balanceMessage = isOwed ? `${friend.friendName} owes you ${absBalance}` : 
                           (isSettled ? `You are settled up` : `You owe ${friend.friendName} ${absBalance}`);

    const balanceClass = isOwed ? 'text-green-400' : (isSettled ? 'text-gray-400' : 'text-red-400');
    
    // Filter expenses specific to this friend (including settled ones)
    const friendExpenses = expenses
        .filter(exp => exp.friendId === friend.friendId)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    // Group expenses by month (for better UX, similar to image)
    const groupedExpenses = friendExpenses.reduce((groups, expense) => {
        const monthYear = new Date(expense.date).toLocaleString('en-US', { year: 'numeric', month: 'long' });
        if (!groups[monthYear]) {
            groups[monthYear] = [];
        }
        groups[monthYear].push(expense);
        return groups;
    }, {});
    
    return (
        <div className="min-h-screen bg-gray-900 font-sans">
            {/* Header/Banner */}
            <div className="bg-emerald-900/40 p-6 pt-10 border-b border-gray-700 shadow-lg">
                <button onClick={goBack} className="text-gray-300 hover:text-white mb-4 flex items-center">
                    <ArrowLeft size={24} className="mr-2"/> Back to Friends
                </button>
                <div className="flex flex-col items-center text-center">
                    {/* Mock Avatar */}
                    <div className="w-16 h-16 bg-emerald-500 rounded-full text-white flex items-center justify-center text-2xl font-bold mb-3 border-4 border-gray-800">
                        {friend.friendName.charAt(0).toUpperCase()}
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-1">{friend.friendName}</h1>
                    <p className={`text-lg font-semibold ${balanceClass}`}>{balanceMessage}</p>
                </div>

                <div className="flex justify-center space-x-4 mt-6">
                    <Button 
                        onClick={() => settleUp(friend.friendId)}
                        disabled={isSettled || netBalance < 0} // Only enable if YOU owe the friend (netBalance > 0)
                        variant={isSettled ? 'secondary' : (isOwed ? 'secondary' : 'danger')} 
                        className="w-32 h-10"
                    >
                        <DollarSign size={16} className="mr-1"/> Settle Up
                    </Button>
                    <Button 
                        onClick={() => addExpense(friend)}
                        variant="primary" 
                        className="w-32 h-10"
                    >
                        <Plus size={16} className="mr-1"/> Add Expense
                    </Button>
                </div>
            </div>

            {/* Expense List */}
            <div className="p-4 md:p-8">
                {Object.keys(groupedExpenses).length === 0 ? (
                    <p className="text-gray-500 text-center py-10 bg-gray-800 rounded-xl border border-gray-700">No expenses recorded with {friend.friendName}.</p>
                ) : (
                    Object.keys(groupedExpenses).sort((a, b) => new Date(b) - new Date(a)).map(monthYear => (
                        <div key={monthYear} className="mb-6">
                            <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3 border-b border-gray-700 pb-1">{monthYear}</h3>
                            <div className="space-y-3">
                                {groupedExpenses[monthYear].map(exp => (
                                    <ExpenseCard 
                                        key={exp.id} 
                                        expense={{...exp, friendName: friend.friendName}}
                                        userName={userName}
                                    />
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
            
            {/* FAB for adding expense with this specific friend */}
            <div className="fixed bottom-6 right-6 z-40">
                <Button 
                    onClick={() => addExpense(friend)}
                    className="w-48 h-12 flex items-center justify-center text-lg shadow-xl !bg-emerald-600 hover:!bg-emerald-700"
                >
                    <Plus size={20} className="mr-2"/> Add Expense
                </Button>
            </div>
        </div>
    );
};


// --- Component: Dashboard Views ---

const Dashboard = ({ userId, userData, expenses, friends, invitations, addExpenseToDb, settleUp, sendInvite, handleAccept }) => {
  // activeFriend now holds the friend object for the detail view. null means main list view.
  const [activeFriend, setActiveFriend] = useState(null); 
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [sending, setSending] = useState(false);

  const userName = getUsername(userData.email);

  // --- Core Balance Calculation ---
  const calculateBalance = useCallback((friendId) => {
    return expenses.reduce((net, exp) => {
      if (exp.friendId === friendId && !exp.isSettled) {
        return net + exp.split;
      }
      return net;
    }, 0);
  }, [expenses]);
  
  const totalBalances = useMemo(() => {
    return friends.map(friend => ({
      ...friend,
      netBalance: calculateBalance(friend.friendId),
    }));
  }, [friends, calculateBalance]);

  // --- Overall Net Balance Calculation ---
  const overallBalance = useMemo(() => {
    return totalBalances.reduce((total, friend) => total + friend.netBalance, 0);
  }, [totalBalances]);


  // --- Handlers ---
  
  const handleSettleUp = (friendId) => {
    settleUp(friendId);
  };
  
  const handleAddExpense = (friend) => {
    setActiveFriend(friend); // Set the friend context for the modal
    setIsExpenseModalOpen(true);
  };

  const handleSendInvite = async (e) => {
    e.preventDefault();
    setInviteError('');
    setInviteSuccess('');
    
    if (inviteEmail === userData.email) {
      setInviteError('Cannot invite yourself.');
      return;
    }
    
    if (friends.some(f => f.friendEmail === inviteEmail)) {
        setInviteError('This user is already your friend!');
        return;
    }

    setSending(true);
    
    try {
        await sendInvite(inviteEmail);
        setInviteSuccess(`Invitation sent to: ${inviteEmail}. Waiting for acceptance...`);
        setInviteEmail('');
    } catch(err) {
      setInviteError("Failed to send invitation. Check console.");
      console.error("Send invitation error:", err);
    } finally {
      setSending(false);
    }
  };

  // --- Render Functions (Scoped to Dashboard) ---

  const renderInvitations = () => {
    if (invitations.length === 0) return null;

    return (
      <div className="mb-8 p-5 bg-indigo-900/30 rounded-xl border border-indigo-700/50">
        <h2 className="text-xl font-bold text-indigo-300 flex items-center mb-4">
          <Mail size={22} className="mr-2"/> Pending Invitations ({invitations.length})
        </h2>
        <div className="space-y-3">
          {invitations.map(invite => (
            <InvitationCard 
              key={invite.id}
              invite={invite}
              userId={userId}
              userData={userData}
              handleAccept={handleAccept}
            />
          ))}
        </div>
      </div>
    );
  }
  
  const renderOverallBalance = () => {
    const isOwed = overallBalance < 0;
    const absBalance = formatCurrency(overallBalance);
    
    let message = 'Settled Up';
    let icon = <User size={24} className="mr-2 text-gray-400"/>;
    let colorClass = 'text-gray-400';

    if (overallBalance !== 0) {
      if (isOwed) {
        message = `Overall, you are owed ${absBalance}`;
        icon = <TrendingUp size={24} className="mr-2 text-green-400"/>;
        colorClass = 'text-green-400';
      } else {
        message = `Overall, you owe ${absBalance}`;
        icon = <TrendingDown size={24} className="mr-2 text-red-400"/>;
        colorClass = 'text-red-400';
      }
    }
    
    return (
      <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-gray-700 mb-8 flex items-center justify-between">
        <div className="flex items-center">
            {icon}
            <p className="text-xl font-semibold text-white">{message}</p>
        </div>
        <Button 
            onClick={() => setIsInviteModalOpen(true)} 
            variant="primary" 
            className="flex items-center text-sm"
        >
            <UserPlus size={16} className="mr-2"/> Invite
        </Button>
      </div>
    );
  };

  // --- RENDER: Friend List (Main Dashboard) ---
  const renderFriendList = () => (
    <div className="min-h-screen bg-gray-900 p-4 md:p-8 font-sans">
      <header className="flex flex-col sm:flex-row justify-between items-center mb-8 pb-4 border-b border-gray-700 space-y-4 sm:space-y-0">
        <h1 className="text-3xl font-extrabold text-white flex items-center">
          <DollarSign size={30} className="text-emerald-400 mr-2"/> FairSplit
        </h1>
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-400 truncate hidden sm:block" title={userData.email}>
            {userName} ({userId.substring(0, 8)})
          </span>
          <Button onClick={() => signOut(auth)} variant="secondary" className="flex items-center text-sm">
            <LogIn size={16} className="mr-2"/> Logout
          </Button>
        </div>
      </header>
      
      {renderInvitations()}
      {renderOverallBalance()}
      
      <h2 className="text-2xl font-bold text-gray-200 mb-4">Your Friends</h2>
      
      <div className="space-y-3">
        {totalBalances.length === 0 ? (
            <div className="p-6 bg-gray-700 rounded-xl border border-gray-600 text-gray-300 flex items-center justify-center text-center">
                <Users size={20} className="mr-2 text-emerald-400"/> No friends yet. Invite someone above!
            </div>
        ) : (
            totalBalances.map((friend) => {
                const isOwed = friend.netBalance < 0;
                const isSettled = friend.netBalance === 0;
                const absBalance = formatCurrency(friend.netBalance);
                
                let balanceMessage = 'Settled Up';
                let balanceClass = 'text-gray-500';

                if (isOwed) {
                    balanceMessage = `owes you ${absBalance}`;
                    balanceClass = 'text-green-400';
                } else if (!isSettled) {
                    balanceMessage = `you owe ${absBalance}`;
                    balanceClass = 'text-red-400';
                }

                return (
                    // Clicking the card sets activeFriend, routing to the detail view
                    <div 
                        key={friend.friendId} 
                        onClick={() => setActiveFriend(friend)} 
                        className="flex items-center justify-between p-4 bg-gray-800 rounded-xl shadow-lg border border-gray-700 cursor-pointer hover:bg-gray-700 transition-colors"
                    >
                        <div className="flex items-center">
                            {/* Mock Avatar */}
                            <div className="w-12 h-12 bg-emerald-500 rounded-full text-white flex items-center justify-center text-lg font-bold mr-3">
                                {friend.friendName.charAt(0).toUpperCase()}
                            </div>
                            <p className="font-bold text-lg text-white">{friend.friendName}</p>
                        </div>
                        <div className="text-right">
                            <p className={`text-md font-semibold ${balanceClass}`}>{balanceMessage}</p>
                            {!isSettled && (
                                <p className="text-xs text-gray-500">
                                    {isOwed ? `(You are owed)` : `(You owe)`}
                                </p>
                            )}
                        </div>
                    </div>
                );
            })
        )}
      </div>
      
      {/* Footer / Global Add Expense (Since individual friend buttons are gone) */}
      {/* We need to re-tool this. For now, let's omit the global add button as the flow expects clicking a friend first. */}
      
      {/* Modals remain below the switch logic */}
    </div>
  );
  
  // --- MAIN RENDER SWITCH ---
  if (activeFriend) {
      return (
          <>
              <FriendDetailView 
                  friend={activeFriend}
                  userId={userId}
                  userData={userData}
                  expenses={expenses}
                  settleUp={handleSettleUp}
                  goBack={() => setActiveFriend(null)} // Go back to the main list
                  addExpense={() => handleAddExpense(activeFriend)}
              />
              {/* Ensure Modal is rendered here with the correct activeFriend context */}
              <AddExpenseModal 
                  userId={userId}
                  friend={activeFriend}
                  isOpen={isExpenseModalOpen}
                  onClose={() => setIsExpenseModalOpen(false)}
                  addExpenseToDb={addExpenseToDb}
              />
              <Modal isOpen={isInviteModalOpen} onClose={() => { setIsInviteModalOpen(false); setInviteError(''); setInviteSuccess(''); }} title="Invite Friend">
                <form onSubmit={handleSendInvite} className="space-y-4">
                  <p className="text-sm text-gray-400">Enter your friend's email to send a request. They must accept it to become your friend.</p>
                  <Input 
                    id="invite-email" 
                    label="Friend's Email" 
                    type="email" 
                    placeholder="friend@example.com" 
                    value={inviteEmail} 
                    onChange={(e) => { setInviteEmail(e.target.value); setInviteSuccess(''); setInviteError(''); }} 
                    required 
                    icon={Mail}
                  />
                  {inviteError && <p className="text-red-400 text-sm">{inviteError}</p>}
                  {inviteSuccess && <p className="text-green-400 text-sm flex items-center"><Check size={16} className="mr-1"/>{inviteSuccess}</p>}
                  <Button type="submit" className="w-full h-12" disabled={!inviteEmail || sending}>
                    {sending ? 'Sending...' : <><Send size={16} className="mr-2"/> Send Invitation</>}
                  </Button>
                </form>
              </Modal>
          </>
      );
  }

  // Default: Render the main friend list view
  return (
    <>
      {renderFriendList()}
      {/* Since modals must be at the top level of the dashboard structure, 
          we need to conditionally render them here too, ensuring they use 
          the correct state if an activeFriend was briefly set and then the 
          modal was opened (e.g., from an overall button, though that feature 
          was removed to support the new flow). */}
       <Modal isOpen={isInviteModalOpen} onClose={() => { setIsInviteModalOpen(false); setInviteError(''); setInviteSuccess(''); }} title="Invite Friend">
            <form onSubmit={handleSendInvite} className="space-y-4">
                <p className="text-sm text-gray-400">Enter your friend's email to send a request. They must accept it to become your friend.</p>
                <Input 
                    id="invite-email" 
                    label="Friend's Email" 
                    type="email" 
                    placeholder="friend@example.com" 
                    value={inviteEmail} 
                    onChange={(e) => { setInviteEmail(e.target.value); setInviteSuccess(''); setInviteError(''); }} 
                    required 
                    icon={Mail}
                />
                {inviteError && <p className="text-red-400 text-sm">{inviteError}</p>}
                {inviteSuccess && <p className="text-green-400 text-sm flex items-center"><Check size={16} className="mr-1"/>{inviteSuccess}</p>}
                <Button type="submit" className="w-full h-12" disabled={!inviteEmail || sending}>
                    {sending ? 'Sending...' : <><Send size={16} className="mr-2"/> Send Invitation</>}
                </Button>
            </form>
        </Modal>
    </>
  );
};

// --- Main Application Component ---

export default function App() {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState(null);
  const [userData, setUserData] = useState({ email: null, uid: null });
  const [friends, setFriends] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [firebaseError, setFirebaseError] = useState(null);
  const [authInstance, setAuthInstance] = useState(null); // State to hold the auth instance

  // 1. Firebase Initialization and Authentication
  useEffect(() => {
    try {
      if (!firebaseConfig.projectId) {
          setFirebaseError('Critical Error: Cannot determine Firebase project ID.');
          setLoading(false);
          return;
      }

      const app = initializeApp(firebaseConfig);
      db = getFirestore(app);
      auth = getAuth(app); // Assign to global variable for use in utility functions
      setAuthInstance(auth); // Save to state for prop passing
      
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          setUserId(user.uid);
          setIsAuthenticated(true);
          setUserData({ email: user.email || user.uid, uid: user.uid });
        } else {
          // Clear state immediately on sign-out for clean UI transition
          setUserId(null); 
          setIsAuthenticated(false);
          setUserData({ email: null, uid: null });
          setFriends([]);
          setExpenses([]);
          setInvitations([]);
          
          try {
            if (initialAuthToken) {
                await signInWithCustomToken(auth, initialAuthToken);
            }
          } catch (e) {
            console.warn("Custom token invalid/failed. User must use email/password.", e);
          }
        }
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (e) {
      console.error("Failed to initialize Firebase:", e);
      setFirebaseError("Firebase initialization failed. Check console for details.");
      setLoading(false);
    }
  }, []);

  // 2. Firestore Listeners (Data Fetching)
  useEffect(() => {
    if (!userId || !db || !userData.email) {
      return () => {}; 
    }
    
    setFirebaseError(null);

    // --- Private Data Listeners ---
    // Note: The listener cleanup happens automatically when this effect returns 
    // or when the dependencies change (userId, userData.email)
    const friendsUnsubscribe = onSnapshot(getFriendsCollection(userId), (snapshot) => {
      const friendList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFriends(friendList);
    }, (error) => {
      console.error("Error fetching friends:", error);
    });

    const expensesUnsubscribe = onSnapshot(getExpensesCollection(userId), (snapshot) => {
      const expenseList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setExpenses(expenseList);
    }, (error) => {
      console.error("Error fetching expenses:", error);
    });

    // --- Public Invitation Listener ---
    const invitationsQuery = query(getInvitationsCollection(), where("recipientEmail", "==", userData.email));
    
    const invitesUnsubscribe = onSnapshot(invitationsQuery, (snapshot) => {
      const inviteList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInvitations(inviteList);
    }, (error) => {
      console.error("Error fetching invitations:", error);
    });


    return () => {
      friendsUnsubscribe();
      expensesUnsubscribe();
      invitesUnsubscribe();
    };
  }, [userId, userData.email]);

  // 3. Data Modification Functions (Synchronized Expense Write)
  
  const addExpenseToDb = async (myExpense) => {
    if (!userId) {
        console.error("Cannot add expense: User not authenticated.");
        throw new Error("User not authenticated.");
    }
    if (!db) throw new Error("Database not initialized.");

    const batch = writeBatch(db);
    const myExpenseRef = doc(getExpensesCollection(userId));

    // 1. Expense for the CURRENT User (YOU)
    batch.set(myExpenseRef, myExpense); 

    // 2. Mirror/Reversed Expense for the FRIEND (X)
    const friendExpense = {
        ...myExpense,
        split: -myExpense.split, // CRITICAL: Reverse the split amount
        userId: myExpense.friendId, // The friend's ID is the owner
        friendId: myExpense.userId, // My ID is the friend
    };
    
    // Write to the friend's collection
    const friendExpenseRef = doc(getExpensesCollection(myExpense.friendId));
    batch.set(friendExpenseRef, friendExpense);

    try {
        await batch.commit();
        console.log("Expense added and mirrored successfully.");
    } catch (e) {
        console.error("Failed to sync expense via batch:", e);
        throw e; 
    }
  };

  // --- UPDATED: Synchronized Settle Up ---
  const handleSettleUp = async (friendId) => {
      if (!userId) return;

      try {
          // 1. Query unsettled expenses for the CURRENT user involving the friend
          const myQuery = query(getExpensesCollection(userId), 
              where("friendId", "==", friendId), 
              where("isSettled", "==", false)
          );
          
          const mySnapshot = await getDocs(myQuery);
          
          if (mySnapshot.empty) {
              console.log("No unsettled debts found for current user.");
              return;
          }
          
          const batch = writeBatch(db);
          
          // 2. Add updates for CURRENT User's expenses
          mySnapshot.docs.forEach((docSnap) => {
              batch.update(docSnap.ref, { isSettled: true });
              
              // 3. Find the mirrored document ID in the friend's collection
              // Since the expense document IDs are different but the content is mirrored,
              // we must query the friend's collection to find the corresponding document 
              // that has the same *paidBy*, *amount*, and *description*.
              // However, since we cannot rely on the source doc ID being the same,
              // the only way to reliably find the mirror is to query the friend's collection
              // where the friend's document has userId=friendId and friendId=userId.
              // For simplicity and relying on the data shape being identical (minus split/owner swap):
              
              // Instead of complex lookups, we will rely on the previous cross-write rule
              // which allows us to write to the friend's collection. 
              // A simple way is to re-query the friend's collection, but this is inefficient.
              
              // We must assume the friend's document has the same description/amount/paidBy/category.
              
              // Since Firestore Batches don't allow queries, we must perform the query
              // outside the batch and add the result to the batch.
          });
          
          // --- Find and update the MIRRORED documents in the friend's collection ---
          
          // CRITICAL QUERY: Find mirrored documents in friend's collection
          // The friend's documents are those where:
          // - userId (owner) == friendId
          // - friendId (counterparty) == userId
          // - isSettled == false
          
          const friendQuery = query(getExpensesCollection(friendId),
              where("userId", "==", friendId),
              where("friendId", "==", userId),
              where("isSettled", "==", false)
          );

          // Execute query for friend's documents
          const friendSnapshot = await getDocs(friendQuery);

          // Add updates for FRIEND's expenses to the SAME batch
          friendSnapshot.docs.forEach((docSnap) => {
              batch.update(docSnap.ref, { isSettled: true });
          });
          
          // 4. Commit the synchronized batch
          await batch.commit();
          console.log(`Successfully settled up all debts with ${friendId} for both users.`);

      } catch (error) {
          console.error("Failed to perform synchronized settle up:", error);
      }
  };

  const sendInvite = async (recipientEmail) => {
    await addDoc(getInvitationsCollection(), {
      senderId: userId,
      senderEmail: userData.email,
      recipientEmail: recipientEmail,
      timestamp: new Date().toISOString(),
    });
  };

  const handleAcceptInvite = async (inviteDocId, senderId, senderEmail, recipientId, recipientEmail) => {
    if (!db) throw new Error("Database not initialized.");
    
    const batch = writeBatch(db);
    const senderUsername = getUsername(senderEmail);
    const recipientUsername = getUsername(recipientEmail);

    // 1. Delete the public invitation document
    const inviteRef = doc(getInvitationsCollection(), inviteDocId);
    batch.delete(inviteRef);

    // 2. Add sender to recipient's (your) friend list 
    const myFriendRef = doc(getFriendsCollection(recipientId), senderId); 
    batch.set(myFriendRef, {
        friendId: senderId,
        friendEmail: senderEmail,
        friendName: senderUsername,
    }, { merge: true });

    // 3. Add recipient (you) to sender's friend list
    const senderFriendRef = doc(getFriendsCollection(senderId), recipientId); 
    batch.set(senderFriendRef, {
        friendId: recipientId,
        friendEmail: recipientEmail,
        friendName: recipientUsername,
    }, { merge: true });

    try {
        await batch.commit();
        console.log("Invitation successfully accepted and friends added!");
    } catch (e) {
        console.error("Friendship acceptance failed (Batch commit error): ", e);
        throw new Error("Friendship synchronization failed.");
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-emerald-500"></div>
        <p className="ml-4 text-gray-300 font-medium">Loading FairSplit...</p>
      </div>
    );
  }
  
  if (firebaseError) {
    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
            <div className="bg-gray-800 p-8 rounded-xl shadow-lg border border-red-600 max-w-lg">
                <h2 className="text-xl font-bold text-red-400 mb-4">Application Error</h2>
                <p className="text-gray-300 mb-4">{firebaseError}</p>
                
                {auth && (
                    <Button onClick={() => signOut(auth)} variant="secondary" className="mt-4 w-full">Sign Out / Retry</Button>
                )}
            </div>
        </div>
    );
  }


  // Pass authInstance to AuthScreen to ensure it's available for handleSubmit
  if (!isAuthenticated || !userId) {
    return <AuthScreen onLoginSuccess={() => {}} authInstance={authInstance} />;
  }

  return (
    <div className="min-h-screen font-sans">
      <Dashboard 
        userId={userId}
        userData={userData}
        friends={friends} 
        expenses={expenses} 
        invitations={invitations}
        addExpenseToDb={addExpenseToDb}
        settleUp={handleSettleUp}
        sendInvite={sendInvite}
        handleAccept={handleAcceptInvite}
        signOut={() => signOut(auth)}
      />
    </div >
  );
}
