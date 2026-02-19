
import React, { useState, useEffect, useMemo } from 'react';
import { Friend, Expense, Balance, Settlement, ExpenseSplit } from './types';
import { calculateBalances, calculateSettlements } from './utils/calculations';
import { parseExpenseWithAI } from './services/geminiService';
import ExpenseForm from './components/ExpenseForm';
import Modal from './components/Modal';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'summary'>('dashboard');
  const [friends, setFriends] = useState<Friend[]>(() => {
    const saved = localStorage.getItem('split_friends');
    return saved ? JSON.parse(saved) : [
      { id: '1', name: 'You' },
      { id: '2', name: 'Alice' },
      { id: '3', name: 'Bob' }
    ];
  });

  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem('split_expenses');
    return saved ? JSON.parse(saved) : [];
  });

  const [isFriendModalOpen, setIsFriendModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isSmartModalOpen, setIsSmartModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
  const [editingFriendId, setEditingFriendId] = useState<string | null>(null);
  const [friendNameBuffer, setFriendNameBuffer] = useState('');
  const [newFriendName, setNewFriendName] = useState('');
  const [smartInput, setSmartInput] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('split_friends', JSON.stringify(friends));
  }, [friends]);

  useEffect(() => {
    localStorage.setItem('split_expenses', JSON.stringify(expenses));
  }, [expenses]);

  const balances = useMemo(() => calculateBalances(friends, expenses), [friends, expenses]);
  const settlements = useMemo(() => calculateSettlements(balances), [balances]);

  // Enhanced Analytics Calculations
  const analytics = useMemo(() => {
    let totalSpend = 0;
    let totalSettledValue = 0;
    const friendSpending: Record<string, number> = {};
    const friendSettled: Record<string, number> = {};
    const dailySpending: Record<string, number> = {};

    friends.forEach(f => {
      friendSpending[f.id] = 0;
      friendSettled[f.id] = 0;
    });

    expenses.forEach(e => {
      totalSpend += e.amount;
      friendSpending[e.payerId] = (friendSpending[e.payerId] || 0) + e.amount;
      
      // Calculate how much of this specific expense is already "settled"
      // Payer is always considered "settled" for their own share
      const settledPortion = e.splits.reduce((sum, s) => s.isPaid ? sum + s.amount : sum, 0);
      totalSettledValue += settledPortion;
      
      // Track how much each friend has effectively "repaid" or "contributed"
      e.splits.forEach(s => {
        if (s.isPaid) {
          friendSettled[s.friendId] = (friendSettled[s.friendId] || 0) + s.amount;
        }
      });

      const dateStr = new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailySpending[dateStr] = (dailySpending[dateStr] || 0) + e.amount;
    });

    const sortedDates = Object.keys(dailySpending).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const maxFriendSpend = Math.max(...Object.values(friendSpending), 1);
    const maxDailySpend = Math.max(...Object.values(dailySpending), 1);
    const totalPending = totalSpend - totalSettledValue;
    const settlementProgress = totalSpend > 0 ? (totalSettledValue / totalSpend) * 100 : 0;

    return {
      totalSpend,
      totalSettledValue,
      totalPending,
      settlementProgress,
      avgExpense: expenses.length ? totalSpend / expenses.length : 0,
      friendSpending,
      friendSettled,
      dailySpending,
      sortedDates,
      maxFriendSpend,
      maxDailySpend
    };
  }, [friends, expenses]);

  const addFriend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFriendName.trim()) return;
    const newFriend: Friend = { id: crypto.randomUUID(), name: newFriendName.trim() };
    setFriends([...friends, newFriend]);
    setNewFriendName('');
  };

  const updateFriendName = (id: string, name: string) => {
    setFriends(friends.map(f => f.id === id ? { ...f, name } : f));
    setEditingFriendId(null);
  };

  const deleteFriend = (id: string) => {
    if (expenses.some(e => e.payerId === id || e.splits.some(s => s.friendId === id))) {
      alert("Cannot delete friend with existing expenses.");
      return;
    }
    setFriends(friends.filter(f => f.id !== id));
  };

  const handleExpenseSubmit = (expenseData: Partial<Expense>) => {
    if (editingExpense) {
      setExpenses(expenses.map(e => e.id === editingExpense.id ? { ...e, ...expenseData } as Expense : e));
    } else {
      const newExp: Expense = {
        ...expenseData,
        id: crypto.randomUUID(),
        status: expenseData.status || 'pending',
      } as Expense;
      setExpenses([newExp, ...expenses]);
    }
    setIsExpenseModalOpen(false);
    setEditingExpense(undefined);
  };

  const toggleExpenseStatus = (id: string) => {
    setExpenses(expenses.map(e => {
      if (e.id === id) {
        const newStatus = e.status === 'pending' ? 'settled' : 'pending';
        const newSplits = e.splits.map(s => ({ ...s, isPaid: newStatus === 'settled' }));
        return { ...e, status: newStatus, splits: newSplits };
      }
      return e;
    }));
  };

  const toggleIndividualSplit = (expenseId: string, friendId: string) => {
    setExpenses(expenses.map(e => {
      if (e.id === expenseId) {
        const newSplits = e.splits.map(s => s.friendId === friendId ? { ...s, isPaid: !s.isPaid } : s);
        const allSettled = newSplits.filter(s => s.amount > 0).every(s => s.isPaid);
        return { ...e, splits: newSplits, status: allSettled ? 'settled' : 'pending' } as Expense;
      }
      return e;
    }));
  };

  const handleSmartSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smartInput.trim()) return;
    setIsParsing(true);
    const parsed = await parseExpenseWithAI(smartInput);
    setIsParsing(false);
    if (parsed) {
      let payerId = friends[0]?.id;
      if (parsed.payerNameHint) {
        const found = friends.find(f => f.name.toLowerCase().includes(parsed.payerNameHint!.toLowerCase()));
        if (found) payerId = found.id;
      }
      
      setEditingExpense({
        id: 'new',
        description: parsed.description,
        amount: parsed.amount,
        payerId: payerId,
        date: parsed.date || new Date().toISOString(),
        splitType: 'equal',
        status: 'pending',
        splits: friends.map(f => ({ friendId: f.id, amount: parsed.amount / friends.length, isPaid: f.id === payerId }))
      });
      setIsSmartModalOpen(false);
      setIsExpenseModalOpen(true);
      setSmartInput('');
    } else {
      alert("AI could not understand that. Try being more descriptive.");
    }
  };

  const deleteExpense = (id: string) => {
    if (confirm("Delete this expense?")) {
      setExpenses(expenses.filter(e => e.id !== id));
    }
  };

  const exportToCSV = () => {
    const headers = ['Description', 'Payer', 'Total', 'Date', 'Status'];
    const rows = expenses.map(e => [
      e.description,
      friends.find(f => f.id === e.payerId)?.name || 'Unknown',
      e.amount,
      new Date(e.date).toLocaleDateString(),
      e.status
    ]);
    const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'expenses.csv';
    link.click();
  };

  return (
    <div className="min-h-screen pb-20">
      <nav className="glass sticky top-0 z-40 px-4 py-3 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">S</div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">SplitSmart</h1>
        </div>
        
        <div className="hidden sm:flex bg-gray-100 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'dashboard' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('summary')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'summary' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Summary
          </button>
        </div>

        <div className="flex items-center space-x-2">
           <button onClick={() => setIsSmartModalOpen(true)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors" title="Smart Add">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
           </button>
           <button onClick={() => setIsFriendModalOpen(true)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13.481 4.017a4 4 0 014.168 5.608" /></svg>
           </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 mt-8 space-y-8">
        {activeTab === 'dashboard' ? (
          <>
            {/* Balances Grid */}
            <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {balances.map(b => {
                const friend = friends.find(f => f.id === b.friendId);
                return (
                  <div key={b.friendId} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 relative group overflow-hidden">
                    <div className={`absolute top-0 left-0 w-1 h-full ${b.net >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    <div className="flex items-center space-x-3 mb-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${b.net >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {friend?.name[0].toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900">{friend?.name}</h3>
                        <p className={`text-xs font-semibold ${b.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {b.net >= 0 ? `+ ₱${b.net.toFixed(2)}` : `- ₱${Math.abs(b.net).toFixed(2)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-between text-[10px] uppercase tracking-wider text-gray-400 font-bold border-t pt-3">
                      <div>Credit: <span className="text-gray-700 ml-1">₱{b.paid.toFixed(2)}</span></div>
                      <div>Debt: <span className="text-gray-700 ml-1">₱{b.owed.toFixed(2)}</span></div>
                    </div>
                  </div>
                );
              })}
            </section>

            {/* Expenses List */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Expenses</h2>
                <div className="flex items-center space-x-2">
                  <button onClick={exportToCSV} className="p-2 border rounded-xl hover:bg-gray-50 text-gray-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </button>
                  <button onClick={() => { setEditingExpense(undefined); setIsExpenseModalOpen(true); }} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 flex items-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                    <span>Add Expense</span>
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                {expenses.length === 0 ? (
                  <div className="py-20 text-center text-gray-400">No expenses yet. Start splitting!</div>
                ) : (
                  expenses.map(exp => (
                    <div key={exp.id} className={`transition-all ${exp.status === 'settled' ? 'bg-gray-50/50 opacity-60' : 'bg-white'}`}>
                      <div className="p-4 flex items-center justify-between cursor-pointer group" onClick={() => setExpandedExpenseId(expandedExpenseId === exp.id ? null : exp.id)}>
                        <div className="flex items-center space-x-4">
                          <button onClick={(e) => { e.stopPropagation(); toggleExpenseStatus(exp.id); }} className={`p-2 rounded-xl border transition-all ${exp.status === 'settled' ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-gray-200 text-gray-300 hover:border-emerald-500'}`}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                          </button>
                          <div>
                            <h4 className={`font-bold transition-all ${exp.status === 'settled' ? 'line-through text-gray-400' : 'text-gray-900'}`}>{exp.description}</h4>
                            <div className="flex items-center space-x-2 text-[10px] text-gray-500">
                              <span className="font-bold text-gray-700 uppercase">{friends.find(f => f.id === exp.payerId)?.name} PAID</span>
                              <span>•</span>
                              <span>{new Date(exp.date).toLocaleDateString()}</span>
                              <span>•</span>
                              <span className={`px-1.5 py-0.5 rounded-full font-bold ${exp.status === 'settled' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                {exp.splits.filter(s => s.amount > 0 && s.isPaid).length} / {exp.splits.filter(s => s.amount > 0).length} SETTLED
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="font-bold text-lg text-gray-900">₱{exp.amount.toFixed(2)}</p>
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{exp.splitType} split</p>
                          </div>
                          <div className="flex flex-col space-y-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); setEditingExpense(exp); setIsExpenseModalOpen(true); }} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                            <button onClick={(e) => { e.stopPropagation(); deleteExpense(exp.id); }} className="p-1.5 bg-rose-50 text-rose-600 rounded-lg"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                          </div>
                        </div>
                      </div>
                      {expandedExpenseId === exp.id && (
                        <div className="px-14 pb-4 pt-1 space-y-2 border-t border-gray-50 bg-gray-50/30">
                          <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Individual Split Tracking</p>
                          <div className="flex flex-wrap gap-2">
                            {exp.splits.filter(s => s.amount > 0).map(s => {
                              const f = friends.find(fr => fr.id === s.friendId);
                              return (
                                <button key={s.friendId} onClick={() => toggleIndividualSplit(exp.id, s.friendId)} className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs transition-all ${s.isPaid ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-gray-200 text-gray-600 shadow-sm hover:border-indigo-300'}`}>
                                  <span className="font-bold">{f?.name}</span>
                                  <span className="opacity-60">₱{s.amount.toFixed(2)}</span>
                                  {s.isPaid ? (
                                    <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                                  ) : (
                                    <div className="w-3.5 h-3.5 border rounded-full border-gray-300" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Settlement Summary */}
            <section className="bg-indigo-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full -mr-10 -mt-10 blur-2xl" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold flex items-center space-x-3">
                    <svg className="w-7 h-7 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    <span>Settlement Report</span>
                  </h2>
                </div>

                {settlements.length === 0 ? (
                  <div className="py-8 text-center bg-indigo-800/20 rounded-3xl border border-indigo-700/50">
                    <p className="text-indigo-300 font-medium">✨ All settled! Everyone is square.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {settlements.map((s, idx) => (
                      <div key={idx} className="bg-white/5 border border-white/10 p-5 rounded-3xl flex items-center justify-between group transition-all hover:bg-white/10">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-indigo-200">{friends.find(f => f.id === s.fromId)?.name}</span>
                            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                            <span className="font-bold text-indigo-200">{friends.find(f => f.id === s.toId)?.name}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                           <span className="text-2xl font-bold text-emerald-400 font-mono tracking-tighter">₱{s.amount.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        ) : (
          /* Summary Tab Content */
          <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Top Stat Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Group Spend</p>
                  <p className="text-4xl font-bold text-gray-900 tracking-tighter">₱{analytics.totalSpend.toLocaleString()}</p>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-50 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full">₱{analytics.totalSettledValue.toLocaleString()} SETTLED</span>
                  <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">₱{analytics.totalPending.toLocaleString()} PENDING</span>
                </div>
              </div>
              
              <div className="bg-indigo-600 p-6 rounded-[2rem] shadow-lg shadow-indigo-100 text-white flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-1">Group Progress</p>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-4xl font-bold tracking-tighter">{analytics.settlementProgress.toFixed(0)}%</p>
                    <div className="w-12 h-12 rounded-full border-4 border-indigo-400 flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
                    </div>
                  </div>
                </div>
                <div className="w-full bg-indigo-800 rounded-full h-2 overflow-hidden">
                  <div className="bg-white h-full transition-all duration-1000" style={{ width: `${analytics.settlementProgress}%` }} />
                </div>
              </div>

              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Avg per Friend</p>
                  <p className="text-4xl font-bold text-gray-900 tracking-tighter">₱{(analytics.totalSpend / friends.length).toFixed(0)}</p>
                </div>
                <p className="text-[10px] text-gray-400 mt-2 font-medium italic">Based on {friends.length} active members</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Contribution Chart */}
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-8 flex items-center space-x-2">
                  <div className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                  <span>Settled Contributions</span>
                </h3>
                <div className="space-y-6">
                  {friends.map(f => {
                    const total = analytics.friendSpending[f.id] || 0;
                    const settled = analytics.friendSettled[f.id] || 0;
                    const barWidth = analytics.maxFriendSpend > 0 ? (total / analytics.maxFriendSpend) * 100 : 0;
                    const settledWidth = total > 0 ? (settled / total) * 100 : 0;
                    
                    return (
                      <div key={f.id} className="space-y-2 group">
                        <div className="flex justify-between text-xs font-bold text-gray-700">
                          <div className="flex items-center space-x-2">
                            <span className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center text-[10px]">{f.name[0]}</span>
                            <span>{f.name}</span>
                          </div>
                          <span className="text-indigo-600">₱{settled.toFixed(2)} / ₱{total.toFixed(2)}</span>
                        </div>
                        <div className="h-4 bg-gray-50 rounded-full overflow-hidden relative">
                          <div 
                            className="h-full bg-indigo-100 absolute left-0 top-0 transition-all duration-1000"
                            style={{ width: `${barWidth}%` }}
                          />
                          <div 
                            className="h-full bg-indigo-600 absolute left-0 top-0 transition-all duration-1000 z-10"
                            style={{ width: `${(settledWidth * barWidth) / 100}%` }}
                          />
                        </div>
                        <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-[10px] font-bold text-gray-400 uppercase">{settledWidth.toFixed(0)}% Repaid/Owned Clear</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Activity Timeline */}
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-8 flex items-center space-x-2">
                  <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                  <span>Spending Timeline</span>
                </h3>
                <div className="h-48 flex items-end justify-between space-x-2">
                  {analytics.sortedDates.slice(-7).map(date => {
                    const amount = analytics.dailySpending[date];
                    const barHeight = (amount / analytics.maxDailySpend) * 100;
                    return (
                      <div key={date} className="flex-1 flex flex-col items-center space-y-2 group relative">
                        <div className="absolute -top-10 opacity-0 group-hover:opacity-100 bg-gray-900 text-white text-[10px] px-2 py-1 rounded pointer-events-none transition-opacity whitespace-nowrap z-20">
                          ₱{amount.toFixed(2)}
                        </div>
                        <div 
                          className="w-full bg-emerald-100 hover:bg-emerald-500 rounded-t-lg transition-all duration-700 cursor-help"
                          style={{ height: `${barHeight}%` }}
                        />
                        <span className="text-[8px] font-bold text-gray-400 uppercase truncate w-full text-center">
                          {date}
                        </span>
                      </div>
                    );
                  })}
                  {analytics.sortedDates.length === 0 && (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 italic text-sm">
                      No activity logs found
                    </div>
                  )}
                </div>
                <div className="mt-6 flex justify-center space-x-4">
                  <div className="flex items-center space-x-1.5">
                    <div className="w-2.5 h-2.5 bg-emerald-500 rounded-sm" />
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Spending</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <div className="w-2.5 h-2.5 bg-emerald-100 rounded-sm" />
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Normal</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-8 rounded-[2.5rem] border border-gray-100">
              <h3 className="text-gray-900 font-bold mb-6 flex items-center justify-between">
                <span>Contribution Leaderboard</span>
                <span className="text-xs font-normal text-gray-500">Syncs with settlements</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(analytics.friendSpending)
                  .sort(([,a], [,b]) => b - a)
                  .map(([fid, amt], idx) => {
                    const f = friends.find(fr => fr.id === fid);
                    const settled = analytics.friendSettled[fid] || 0;
                    return (
                      <div key={fid} className="flex items-center justify-between p-5 bg-white rounded-3xl border border-gray-100 shadow-sm transition-transform hover:-translate-y-1">
                        <div className="flex items-center space-x-4">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${idx === 0 ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500'}`}>
                            {idx + 1}
                          </span>
                          <div>
                            <p className="font-bold text-gray-800">{f?.name}</p>
                            <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">₱{settled.toFixed(2)} Settled</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-bold text-indigo-600">₱{amt.toFixed(0)}</span>
                          <p className="text-[9px] text-gray-400 font-bold uppercase">Total Share</p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Footer Nav for Mobile */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 glass px-6 py-3 rounded-2xl shadow-xl flex items-center space-x-8 z-50">
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={`transition-colors p-2 rounded-xl ${activeTab === 'dashboard' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400 hover:text-indigo-400'}`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
          </button>
          
          <button onClick={() => setIsExpenseModalOpen(true)} className="w-14 h-14 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-xl -mt-12 hover:scale-110 active:scale-95 transition-all">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"/></svg>
          </button>
          
          <button 
            onClick={() => setActiveTab('summary')} 
            className={`transition-colors p-2 rounded-xl ${activeTab === 'summary' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400 hover:text-indigo-400'}`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
          </button>
      </div>

      {/* Modals */}
      <Modal isOpen={isFriendModalOpen} onClose={() => setIsFriendModalOpen(false)} title="Manage Friends">
        <div className="space-y-6 text-gray-900">
          <form onSubmit={addFriend} className="flex space-x-2">
            <input type="text" value={newFriendName} onChange={e => setNewFriendName(e.target.value)} placeholder="New friend's name" className="flex-1 rounded-xl border-gray-200 border p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-900 placeholder-gray-400"/>
            <button type="submit" className="px-6 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700">Add</button>
          </form>
          <div className="space-y-3">
            {friends.map(f => (
              <div key={f.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 group">
                {editingFriendId === f.id ? (
                  <div className="flex-1 flex items-center space-x-2">
                    <input autoFocus value={friendNameBuffer} onChange={e => setFriendNameBuffer(e.target.value)} onKeyDown={e => e.key === 'Enter' && updateFriendName(f.id, friendNameBuffer)} className="flex-1 p-1.5 text-sm border-2 border-indigo-500 rounded-lg outline-none bg-white text-gray-900"/>
                    <button onClick={() => updateFriendName(f.id, friendNameBuffer)} className="bg-indigo-600 text-white p-2 rounded-lg"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg></button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-500 text-xs">{f.name[0]}</div>
                      <span className="font-bold text-gray-800">{f.name}</span>
                    </div>
                    <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button onClick={() => { setEditingFriendId(f.id); setFriendNameBuffer(f.name); }} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg></button>
                       <button onClick={() => deleteFriend(f.id)} className="p-2 text-rose-600 hover:bg-rose-100 rounded-lg"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <Modal isOpen={isExpenseModalOpen} onClose={() => { setIsExpenseModalOpen(false); setEditingExpense(undefined); }} title={editingExpense ? "Edit Bill" : "Add New Bill"}>
        <ExpenseForm friends={friends} expense={editingExpense} onSubmit={handleExpenseSubmit} onCancel={() => setIsExpenseModalOpen(false)}/>
      </Modal>

      <Modal isOpen={isSmartModalOpen} onClose={() => setIsSmartModalOpen(false)} title="Magic Expense Parser">
        <form onSubmit={handleSmartSubmit} className="space-y-4 text-gray-900">
          <textarea value={smartInput} onChange={e => setSmartInput(e.target.value)} className="w-full h-32 p-4 border rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-900 placeholder-gray-400" placeholder="Try: 'Paid 120 for Dinner with Alice and Bob yesterday'"/>
          <button disabled={isParsing || !smartInput.trim()} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center space-x-2 disabled:opacity-50">
            {isParsing ? <span>Analyzing...</span> : <span>Parse Magic</span>}
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default App;
