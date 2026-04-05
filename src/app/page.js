"use client";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInWithCustomToken, onAuthStateChanged, 
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail
} from 'firebase/auth';
import { 
  getFirestore, doc, collection, onSnapshot, addDoc, 
  query, where, writeBatch, getDocs, setLogLevel 
} from 'firebase/firestore';
import { 
  LogIn, Plus, X, UserPlus, Send, Check, IndianRupee, Mail, Receipt, TrendingUp, TrendingDown, Users, User, ArrowLeft 
} from 'lucide-react';

setLogLevel('debug');

let db;
let auth; 
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Configuration Setup ---
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

// --- Components: Solid & Bold UI Elements ---

const Button = ({ children, className = '', variant = 'primary', onClick, disabled = false, type = 'button' }) => {
  const baseStyle = 'px-5 py-3 font-bold rounded-none transition-colors duration-200 flex items-center justify-center whitespace-nowrap focus:outline-none uppercase tracking-wide text-sm border-2';
  let variantStyle = '';
  
  switch (variant) {
    case 'primary':
      variantStyle = 'bg-emerald-400 text-black border-emerald-400 hover:bg-emerald-300 hover:border-emerald-300';
      break;
    case 'secondary':
      variantStyle = 'bg-zinc-800 text-white border-zinc-800 hover:bg-zinc-700 hover:border-zinc-700';
      break;
    case 'danger':
      variantStyle = 'bg-rose-500 text-white border-rose-500 hover:bg-rose-400 hover:border-rose-400';
      break;
    case 'outline':
      variantStyle = 'bg-transparent text-emerald-400 border-emerald-400 hover:bg-emerald-400/10';
      break;
    default:
      variantStyle = 'bg-emerald-400 text-black border-emerald-400 hover:bg-emerald-300 hover:border-emerald-300';
  }

  if (disabled) {
    variantStyle = 'bg-zinc-900 text-zinc-600 border-zinc-900 cursor-not-allowed';
  }

  return (
    <button onClick={onClick} className={`${baseStyle} ${variantStyle} ${className}`} disabled={disabled} type={type}>
      {children}
    </button>
  );
};

const Input = ({ label, id, type = 'text', value, onChange, placeholder, required = false, className = '', icon: Icon }) => (
  <div className="space-y-2">
    {label && <label htmlFor={id} className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{label}</label>}
    <div className="flex items-center bg-black px-4 py-3 border-2 border-zinc-800 focus-within:border-emerald-400 transition-colors">
      {Icon && <Icon size={20} className="text-emerald-400 mr-3 flex-shrink-0" />}
      <input
        id={id} type={type} value={value} onChange={onChange} placeholder={placeholder} required={required}
        className={`w-full bg-transparent text-white placeholder-zinc-600 outline-none border-0 focus:ring-0 font-medium ${className}`}
      />
    </div>
  </div>
);

// 🔴 UPDATED: Modal now constrained to max-height with internal scrolling
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 transition-opacity duration-300 p-4 font-sans" onClick={onClose}>
      <div className="bg-zinc-950 border-2 border-zinc-800 w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-5 border-b-2 border-zinc-800 bg-zinc-900 shrink-0">
          <h2 className="text-xl font-black text-white tracking-tight uppercase">{title}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-emerald-400 transition-colors">
            <X size={24} strokeWidth={3} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

// --- Component: Auth Flow ---

