import React, { useState, useEffect } from 'react';
import { Check, Info } from 'lucide-react';
import { Friend, Expense, ExpenseSplit } from '../types';
import { cn } from '../utils/cn';

interface ExpenseFormProps {
  friends: Friend[];
  expense?: Expense;
  onSubmit: (expense: Partial<Expense>) => void;
  onCancel: () => void;
}

const ExpenseForm: React.FC<ExpenseFormProps> = ({ friends, expense, onSubmit, onCancel }) => {
  const [description, setDescription] = useState(expense?.description || '');
  const [amount, setAmount] = useState(expense?.amount?.toString() || '');
  const [payerId, setPayerId] = useState(expense?.payerId || (friends[0]?.id || ''));
  const [splitType, setSplitType] = useState<'equal' | 'custom'>(expense?.splitType || 'equal');
  const [status, setStatus] = useState<'pending' | 'settled'>(expense?.status || 'pending');
  
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [paidFriendIds, setPaidFriendIds] = useState<string[]>([]);
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({});

  useEffect(() => {
    if (expense?.splits) {
      const activeIds = expense.splits.filter(s => s.amount > 0).map(s => s.friendId);
      const settledIds = expense.splits.filter(s => s.isPaid).map(s => s.friendId);
      
      setSelectedFriendIds(activeIds);
      setPaidFriendIds(settledIds);
      
      const splitsObj: Record<string, string> = {};
      expense.splits.forEach(s => {
        splitsObj[s.friendId] = s.amount > 0 ? s.amount.toString() : '';
      });
      setCustomSplits(splitsObj);
    } else {
      setSelectedFriendIds(friends.map(f => f.id));
      setPaidFriendIds([]); 
      const defaultSplits: Record<string, string> = {};
      friends.forEach(f => {
        defaultSplits[f.id] = '';
      });
      setCustomSplits(defaultSplits);
    }
  }, [expense, friends]);

  const toggleFriendSelection = (id: string) => {
    setSelectedFriendIds(prev => 
      prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]
    );
  };

  const togglePaidStatus = (id: string) => {
    setPaidFriendIds(prev =>
      prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return alert('Invalid amount');
    if (!description.trim()) return alert('Description required');
    if (selectedFriendIds.length === 0) return alert('Select at least one friend to split with');

    let splits: ExpenseSplit[] = [];
    if (splitType === 'equal') {
      const perPerson = numAmount / selectedFriendIds.length;
      splits = friends.map(f => ({ 
        friendId: f.id, 
        amount: selectedFriendIds.includes(f.id) ? perPerson : 0,
        isPaid: f.id === payerId || paidFriendIds.includes(f.id)
      }));
    } else {
      const totalCustom = (Object.values(customSplits) as string[]).reduce((sum: number, val: string) => sum + (parseFloat(val) || 0), 0);
      if (Math.abs(totalCustom - numAmount) > 0.01) {
        return alert(`Total splits (₱${totalCustom.toFixed(2)}) must equal total amount (₱${numAmount.toFixed(2)})`);
      }
      splits = friends.map(f => ({
        friendId: f.id,
        amount: selectedFriendIds.includes(f.id) ? (parseFloat(customSplits[f.id]) || 0) : 0,
        isPaid: f.id === payerId || paidFriendIds.includes(f.id)
      }));
    }

    const allSettled = splits.filter(s => s.amount > 0).every(s => s.isPaid);

    onSubmit({
      description,
      amount: numAmount,
      payerId,
      splitType,
      status: allSettled ? 'settled' : status,
      splits,
      date: expense?.date || new Date().toISOString()
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-1">
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="block w-full rounded-2xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-4 border bg-white text-slate-900 placeholder:text-slate-400 outline-none transition-all"
          placeholder="What was this for?"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Amount</label>
          <div className="relative rounded-2xl shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span className="text-slate-400 sm:text-sm font-bold">₱</span>
            </div>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="block w-full pl-8 pr-4 rounded-2xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-4 border bg-white text-slate-900 outline-none transition-all"
              placeholder="0.00"
              required
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Paid By</label>
          <select
            value={payerId}
            onChange={e => setPayerId(e.target.value)}
            className="block w-full rounded-2xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-4 border bg-white text-slate-900 outline-none transition-all appearance-none"
          >
            {friends.map(f => (
              <option key={f.id} value={f.id} className="text-slate-900">{f.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Split Method</label>
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button 
            type="button"
            onClick={() => setSplitType('equal')}
            className={cn(
              "flex-1 py-2 text-xs font-bold rounded-xl transition-all",
              splitType === 'equal' ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Equally
          </button>
          <button 
            type="button"
            onClick={() => setSplitType('custom')}
            className={cn(
              "flex-1 py-2 text-xs font-bold rounded-xl transition-all",
              splitType === 'custom' ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:text-slate-700"
            )}
          >
            Custom
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Split Details</label>
        <div className="space-y-2 border border-slate-100 rounded-[2rem] p-4 bg-slate-50/50">
          {friends.map(f => (
            <div key={f.id} className="flex items-center justify-between group">
              <div className="flex items-center space-x-3">
                <div 
                  onClick={() => toggleFriendSelection(f.id)}
                  className={cn(
                    "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer",
                    selectedFriendIds.includes(f.id) 
                      ? "bg-indigo-600 border-indigo-600 text-white" 
                      : "bg-white border-slate-300"
                  )}
                >
                  {selectedFriendIds.includes(f.id) && <Check className="w-3.5 h-3.5" strokeWidth={4} />}
                </div>
                <span className={cn(
                  "text-sm transition-colors",
                  selectedFriendIds.includes(f.id) ? "text-slate-900 font-bold" : "text-slate-400"
                )}>
                  {f.name} 
                  {f.id === payerId && (
                    <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full ml-2 font-black uppercase tracking-tighter">Payer</span>
                  )}
                </span>
              </div>
              
              {selectedFriendIds.includes(f.id) && (
                <div className="flex items-center space-x-3">
                  {splitType === 'custom' && (
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">₱</span>
                      <input
                        type="number"
                        step="0.01"
                        value={customSplits[f.id] || ''}
                        onChange={e => setCustomSplits({...customSplits, [f.id]: e.target.value})}
                        className="w-24 pl-5 pr-2 py-1.5 text-xs border border-slate-200 rounded-xl bg-white text-slate-900 outline-none focus:border-indigo-500 transition-all"
                        placeholder="0.00"
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={f.id === payerId}
                    onClick={() => togglePaidStatus(f.id)}
                    className={cn(
                      "flex items-center space-x-1 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      f.id === payerId || paidFriendIds.includes(f.id)
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700",
                      f.id === payerId && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {f.id === payerId || paidFriendIds.includes(f.id) ? (
                      <><Check className="w-3 h-3" strokeWidth={3} /><span>Settled</span></>
                    ) : (
                      <span>Unpaid</span>
                    )}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        {splitType === 'custom' && (
           <div className={cn(
            "text-right text-[10px] font-bold mt-1 flex items-center justify-end space-x-1",
            Math.abs((Object.values(customSplits) as string[]).reduce((sum: number, val: string) => sum + (parseFloat(val) || 0), 0) - (parseFloat(amount) || 0)) < 0.01
              ? "text-emerald-500"
              : "text-rose-500"
           )}>
             <Info className="w-3 h-3" />
             <span>
               ₱{(Object.values(customSplits) as string[]).reduce((sum: number, val: string) => sum + (parseFloat(val) || 0), 0).toFixed(2)} / {amount ? `₱${parseFloat(amount).toFixed(2)}` : '₱0.00'}
             </span>
           </div>
        )}
      </div>

      <div className="flex space-x-3 pt-4">
        <button 
          type="button" 
          onClick={onCancel} 
          className="flex-1 py-3 text-slate-600 border border-slate-200 rounded-2xl hover:bg-slate-50 text-sm font-bold transition-all"
        >
          Cancel
        </button>
        <button 
          type="submit" 
          className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 text-sm font-bold shadow-lg shadow-indigo-100 transition-all active:scale-95"
        >
          {expense ? 'Save Changes' : 'Add Bill'}
        </button>
      </div>
    </form>
  );
};

export default ExpenseForm;