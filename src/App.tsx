
import React, { useState, useEffect, useMemo } from 'react';
import { Friend, Expense, Balance, Settlement } from './types';
import { calculateBalances, calculateSettlements } from './utils/calculations';
import { db } from './services/supabaseService';
import ExpenseForm from './components/ExpenseForm';
import Modal from './components/Modal';
import ImageCarousel from './components/ImageCarousel';
import Login from './components/Login';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'summary'>('dashboard');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasError, setHasError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<Friend | null>(null);

  const [isFriendModalOpen, setIsFriendModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
  const [editingFriendId, setEditingFriendId] = useState<string | null>(null);
  const [friendNameBuffer, setFriendNameBuffer] = useState('');
  const [resettingPinId, setResettingPinId] = useState<string | null>(null);
  const [newPinBuffer, setNewPinBuffer] = useState('');
  const [newFriendName, setNewFriendName] = useState('');
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null);

  const [carouselImages, setCarouselImages] = useState<string[]>([]);
  const [carouselInitialIndex, setCarouselInitialIndex] = useState(0);
  const [isCarouselOpen, setIsCarouselOpen] = useState(false);

  // Load initial data from Supabase
  useEffect(() => {
    const savedUser = localStorage.getItem('sinigeng_user');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        if (user.name.toLowerCase() === 'eunice') {
          user.role = 'admin';
        }
        setCurrentUser(user);
      } catch (e) {
        localStorage.removeItem('sinigeng_user');
      }
    }

    const fetchData = async () => {
      try {
        const [loadedFriends, loadedExpenses] = await Promise.all([
          db.getFriends(),
          db.getExpenses()
        ]);
        setFriends(loadedFriends);
        setExpenses(loadedExpenses);
        setHasError(null);
      } catch (err: any) {
        console.error("Failed to load data from Supabase:", err);
        setHasError(err.message || "Failed to connect to database. Please check your Supabase tables.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleLogin = (user: Friend) => {
    const updatedUser = { ...user };
    if (user.name.toLowerCase() === 'eunice') {
      updatedUser.role = 'admin';
    }
    setCurrentUser(updatedUser);
    localStorage.setItem('sinigeng_user', JSON.stringify(updatedUser));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('sinigeng_user');
  };

  const balances = useMemo(() => calculateBalances(friends, expenses), [friends, expenses]);
  const settlements = useMemo(() => calculateSettlements(friends, expenses), [friends, expenses]);

  const totalPaidOverall = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses]);
  const totalStillOwed = useMemo(() => expenses.reduce((sum, e) => {
    return sum + e.splits.reduce((sSum, s) => !s.isPaid ? sSum + s.amount : sSum, 0);
  }, 0), [expenses]);

  const analytics = useMemo(() => {
    let totalSpend = 0;
    let totalSettledValue = 0;
    const friendSpending: Record<string, number> = {};
    const friendSettled: Record<string, number> = {};

    friends.forEach(f => {
      friendSpending[f.id] = 0;
      friendSettled[f.id] = 0;
    });

    expenses.forEach(e => {
      totalSpend += e.amount;
      friendSpending[e.payerId] = (friendSpending[e.payerId] || 0) + e.amount;
      const settledPortion = e.splits.reduce((sum, s) => s.isPaid ? sum + s.amount : sum, 0);
      totalSettledValue += settledPortion;
      e.splits.forEach(s => {
        if (s.isPaid) {
          friendSettled[s.friendId] = (friendSettled[s.friendId] || 0) + s.amount;
        }
      });
    });

    const maxFriendSpend = Math.max(...Object.values(friendSpending), 1);
    const settlementProgress = totalSpend > 0 ? (totalSettledValue / totalSpend) * 100 : 0;

    return { totalSpend, totalSettledValue, settlementProgress, friendSpending, friendSettled, maxFriendSpend };
  }, [friends, expenses]);

  const addFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFriendName.trim()) return;
    setIsSyncing(true);
    try {
      const addedFriend = await db.addFriend(newFriendName.trim());
      setFriends([...friends, addedFriend]);
      setNewFriendName('');
    } catch (err) {
      alert("Error adding friend.");
    } finally {
      setIsSyncing(false);
    }
  };

  const updateFriendName = async (id: string, name: string) => {
    if (!name.trim()) return setEditingFriendId(null);
    setIsSyncing(true);
    try {
      await db.updateFriend(id, { name: name.trim() });
      setFriends(friends.map(f => f.id === id ? { ...f, name: name.trim() } : f));
      setEditingFriendId(null);
    } catch (err) {
      alert("Error updating friend.");
    } finally {
      setIsSyncing(false);
    }
  };

  const updateFriendPin = async (id: string, pin: string) => {
    if (pin.length !== 4) return alert("PIN must be 4 digits.");
    setIsSyncing(true);
    try {
      await db.updateFriend(id, { pin });
      setFriends(friends.map(f => f.id === id ? { ...f, pin } : f));
      setResettingPinId(null);
      setNewPinBuffer('');
      alert("PIN updated successfully.");
    } catch (err) {
      alert("Error updating PIN.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdatePin = async (id: string, pin: string) => {
    await db.updateFriend(id, { pin });
    setFriends(friends.map(f => f.id === id ? { ...f, pin } : f));
  };

  const deleteFriend = async (id: string) => {
    const hasActiveExpenses = expenses.some(e => e.payerId === id || e.splits.some(s => s.friendId === id && s.amount > 0));
    if (hasActiveExpenses) {
      alert("Cannot delete friend with existing expenses.");
      return;
    }
    if (!window.confirm("Remove this friend?")) return;
    
    setIsSyncing(true);
    try {
      await db.deleteFriend(id);
      setFriends(friends.filter(f => f.id !== id));
    } catch (err) {
      alert("Error deleting friend.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExpenseSubmit = async (expenseData: Partial<Expense>) => {
    if (!currentUser) return;
    setIsSyncing(true);
    try {
      if (editingExpense && editingExpense.id !== 'new') {
        const oldExp = expenses.find(e => e.id === editingExpense.id);
        const history = [...(oldExp?.history || [])];
        
        // Track changes
        const changes: string[] = [];
        if (expenseData.description && expenseData.description !== oldExp?.description) changes.push(`description to "${expenseData.description}"`);
        if (expenseData.amount !== undefined && expenseData.amount !== oldExp?.amount) changes.push(`amount to ₱${expenseData.amount}`);
        if (expenseData.payerId && expenseData.payerId !== oldExp?.payerId) {
          const newPayer = friends.find(f => f.id === expenseData.payerId)?.name;
          changes.push(`payer to ${newPayer}`);
        }
        if (expenseData.notes !== undefined && expenseData.notes !== oldExp?.notes) changes.push(`notes`);
        if (expenseData.proofOfPayment !== undefined && JSON.stringify(expenseData.proofOfPayment) !== JSON.stringify(oldExp?.proofOfPayment)) changes.push(`attachments`);

        if (changes.length > 0) {
          history.push({
            id: Math.random().toString(36).substr(2, 9),
            userId: currentUser.id,
            action: `Updated ${changes.join(', ')}`,
            timestamp: new Date().toISOString()
          });
        }

        const updates = {
          ...expenseData,
          updatedBy: currentUser.id,
          updatedAt: new Date().toISOString(),
          history
        };
        await db.updateExpense(editingExpense.id, updates);
        setExpenses(expenses.map(e => e.id === editingExpense.id ? { ...e, ...updates } as Expense : e));
      } else {
        const initialHistory = [{
          id: Math.random().toString(36).substr(2, 9),
          userId: currentUser.id,
          action: 'Created expense',
          timestamp: new Date().toISOString()
        }];
        const newExp = await db.addExpense({
          ...expenseData,
          status: expenseData.status || 'pending',
          date: expenseData.date || new Date().toISOString(),
          createdBy: currentUser.id,
          createdAt: new Date().toISOString(),
          history: initialHistory
        } as Omit<Expense, 'id'>);
        setExpenses([newExp, ...expenses]);
      }
      setIsExpenseModalOpen(false);
      setEditingExpense(undefined);
    } catch (err) {
      alert("Error saving expense.");
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleExpenseStatus = async (id: string) => {
    if (!currentUser) return;
    const expense = expenses.find(e => e.id === id);
    if (!expense) return;
    const newStatus: 'pending' | 'settled' = expense.status === 'pending' ? 'settled' : 'pending';
    const newSplits = expense.splits.map(s => ({ 
      ...s, 
      isPaid: newStatus === 'settled',
      paidBy: newStatus === 'settled' ? currentUser.id : undefined,
      paidAt: newStatus === 'settled' ? new Date().toISOString() : undefined
    }));
    
    setIsSyncing(true);
    try {
      const history = [...(expense.history || [])];
      history.push({
        id: Math.random().toString(36).substr(2, 9),
        userId: currentUser.id,
        action: `Marked as ${newStatus}`,
        timestamp: new Date().toISOString()
      });

      const updates = { 
        status: newStatus, 
        splits: newSplits,
        updatedBy: currentUser.id,
        updatedAt: new Date().toISOString(),
        history
      };
      await db.updateExpense(id, updates);
      setExpenses(expenses.map(e => e.id === id ? { ...e, ...updates } as Expense : e));
    } catch (err) {
      alert("Sync failed.");
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleIndividualSplit = async (expenseId: string, friendId: string) => {
    if (!currentUser) return;
    const exp = expenses.find(e => e.id === expenseId);
    if (!exp) return;
    const newSplits = exp.splits.map(s => {
      if (s.friendId === friendId) {
        const isNowPaid = !s.isPaid;
        return { 
          ...s, 
          isPaid: isNowPaid,
          paidBy: isNowPaid ? currentUser.id : undefined,
          paidAt: isNowPaid ? new Date().toISOString() : undefined
        };
      }
      return s;
    });
    const allSettled = newSplits.filter(s => s.amount > 0).every(s => s.isPaid);
    const newStatus: 'pending' | 'settled' = allSettled ? 'settled' : 'pending';

    setIsSyncing(true);
    try {
      const history = [...(exp.history || [])];
      const friendName = friends.find(f => f.id === friendId)?.name;
      const isNowPaid = !exp.splits.find(s => s.friendId === friendId)?.isPaid;
      history.push({
        id: Math.random().toString(36).substr(2, 9),
        userId: currentUser.id,
        action: `${isNowPaid ? 'Marked' : 'Unmarked'} ${friendName}'s share as paid`,
        timestamp: new Date().toISOString()
      });

      const updates = { 
        splits: newSplits, 
        status: newStatus,
        updatedBy: currentUser.id,
        updatedAt: new Date().toISOString(),
        history
      };
      await db.updateExpense(expenseId, updates);
      setExpenses(expenses.map(e => e.id === expenseId ? { ...e, ...updates } as Expense : e));
    } catch (err) {
      alert("Update failed.");
    } finally {
      setIsSyncing(false);
    }
  };

  const deleteExpense = async (id: string) => {
    if (window.confirm("Delete this expense?")) {
      setIsSyncing(true);
      try {
        await db.deleteExpense(id);
        setExpenses(expenses.filter(e => e.id !== id));
      } catch (err) {
        alert("Error deleting.");
      } finally {
        setIsSyncing(false);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-indigo-600 font-bold animate-pulse">Loading Sinigeng...</p>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6 flex-col text-center space-y-6">
        <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        </div>
        <div className="max-w-md space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">Connection Error</h2>
          <p className="text-gray-500">{hasError}</p>
        </div>
        <button onClick={() => window.location.reload()} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold">Retry Connection</button>
      </div>
    );
  }

  if (!currentUser) {
    return <Login friends={friends} onLogin={handleLogin} onUpdatePin={handleUpdatePin} />;
  }

  return (
    <div className="min-h-screen pb-20">
      <nav className="glass sticky top-0 z-40 px-4 py-3 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-sm shadow-sm rotate-3">🦖</div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Sinigeng Hatian</h1>
            {isSyncing && <p className="text-[8px] font-bold text-indigo-500 uppercase">Syncing...</p>}
          </div>
        </div>
        
        <div className="hidden sm:flex bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'dashboard' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>Dashboard</button>
          <button onClick={() => setActiveTab('summary')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'summary' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>Summary</button>
        </div>

        <div className="flex items-center space-x-2">
           {currentUser?.role === 'admin' && (
             <button onClick={() => setIsFriendModalOpen(true)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13.481 4.017a4 4 0 014.168 5.608" /></svg>
             </button>
           )}
           <div className="h-6 w-px bg-gray-200 mx-1"></div>
           <div className="flex items-center space-x-2 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
             <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white">
               {currentUser.name.charAt(0).toUpperCase()}
             </div>
             <span className="text-xs font-black text-indigo-700 hidden xs:block">{currentUser.name}</span>
             <button 
               onClick={handleLogout}
               className="ml-2 p-1 text-gray-400 hover:text-rose-500 transition-colors"
               title="Logout"
             >
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
             </button>
           </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 mt-8 space-y-10">
        {activeTab === 'dashboard' ? (
          <>
            <section className="grid grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Paid Overall</p>
                <p className="text-2xl font-black text-indigo-600">₱{totalPaidOverall.toLocaleString()}</p>
              </div>
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Owed to Others</p>
                <p className="text-2xl font-black text-rose-600">₱{totalStillOwed.toLocaleString()}</p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Balances</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {friends.length === 0 && (
                  <div className="col-span-full py-12 text-center bg-white rounded-3xl border border-dashed border-gray-300">
                    <p className="text-gray-500 font-medium">Add some friends to get started!</p>
                    <button onClick={() => setIsFriendModalOpen(true)} className="mt-4 px-6 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold">Add Friends</button>
                  </div>
                )}
                {balances.map((b: Balance) => {
                  const friend = friends.find(f => f.id === b.friendId);
                  return (
                    <div key={b.friendId} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative group overflow-hidden">
                      <div className={`absolute top-0 left-0 w-1 h-full ${b.net >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <div className="flex items-center space-x-3 mb-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${b.net >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{friend?.name?.[0].toUpperCase() || '?'}</div>
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900">{friend?.name}</h3>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Expected to Receive</p>
                          <p className={`text-xs font-semibold ${b.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{b.net >= 0 ? `+ ₱${b.net.toFixed(2)}` : `- ₱${Math.abs(b.net).toFixed(2)}`}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 border-t pt-3">
                        <div className="text-center border-r border-gray-50">
                          <p className="text-[8px] uppercase tracking-widest font-black text-gray-400">Credit</p>
                          <p className="text-xs font-bold text-emerald-600">₱{b.paid.toFixed(2)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[8px] uppercase tracking-widest font-black text-gray-400">Debt</p>
                          <p className="text-xs font-bold text-rose-600">₱{b.owed.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {settlements.length > 0 && (
              <section className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center space-x-2">
                    <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                    <span>Settlement Report</span>
                  </h2>
                  <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full uppercase">Direct Transfers</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {settlements.map((s: Settlement, idx: number) => {
                    const fromFriend = friends.find(f => f.id === s.fromId);
                    const toFriend = friends.find(f => f.id === s.toId);
                    return (
                      <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group hover:border-indigo-200 transition-colors">
                        <div className="flex items-center space-x-3">
                          <div className="text-center">
                            <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-xs font-bold text-rose-600">{fromFriend?.name?.[0]}</div>
                            <p className="text-[9px] font-bold text-gray-400 uppercase mt-1 truncate w-12">{fromFriend?.name}</p>
                          </div>
                          <div className="flex flex-col items-center">
                            <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">Pays</span>
                          </div>
                          <div className="text-center">
                            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-xs font-bold text-emerald-600">{toFriend?.name?.[0]}</div>
                            <p className="text-[9px] font-bold text-gray-400 uppercase mt-1 truncate w-12">{toFriend?.name}</p>
                          </div>
                        </div>
                        <div className="text-right pl-4 border-l border-gray-50">
                          <p className="text-lg font-black text-gray-900 leading-tight">₱{s.amount.toFixed(2)}</p>
                          <p className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest">Settle Up</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Expenses</h2>
                <button 
                  onClick={() => { 
                    if (friends.length === 0) {
                      alert("Please add friends first!");
                      setIsFriendModalOpen(true);
                    } else {
                      setEditingExpense(undefined); 
                      setIsExpenseModalOpen(true); 
                    }
                  }} 
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-md shadow-indigo-100 flex items-center space-x-2 text-xs"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                  <span>New Bill</span>
                </button>
              </div>

              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                {expenses.length === 0 ? (
                  <div className="py-20 text-center text-gray-400">No expenses yet. Start splitting!</div>
                ) : (
                  expenses.map(exp => (
                    <div key={exp.id} className={`transition-all ${exp.status === 'settled' ? 'bg-gray-50/50 opacity-60' : 'bg-white'}`}>
                      <div className="p-4 flex items-center justify-between cursor-pointer group" onClick={() => setExpandedExpenseId(expandedExpenseId === exp.id ? null : exp.id)}>
                        <div className="flex items-center space-x-4">
                          <button onClick={(e) => { e.stopPropagation(); toggleExpenseStatus(exp.id); }} className={`p-2 rounded-xl border transition-all ${exp.status === 'settled' ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-gray-200 text-gray-300 hover:border-emerald-500'}`}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg></button>
                          <div>
                            <h4 className={`font-bold transition-all ${exp.status === 'settled' ? 'line-through text-gray-400' : 'text-gray-900'}`}>{exp.description}</h4>
                            <div className="flex items-center space-x-2 text-[10px] text-gray-500">
                              <span className="font-bold text-gray-700 uppercase">{friends.find(f => f.id === exp.payerId)?.name} PAID</span>
                              <span>•</span>
                              <span>{new Date(exp.date).toLocaleDateString()}</span>
                              {exp.createdBy && (
                                <>
                                  <span>•</span>
                                  <span className="text-gray-400 italic">Added by {friends.find(f => f.id === exp.createdBy)?.name}</span>
                                </>
                              )}
                              {exp.updatedBy && exp.updatedBy !== exp.createdBy && (
                                <>
                                  <span>•</span>
                                  <span className="text-gray-400 italic">Updated by {friends.find(f => f.id === exp.updatedBy)?.name}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                          <div className="flex items-center space-x-4">
                            <div className="text-right">
                              <p className="font-bold text-lg text-gray-900">₱{exp.amount.toFixed(2)}</p>
                              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{exp.splitType} split</p>
                            </div>
                            <div className="flex flex-col space-y-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              <button onClick={(e) => { e.stopPropagation(); setEditingExpense(exp); setIsExpenseModalOpen(true); }} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                              <button onClick={(e) => { e.stopPropagation(); deleteExpense(exp.id); }} className="p-1.5 bg-rose-50 text-rose-600 rounded-lg"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                            </div>
                          </div>
                      </div>
                      {expandedExpenseId === exp.id && (
                        <div className="px-14 pb-4 pt-1 space-y-4 border-t border-gray-50 bg-gray-50/30">
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Individual Split Tracking</p>
                            <div className="flex flex-wrap gap-2">
                              {exp.splits.filter(s => s.amount > 0).map(s => {
                                const f = friends.find(fr => fr.id === s.friendId);
                                return (
                                  <button key={s.friendId} onClick={() => toggleIndividualSplit(exp.id, s.friendId)} className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs transition-all ${s.isPaid ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-gray-200 text-gray-600 shadow-sm hover:border-indigo-300'}`}>
                                    <span className="font-bold">{f?.name}</span>
                                    <span className="opacity-60">₱{s.amount.toFixed(2)}</span>
                                    {s.isPaid ? (
                                      <div className="flex items-center space-x-1">
                                        <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                                        {s.paidBy && (
                                          <span className="text-[8px] font-bold text-emerald-600 uppercase">by {friends.find(fr => fr.id === s.paidBy)?.name}</span>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="w-3.5 h-3.5 border rounded-full border-gray-300" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {(exp.notes || exp.proofOfPayment || (exp.history && exp.history.length > 0)) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
                              <div className="space-y-4">
                                {exp.notes && (
                                  <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Notes</p>
                                    <p className="text-xs text-gray-600 italic leading-relaxed">"{exp.notes}"</p>
                                  </div>
                                )}
                                {exp.proofOfPayment && exp.proofOfPayment.length > 0 && (
                                  <div className="space-y-2">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Attachments</p>
                                    <div className="flex flex-wrap gap-2">
                                      {exp.proofOfPayment.map((img, idx) => (
                                        <div 
                                          key={idx} 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setCarouselImages(exp.proofOfPayment || []);
                                            setCarouselInitialIndex(idx);
                                            setIsCarouselOpen(true);
                                          }}
                                          className="w-12 h-12 rounded-lg overflow-hidden border border-gray-200 cursor-zoom-in hover:border-indigo-400 transition-colors"
                                        >
                                          <img src={img} alt="Proof" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {exp.history && exp.history.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Audit Trail History</p>
                                  <div className="bg-gray-50/50 rounded-2xl p-3 border border-gray-100 space-y-3 max-h-40 overflow-y-auto custom-scrollbar">
                                    {exp.history.slice().reverse().map((log) => (
                                      <div key={log.id} className="flex items-start space-x-2 text-[10px]">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1 flex-shrink-0" />
                                        <div className="flex-1">
                                          <p className="text-gray-700 leading-tight">
                                            <span className="font-bold">{friends.find(f => f.id === log.userId)?.name}</span>
                                            {" "}{log.action}
                                          </p>
                                          <p className="text-gray-400 font-medium mt-0.5">
                                            {new Date(log.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                          </p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        ) : (
          <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-black text-gray-900 tracking-tight">Financial Summary</h2>
               </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Group Spend</p>
                <p className="text-4xl font-bold text-gray-900 tracking-tighter">₱{analytics.totalSpend.toLocaleString()}</p>
                <p className="text-[10px] text-emerald-500 font-bold mt-2">₱{analytics.totalSettledValue.toLocaleString()} SETTLED</p>
              </div>
              <div className="bg-indigo-600 p-6 rounded-[2rem] shadow-lg shadow-indigo-100 text-white">
                <p className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-1">Settlement Progress</p>
                <p className="text-4xl font-bold tracking-tighter">{analytics.settlementProgress.toFixed(0)}%</p>
                <div className="w-full bg-indigo-800 rounded-full h-1.5 mt-2 overflow-hidden"><div className="bg-white h-full transition-all duration-1000" style={{ width: `${analytics.settlementProgress}%` }} /></div>
              </div>
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Outstanding</p>
                <p className="text-4xl font-bold text-rose-600 tracking-tighter">₱{(analytics.totalSpend - analytics.totalSettledValue).toLocaleString()}</p>
                <p className="text-[10px] text-gray-400 mt-2 font-medium">To be settled</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center space-x-2"><div className="w-1.5 h-6 bg-indigo-500 rounded-full" /><span>Contribution Breakdown</span></h3>
                  <div className="space-y-6">
                    {friends.map(f => {
                      const total = analytics.friendSpending[f.id] || 0;
                      const settled = analytics.friendSettled[f.id] || 0;
                      const barWidth = analytics.maxFriendSpend > 0 ? (total / analytics.maxFriendSpend) * 100 : 0;
                      const settledWidth = total > 0 ? (settled / total) * 100 : 0;
                      return (
                        <div key={f.id} className="space-y-2 group">
                          <div className="flex justify-between text-xs font-bold text-gray-700"><span>{f.name}</span><span className="text-indigo-600">₱{settled.toFixed(2)} / ₱{total.toFixed(2)}</span></div>
                          <div className="h-4 bg-gray-50 rounded-full overflow-hidden relative">
                            <div className="h-full bg-indigo-100 absolute left-0 top-0 transition-all duration-1000" style={{ width: `${barWidth}%` }} />
                            <div className="h-full bg-indigo-600 absolute left-0 top-0 transition-all duration-1000 z-10" style={{ width: `${(settledWidth * barWidth) / 100}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center space-x-2"><div className="w-1.5 h-6 bg-emerald-500 rounded-full" /><span>Settlement Plan</span></h3>
                  {settlements.length > 0 ? (
                    <div className="space-y-4">
                      {settlements.map((s: Settlement, idx: number) => {
                        const fromFriend = friends.find(f => f.id === s.fromId);
                        const toFriend = friends.find(f => f.id === s.toId);
                        return (
                          <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                            <div className="flex items-center space-x-3">
                              <span className="font-bold text-gray-900">{fromFriend?.name}</span>
                              <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                              <span className="font-bold text-gray-900">{toFriend?.name}</span>
                            </div>
                            <span className="text-lg font-black text-indigo-600">₱{s.amount.toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-gray-400 italic">All settled up! No transfers needed.</div>
                  )}
              </div>
            </div>
          </section>
        )}
      </main>

      <div className="fixed bottom-6 inset-x-0 flex justify-center z-50 px-4 pointer-events-none">
        <div className="glass px-6 py-3 rounded-2xl shadow-xl flex items-center space-x-8 border border-white/50 pointer-events-auto">
          <button onClick={() => setActiveTab('dashboard')} className={`transition-colors p-2 rounded-xl ${activeTab === 'dashboard' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400 hover:text-indigo-400'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg></button>
          <button onClick={() => setIsExpenseModalOpen(true)} className="w-14 h-14 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-xl -mt-12 hover:scale-110 active:scale-95 transition-all shrink-0"><svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"/></svg></button>
          <button onClick={() => setActiveTab('summary')} className={`transition-colors p-2 rounded-xl ${activeTab === 'summary' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400 hover:text-indigo-400'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg></button>
        </div>
      </div>

      <Modal isOpen={isFriendModalOpen} onClose={() => { setIsFriendModalOpen(false); setEditingFriendId(null); }} title="Friends List">
        <div className="space-y-6 text-gray-900">
          <form onSubmit={addFriend} className="flex space-x-2">
            <input type="text" value={newFriendName} onChange={e => setNewFriendName(e.target.value)} placeholder="Name" className="flex-1 rounded-xl border-gray-200 border p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-900" />
            <button type="submit" disabled={isSyncing} className="px-6 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50">Add</button>
          </form>
          <div className="space-y-3">
            {friends.length === 0 && <p className="text-center py-4 text-gray-400 text-sm">No friends added yet.</p>}
            {friends.map(f => (
              <div key={f.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 group">
                {editingFriendId === f.id ? (
                  <div className="flex-1 flex items-center space-x-2">
                    <input 
                      autoFocus
                      type="text" 
                      value={friendNameBuffer} 
                      onChange={e => setFriendNameBuffer(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && updateFriendName(f.id, friendNameBuffer)}
                      className="flex-1 bg-white border border-indigo-200 rounded-lg px-2 py-1 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <button onClick={() => updateFriendName(f.id, friendNameBuffer)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
                    </button>
                    <button onClick={() => setEditingFriendId(null)} className="p-2 text-gray-400 hover:bg-gray-200 rounded-lg">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </div>
                ) : resettingPinId === f.id ? (
                  <div className="flex-1 flex items-center space-x-2">
                    <div className="flex-1 flex flex-col">
                      <span className="text-[10px] font-bold text-amber-600 uppercase mb-1">New 4-digit PIN for {f.name}</span>
                      <input 
                        autoFocus
                        type="password" 
                        maxLength={4}
                        placeholder="••••"
                        value={newPinBuffer} 
                        onChange={e => setNewPinBuffer(e.target.value.replace(/\D/g, ''))}
                        onKeyDown={e => e.key === 'Enter' && updateFriendPin(f.id, newPinBuffer)}
                        className="w-full bg-white border border-amber-200 rounded-lg px-2 py-1 text-sm font-black tracking-widest text-gray-900 focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                    </div>
                    <button onClick={() => updateFriendPin(f.id, newPinBuffer)} className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg self-end">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
                    </button>
                    <button onClick={() => setResettingPinId(null)} className="p-2 text-gray-400 hover:bg-gray-200 rounded-lg self-end">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="font-bold text-gray-800">{f.name}</span>
                    <div className="flex space-x-1">
                      <button 
                        onClick={() => {
                          setEditingFriendId(f.id);
                          setFriendNameBuffer(f.name);
                          setResettingPinId(null);
                        }} 
                        className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg"
                        title="Edit name"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                      </button>
                      {currentUser?.role === 'admin' && (
                        <button 
                          onClick={() => {
                            setResettingPinId(f.id);
                            setNewPinBuffer('');
                            setEditingFriendId(null);
                          }} 
                          className="p-2 text-amber-600 hover:bg-amber-100 rounded-lg"
                          title="Reset PIN"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
                        </button>
                      )}
                      <button 
                        onClick={() => deleteFriend(f.id)} 
                        className="p-2 text-rose-600 hover:bg-rose-100 rounded-lg"
                        title="Delete friend"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <Modal isOpen={isExpenseModalOpen} onClose={() => { setIsExpenseModalOpen(false); setEditingExpense(undefined); }} title={editingExpense ? (editingExpense.id === 'new' ? "New Bill Preview" : "Edit Bill") : "New Bill"}>
        <ExpenseForm friends={friends} expense={editingExpense} onSubmit={handleExpenseSubmit} onCancel={() => setIsExpenseModalOpen(false)}/>
      </Modal>

      <ImageCarousel 
        images={carouselImages} 
        initialIndex={carouselInitialIndex} 
        isOpen={isCarouselOpen} 
        onClose={() => setIsCarouselOpen(false)} 
      />
    </div>
  );
};

export default App;