const AuthScreen = ({ authInstance }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setResetMsg(''); setLoading(true);
    const currentAuth = authInstance || auth; 
    if (!currentAuth) { setError("Auth service not ready."); setLoading(false); return; }

    try {
      if (isRegister) {
        if (password.length < 6) { setError('Password must be at least 6 characters.'); setLoading(false); return; }
        await createUserWithEmailAndPassword(currentAuth, email, password);
      } else {
        await signInWithEmailAndPassword(currentAuth, email, password);
      }
    } catch (err) {
      const errorMessage = err.message.replace('Firebase: Error ', '').replace('(auth/', ' (');
      if (errorMessage.includes('auth/email-already-in-use')) {
        setError('Email registered. Please sign in.');
        setIsRegister(false); 
      } else { setError(errorMessage); }
    } finally { setLoading(false); }
  };

  const handleGoogleSignIn = async () => {
    setError(''); setResetMsg('');
    const currentAuth = authInstance || auth; 
    if (!currentAuth) return;
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(currentAuth, provider);
    } catch (err) {
      setError(err.message.replace('Firebase: Error ', '').replace('(auth/', ' ('));
    }
  };

  const handleForgotPassword = async () => {
    setError(''); setResetMsg('');
    const currentAuth = authInstance || auth; 
    if (!email) { setError('Please enter your email above first.'); return; }
    try {
      await sendPasswordResetEmail(currentAuth, email);
      setResetMsg('Password reset sent to your email.');
    } catch (err) {
      setError(err.message.replace('Firebase: Error ', '').replace('(auth/', ' ('));
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black p-4 font-sans overflow-y-auto selection:bg-emerald-400 selection:text-black">
      <div className="w-full max-w-md bg-zinc-950 p-8 border-2 border-zinc-800 my-8">
        <div className="flex items-center justify-center mb-8">
            <div className="bg-emerald-400 text-black p-2 mr-3">
                <IndianRupee size={32} strokeWidth={3} />
            </div>
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase">FairSplit</h1>
        </div>
        
        <h2 className="text-lg font-bold text-zinc-500 text-center mb-8 uppercase tracking-widest">
          {isRegister ? 'Create an Account' : 'System Login'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input id="email" label="Email Address" type="email" placeholder="you@domain.com" value={email} onChange={(e) => setEmail(e.target.value)} required icon={Mail} />
          <div className="space-y-2">
            <Input id="password" label="Password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required icon={LogIn} />
            {!isRegister && (
              <div className="flex justify-end pt-2">
                <button type="button" onClick={handleForgotPassword} className="text-xs font-bold text-emerald-400 hover:text-emerald-300 uppercase tracking-widest transition-colors">
                  Forgot password?
                </button>
              </div>
            )}
          </div>

          {error && <div className="bg-rose-950 border-l-4 border-rose-500 text-rose-400 text-sm font-bold p-4 uppercase">{error}</div>}
          {resetMsg && <div className="bg-emerald-950 border-l-4 border-emerald-400 text-emerald-400 text-sm font-bold p-4 uppercase">{resetMsg}</div>}
          
          <Button type="submit" className="w-full h-14 mt-4 text-base" disabled={loading}>
            {loading ? 'Processing...' : (isRegister ? 'Register' : 'Authenticate')}
          </Button>
        </form>

        <div className="mt-8">
          <div className="relative flex items-center justify-center mb-8">
            <div className="border-t-2 border-zinc-800 w-full"></div>
            <span className="bg-zinc-950 px-4 text-xs font-bold text-zinc-600 uppercase tracking-widest absolute">or</span>
          </div>
          <Button variant="secondary" onClick={handleGoogleSignIn} className="w-full h-14 border-2 border-zinc-800">
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign in with Google
          </Button>
        </div>

        <p className="text-sm font-bold text-zinc-500 text-center mt-10 uppercase tracking-wider">
          {isRegister ? 'Already a user?' : "No account?"}
          <button onClick={() => { setIsRegister(!isRegister); setError(''); setResetMsg(''); }} className="text-emerald-400 hover:text-emerald-300 ml-2 underline underline-offset-4 decoration-2">
            {isRegister ? 'Log in' : 'Create one'}
          </button>
        </p>
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
    { value: 'YOU_PAID_SPLIT_EQUAL', label: 'You paid, split equally' },
    { value: 'X_PAID_SPLIT_EQUAL', label: `${friendName} paid, split equally` },
    { value: 'YOU_OWED_FULL', label: 'You paid, they owe full amount' },
    { value: 'X_OWED_FULL', label: `${friendName} paid, you owe full amount` },
  ], [friendName]);
  
  const resetForm = () => { setDescription(''); setAmount(''); setCategory('Food'); setSplitType('YOU_PAID_SPLIT_EQUAL'); setError(''); };

  const calculateSplit = (totalAmount) => {
    const numericAmount = parseFloat(totalAmount) * 100; 
    const halfAmount = Math.round(numericAmount / 2);
    let paidBy = userId; let owedToYou = 0; 
    switch (splitType) {
      case 'YOU_PAID_SPLIT_EQUAL': paidBy = userId; owedToYou = -halfAmount; break;
      case 'X_PAID_SPLIT_EQUAL': paidBy = friendId; owedToYou = halfAmount; break;
      case 'YOU_OWED_FULL': paidBy = userId; owedToYou = -numericAmount; break;
      case 'X_OWED_FULL': paidBy = friendId; owedToYou = numericAmount; break;
      default: paidBy = userId;
    }
    return { paidBy, amountInCents: numericAmount, owedToYou, splitType };
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) { setError('Amount must be greater than zero.'); return; }
    
    setLoading(true);
    const splitDetails = calculateSplit(numericAmount);
    
    const newExpense = {
      description, amount: splitDetails.amountInCents, date: new Date().toISOString().split('T')[0],
      category, friendId: friendId, userId: userId, split: splitDetails.owedToYou, paidBy: splitDetails.paidBy, isSettled: false,
    };
    
    try {
      await addExpenseToDb(newExpense); 
      resetForm(); onClose();
    } catch (err) {
      setError('Failed to save. Is the backend server running?');
    } finally { setLoading(false); }
  };

  const numericAmount = parseFloat(amount) || 0;
  const splitPreview = calculateSplit(numericAmount);
  
  let previewText = 'AWAITING AMOUNT';
  let previewColor = 'text-zinc-600';
  let previewBorder = 'border-zinc-800';
  
  if (numericAmount > 0) {
    const absSplit = formatCurrency(splitPreview.owedToYou);
    const friendNameShort = friendName.split(' ')[0]; 
    if (splitPreview.owedToYou < 0) {
      previewText = `${friendNameShort.toUpperCase()} OWES YOU ${absSplit}`;
      previewColor = 'text-emerald-400'; previewBorder = 'border-emerald-500/50';
    } else if (splitPreview.owedToYou > 0) {
      previewText = `YOU OWE ${friendNameShort.toUpperCase()} ${absSplit}`;
      previewColor = 'text-rose-400'; previewBorder = 'border-rose-500/50';
    } else {
      previewText = 'FULLY SETTLED';
    }
  }

  // 🔴 UPDATED: Tightened padding, reduced text sizes, and hid webkit spin buttons
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Log Expense">
      <form onSubmit={handleSubmit} className="space-y-5"> 
        <div className="bg-black p-5 border-2 border-zinc-800 space-y-4">
          <Input id="desc" placeholder="Item or Service" value={description} onChange={(e) => setDescription(e.target.value)} required icon={Receipt} />
          
          <div className="flex items-center justify-center py-3 border-y-2 border-zinc-900">
            <span className="text-3xl font-black text-emerald-400 mr-2">₹</span>
            <input id="amount" type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required 
              className="text-4xl font-black text-white bg-transparent border-0 focus:ring-0 w-2/3 text-center p-0 placeholder-zinc-800 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} 
              className="w-full px-4 py-2.5 bg-zinc-900 text-white font-bold uppercase border-2 border-zinc-800 focus:ring-0 focus:border-emerald-400"
            >
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
        </div>
        
        <div className="space-y-2">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Allocation</p>
          {splitOptions.map((option) => (
            <label key={option.value} className={`flex items-center space-x-3 p-3 cursor-pointer border-2 transition-colors ${splitType === option.value ? 'bg-emerald-400/10 border-emerald-400' : 'bg-black border-zinc-800 hover:border-zinc-600'}`}>
              <input type="radio" name="split-type" value={option.value} checked={splitType === option.value} onChange={() => setSplitType(option.value)}
                className="text-emerald-400 focus:ring-emerald-400 border-zinc-700 bg-black w-4 h-4 rounded-none"
              />
              <span className={`text-xs font-bold uppercase tracking-wider ${splitType === option.value ? 'text-white' : 'text-zinc-500'}`}>{option.label}</span>
            </label>
          ))}
        </div>
        
        <div className={`p-4 border-l-4 bg-black transition-colors ${previewBorder}`}>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Net Result</p>
          <p className={`text-lg font-black tracking-tight ${previewColor}`}>{previewText}</p>
        </div>

        {error && <div className="bg-rose-950 border-l-4 border-rose-500 text-rose-400 text-xs font-bold p-3 uppercase">{error}</div>}
        <Button type="submit" className="w-full h-12 text-base" disabled={loading}>{loading ? 'Saving...' : 'Confirm'}</Button>
      </form>
    </Modal>
  );
};

// --- Component: Expense Card ---

const ExpenseCard = ({ expense, userName }) => {
  const isOwed = expense.split < 0; 
  const amount = formatCurrency(expense.split);
  
  let statusText = ''; let statusColor = '';
  if (expense.isSettled) { statusText = 'SETTLED'; statusColor = 'text-zinc-600'; } 
  else if (isOwed) { statusText = `OWES ${amount}`; statusColor = 'text-emerald-400'; } 
  else { statusText = `OWE ${amount}`; statusColor = 'text-rose-400'; }

  return (
    <div className="flex justify-between items-center p-5 bg-black border-2 border-zinc-800 hover:border-emerald-400/50 transition-colors group">
      <div className="flex-1">
        <p className="font-bold text-white text-lg tracking-tight uppercase">{expense.description}</p>
        <div className="flex items-center text-xs font-bold text-zinc-500 mt-2 space-x-3 uppercase tracking-wider">
            <span className="bg-zinc-900 text-emerald-400 border border-zinc-800 px-2 py-1">{expense.category}</span>
            <span>{expense.date}</span>
        </div>
      </div>
      <div className="text-right ml-4">
        <p className={`text-sm font-black tracking-wider ${statusColor}`}>{statusText}</p>
        <p className="text-xs font-bold text-zinc-600 mt-2 uppercase">TOTAL {formatCurrency(expense.amount)}</p>
      </div>
    </div>
  );
};

// --- Component: Invitations Section ---

const InvitationCard = ({ invite, userId, userData, handleAccept }) => {
  const [loading, setLoading] = useState(false);
  const acceptInvite = async () => { setLoading(true); try { await handleAccept(invite.id, invite.senderId, invite.senderEmail, userId, userData.email); } catch(e) { setLoading(false); } }

  return (
    <div className="p-5 bg-zinc-900 border-l-4 border-emerald-400 flex justify-between items-center mb-4">
      <div className="flex-1">
        <p className="font-bold text-white tracking-widest uppercase text-xs mb-1">New Request</p>
        <p className="text-sm font-medium text-zinc-400">{invite.senderEmail}</p>
      </div>
      <Button variant="primary" className="text-xs px-6 py-2" onClick={acceptInvite} disabled={loading}>
        {loading ? '...' : 'Accept'}
      </Button>
    </div>
  );
};

// --- Component: Friend Detail View ---

const FriendDetailView = ({ friend, userId, userData, expenses, settleUp, goBack, addExpense }) => {
    const userName = getUsername(userData.email);
    const netBalance = expenses.reduce((net, exp) => { return (exp.friendId === friend.friendId && !exp.isSettled) ? net + exp.split : net; }, 0);
    
    const isOwed = netBalance < 0; const isSettled = netBalance === 0;
    const absBalance = formatCurrency(netBalance);
    const balanceMessage = isOwed ? `${friend.friendName.toUpperCase()} OWES ${absBalance}` : (isSettled ? `SETTLED UP` : `YOU OWE ${friend.friendName.toUpperCase()} ${absBalance}`);
    const balanceClass = isOwed ? 'text-emerald-400' : (isSettled ? 'text-zinc-600' : 'text-rose-400');
    
    const friendExpenses = expenses.filter(exp => exp.friendId === friend.friendId).sort((a, b) => new Date(b.date) - new Date(a.date));
    const groupedExpenses = friendExpenses.reduce((groups, expense) => {
        const monthYear = new Date(expense.date).toLocaleString('en-US', { year: 'numeric', month: 'long' });
        if (!groups[monthYear]) groups[monthYear] = [];
        groups[monthYear].push(expense);
        return groups;
    }, {});
    
    return (
        <div className="min-h-screen bg-black font-sans pb-32 text-white selection:bg-emerald-400 selection:text-black">
            <div className="bg-zinc-950 px-6 py-8 border-b-2 border-zinc-800">
                <div className="max-w-4xl mx-auto">
                    <button onClick={goBack} className="text-zinc-500 hover:text-white mb-8 flex items-center font-bold uppercase tracking-widest text-xs transition-colors">
                        <ArrowLeft size={16} className="mr-3"/> Back
                    </button>
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div className="flex items-center">
                            <div className="w-16 h-16 bg-emerald-400 text-black flex items-center justify-center text-3xl font-black mr-6 border-2 border-emerald-400">
                                {friend.friendName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h1 className="text-4xl font-black text-white mb-1 tracking-tighter uppercase">{friend.friendName}</h1>
                                <p className={`text-lg font-black tracking-widest uppercase ${balanceClass}`}>{balanceMessage}</p>
                            </div>
                        </div>
                        <Button onClick={() => settleUp(friend.friendId)} disabled={isSettled || netBalance < 0} variant={isSettled || isOwed ? 'secondary' : 'outline'} className="w-full md:w-auto h-12 px-8">
                            <Check size={18} className="mr-3"/> Mark Settled
                        </Button>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto p-6 mt-8">
                {Object.keys(groupedExpenses).length === 0 ? (
                    <div className="text-center py-20 bg-zinc-950 border-2 border-zinc-900 mt-4">
                        <Receipt size={48} className="mx-auto text-zinc-800 mb-6"/>
                        <p className="text-zinc-600 font-bold uppercase tracking-widest">No transaction history.</p>
                    </div>
                ) : (
                    Object.keys(groupedExpenses).sort((a, b) => new Date(b) - new Date(a)).map(monthYear => (
                        <div key={monthYear} className="mb-10">
                            <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-4 pl-2 border-l-4 border-emerald-400">
                                {monthYear}
                            </h3>
                            <div className="space-y-4">
                                {groupedExpenses[monthYear].map(exp => (
                                    <ExpenseCard key={exp.id} expense={{...exp, friendName: friend.friendName}} userName={userName} />
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
            
            <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black to-transparent z-40 flex justify-center">
                <Button onClick={() => addExpense(friend)} className="h-14 w-full max-w-sm shadow-2xl !bg-emerald-400 text-lg font-black tracking-widest border-2 border-emerald-400">
                    <Plus size={24} className="mr-3"/> Add Expense
                </Button>
            </div>
        </div>
    );
};

// --- Component: Dashboard Views ---

const Dashboard = ({ userId, userData, expenses, friends, invitations, addExpenseToDb, settleUp, sendInvite, handleAccept, signOutUser }) => {
  const [activeFriend, setActiveFriend] = useState(null); 
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [sending, setSending] = useState(false);

  const userName = getUsername(userData.email);

  const calculateBalance = useCallback((friendId) => { return expenses.reduce((net, exp) => { return (exp.friendId === friendId && !exp.isSettled) ? net + exp.split : net; }, 0); }, [expenses]);
  const totalBalances = useMemo(() => { return friends.map(friend => ({ ...friend, netBalance: calculateBalance(friend.friendId) })); }, [friends, calculateBalance]);
  const overallBalance = useMemo(() => { return totalBalances.reduce((total, friend) => total + friend.netBalance, 0); }, [totalBalances]);

  const handleSettleUp = (friendId) => settleUp(friendId);
  const handleAddExpense = (friend) => { setActiveFriend(friend); setIsExpenseModalOpen(true); };

  const handleSendInvite = async (e) => {
    e.preventDefault(); setInviteError(''); setInviteSuccess('');
    if (inviteEmail === userData.email) { setInviteError('Cannot invite yourself.'); return; }
    if (friends.some(f => f.friendEmail === inviteEmail)) { setInviteError('User is already connected.'); return; }
    setSending(true);
    try { await sendInvite(inviteEmail); setInviteSuccess(`Invite dispatched to ${inviteEmail}`); setInviteEmail(''); } 
    catch(err) { setInviteError("Failed to dispatch invite."); } finally { setSending(false); }
  };

  const renderOverallBalance = () => {
    const isOwed = overallBalance < 0; const absBalance = formatCurrency(overallBalance);
    let message = '0.00'; let title = 'SETTLED'; let colorClass = 'text-zinc-600';

    if (overallBalance !== 0) {
      if (isOwed) { title = 'OWED TO YOU'; message = absBalance; colorClass = 'text-emerald-400'; } 
      else { title = 'YOU OWE'; message = absBalance; colorClass = 'text-rose-400'; }
    }
    
    return (
      <div className="bg-zinc-950 p-8 border-2 border-zinc-800 mb-10 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-8">
        <div>
            <p className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-2">{title}</p>
            <p className={`text-4xl md:text-5xl font-black tracking-tighter ${colorClass}`}>{message}</p>
        </div>
        <Button onClick={() => setIsInviteModalOpen(true)} className="w-full sm:w-auto px-6" variant="outline">
            <UserPlus size={18} className="mr-3"/> Add Contact
        </Button>
      </div>
    );
  };

  if (activeFriend) {
      return (
          <>
              <FriendDetailView friend={activeFriend} userId={userId} userData={userData} expenses={expenses} settleUp={handleSettleUp} goBack={() => setActiveFriend(null)} addExpense={() => handleAddExpense(activeFriend)} />
              <AddExpenseModal userId={userId} friend={activeFriend} isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} addExpenseToDb={addExpenseToDb} />
          </>
      );
  }

  return (
    <div className="min-h-screen bg-black font-sans pb-20 text-white selection:bg-emerald-400 selection:text-black">
      <div className="bg-black border-b-2 border-zinc-800 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 h-20 flex justify-between items-center">
            <h1 className="text-xl font-black text-white flex items-center tracking-tighter uppercase">
                <div className="bg-emerald-400 text-black p-1.5 mr-3">
                    <IndianRupee size={20} strokeWidth={4}/>
                </div> 
                FairSplit
            </h1>
            <div className="flex items-center space-x-6">
                <span className="text-xs font-bold text-zinc-500 tracking-widest uppercase hidden md:block">{userName}</span>
                <button onClick={signOutUser} className="text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 uppercase tracking-widest transition-colors px-4 py-2 border-2 border-rose-600 hover:border-rose-500">Sign Out</button>
            </div>
        </div>
      </div>
      
      <div className="max-w-5xl mx-auto px-6 mt-10">
        {invitations.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-4">Pending Requests</h2>
            {invitations.map(invite => <InvitationCard key={invite.id} invite={invite} userId={userId} userData={userData} handleAccept={handleAccept} />)}
          </div>
        )}

        {renderOverallBalance()}
        
        <h2 className="text-lg font-black text-white mb-6 tracking-tight uppercase">Contacts</h2>
        <div className="grid gap-4 md:grid-cols-2">
            {totalBalances.length === 0 ? (
                <div className="col-span-full py-16 bg-zinc-950 border-2 border-zinc-900 text-center text-zinc-600">
                    <Users size={32} className="mx-auto mb-4 text-zinc-800"/>
                    <p className="font-bold tracking-widest uppercase text-xs">No contacts. Add someone above.</p>
                </div>
            ) : (
                totalBalances.map((friend) => {
                    const isOwed = friend.netBalance < 0; const isSettled = friend.netBalance === 0;
                    const absBalance = formatCurrency(friend.netBalance);
                    let balanceMessage = 'SETTLED'; let balanceClass = 'text-zinc-600 font-bold';
                    if (isOwed) { balanceMessage = `OWES ${absBalance}`; balanceClass = 'text-emerald-400 font-black'; } 
                    else if (!isSettled) { balanceMessage = `OWE ${absBalance}`; balanceClass = 'text-rose-400 font-black'; }

                    return (
                        <div key={friend.friendId} onClick={() => setActiveFriend(friend)} className="flex items-center justify-between p-6 bg-black border-2 border-zinc-800 cursor-pointer hover:border-emerald-400 transition-colors group">
                            <div className="flex items-center">
                                <div className="w-12 h-12 bg-zinc-900 text-zinc-400 group-hover:bg-emerald-400 group-hover:text-black flex items-center justify-center text-lg font-black mr-4 transition-colors">
                                    {friend.friendName.charAt(0).toUpperCase()}
                                </div>
                                <p className="font-black text-white text-base tracking-tight uppercase">{friend.friendName}</p>
                            </div>
                            <div className="text-right">
                                <p className={`text-xs tracking-widest ${balanceClass}`}>{balanceMessage}</p>
                            </div>
                        </div>
                    );
                })
            )}
        </div>
      </div>

       <Modal isOpen={isInviteModalOpen} onClose={() => { setIsInviteModalOpen(false); setInviteError(''); setInviteSuccess(''); }} title="New Contact">
            <form onSubmit={handleSendInvite} className="space-y-6">
                <Input id="invite-email" type="email" placeholder="contact@domain.com" label="User Email" value={inviteEmail} onChange={(e) => { setInviteEmail(e.target.value); setInviteSuccess(''); setInviteError(''); }} required icon={Mail} />
                {inviteError && <div className="bg-rose-950 border-l-4 border-rose-500 text-rose-400 text-xs font-bold p-3 uppercase">{inviteError}</div>}
                {inviteSuccess && <div className="bg-emerald-950 border-l-4 border-emerald-400 text-emerald-400 text-xs font-bold p-3 uppercase">{inviteSuccess}</div>}
                <Button type="submit" className="w-full h-14" disabled={!inviteEmail || sending}>{sending ? 'Sending...' : 'Send Request'}</Button>
            </form>
        </Modal>
    </div>
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
  const [authInstance, setAuthInstance] = useState(null);

  useEffect(() => {
    try {
      const app = initializeApp(firebaseConfig);
      db = getFirestore(app);
      auth = getAuth(app); 
      setAuthInstance(auth); 
      
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) { setUserId(user.uid); setIsAuthenticated(true); setUserData({ email: user.email || user.uid, uid: user.uid }); } 
        else {
          setUserId(null); setIsAuthenticated(false); setUserData({ email: null, uid: null }); setFriends([]); setExpenses([]); setInvitations([]);
        }
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (e) { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!userId || !db || !userData.email) return () => {}; 
    const friendsUnsubscribe = onSnapshot(getFriendsCollection(userId), (snapshot) => { setFriends(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); });
    const expensesUnsubscribe = onSnapshot(getExpensesCollection(userId), (snapshot) => { setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); });
    const invitesUnsubscribe = onSnapshot(query(getInvitationsCollection(), where("recipientEmail", "==", userData.email)), (snapshot) => { setInvitations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); });
    return () => { friendsUnsubscribe(); expensesUnsubscribe(); invitesUnsubscribe(); };
  }, [userId, userData.email]);

  const addExpenseToDb = async (myExpense) => {
    if (!userId) throw new Error("User not authenticated.");
    try {
        const response = await fetch('http://localhost:5000/api/expenses/add', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: myExpense.userId, friendId: myExpense.friendId, expenseData: myExpense })
        });
        if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || 'Network error'); }
    } catch (e) { throw e; }
  };

  const handleSettleUp = async (friendId) => {
      if (!userId) return;
      try {
          const myQuery = query(getExpensesCollection(userId), where("friendId", "==", friendId), where("isSettled", "==", false));
          const mySnapshot = await getDocs(myQuery);
          if (mySnapshot.empty) return;
          
          const batch = writeBatch(db);
          mySnapshot.docs.forEach((docSnap) => { batch.update(docSnap.ref, { isSettled: true }); });
          
          const friendQuery = query(getExpensesCollection(friendId), where("userId", "==", friendId), where("friendId", "==", userId), where("isSettled", "==", false));
          const friendSnapshot = await getDocs(friendQuery);
          friendSnapshot.docs.forEach((docSnap) => { batch.update(docSnap.ref, { isSettled: true }); });
          
          await batch.commit();
      } catch (error) {}
  };

  const sendInvite = async (recipientEmail) => { await addDoc(getInvitationsCollection(), { senderId: userId, senderEmail: userData.email, recipientEmail: recipientEmail, timestamp: new Date().toISOString() }); };

  const handleAcceptInvite = async (inviteDocId, senderId, senderEmail, recipientId, recipientEmail) => {
    const batch = writeBatch(db);
    batch.delete(doc(getInvitationsCollection(), inviteDocId));
    batch.set(doc(getFriendsCollection(recipientId), senderId), { friendId: senderId, friendEmail: senderEmail, friendName: getUsername(senderEmail) }, { merge: true });
    batch.set(doc(getFriendsCollection(senderId), recipientId), { friendId: recipientId, friendEmail: recipientEmail, friendName: getUsername(recipientEmail) }, { merge: true });
    await batch.commit();
  };

  const handleSignOut = async () => {
    if (auth) {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Error signing out:", error);
        }
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-black"><div className="animate-spin rounded-none h-12 w-12 border-4 border-zinc-900 border-t-emerald-400"></div></div>;

  if (!isAuthenticated || !userId) return <AuthScreen authInstance={authInstance} />;

  return (
      <Dashboard userId={userId} userData={userData} friends={friends} expenses={expenses} invitations={invitations} addExpenseToDb={addExpenseToDb} settleUp={handleSettleUp} sendInvite={sendInvite} handleAccept={handleAcceptInvite} signOutUser={handleSignOut} />
  );
}