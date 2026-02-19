import React, { useState, useEffect } from 'react';
import { Friend, Expense, ExpenseSplit } from '../types';

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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Description</label>
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border bg-white text-gray-900 placeholder-gray-400"
          placeholder="Lunch, Groceries, etc."
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Amount</label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">₱</span>
            </div>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="block w-full pl-7 pr-4 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border bg-white text-gray-900"
              placeholder="0.00"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Paid By</label>
          <select
            value={payerId}
            onChange={e => setPayerId(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border bg-white text-gray-900"
          >
            {friends.map(f => (
              <option key={f.id} value={f.id} className="text-gray-900">{f.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">How to Split?</label>
        <select
          value={splitType}
          onChange={e => setSplitType(e.target.value as 'equal' | 'custom')}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border bg-white text-gray-900"
        >
          <option value="equal" className="text-gray-900">Equally</option>
          <option value="custom" className="text-gray-900">Custom Amounts</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Split Details:</label>
        <div className="space-y-2 border rounded-xl p-3 bg-gray-50">
          {friends.map(f => (
            <div key={f.id} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <input 
                  type="checkbox" 
                  checked={selectedFriendIds.includes(f.id)}
                  onChange={() => toggleFriendSelection(f.id)}
                  className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 bg-white"
                />
                <span className={`text-sm ${selectedFriendIds.includes(f.id) ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                  {f.name} {f.id === payerId && <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1 rounded ml-1">PAYER</span>}
                </span>
              </div>
              
              {selectedFriendIds.includes(f.id) && (
                <div className="flex items-center space-x-4">
                  {splitType === 'custom' && (
                    <input
                      type="number"
                      step="0.01"
                      value={customSplits[f.id] || ''}
                      onChange={e => setCustomSplits({...customSplits, [f.id]: e.target.value})}
                      className="w-20 p-1 text-xs border rounded bg-white text-gray-900"
                      placeholder="Amount"
                    />
                  )}
                  <button
                    type="button"
                    disabled={f.id === payerId}
                    onClick={() => togglePaidStatus(f.id)}
                    className={`flex items-center space-x-1 px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${
                      f.id === payerId || paidFriendIds.includes(f.id)
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    } ${f.id === payerId ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {f.id === payerId || paidFriendIds.includes(f.id) ? (
                      <><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg><span>Settled</span></>
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
           <div className="text-right text-xs text-gray-500 mt-1">
             Sum: ₱{(Object.values(customSplits) as string[]).reduce((sum: number, val: string) => sum + (parseFloat(val) || 0), 0).toFixed(2)} / {amount ? `₱${parseFloat(amount).toFixed(2)}` : '₱0.00'}
           </div>
        )}
      </div>

      <div className="flex space-x-3 pt-4">
        <button type="button" onClick={onCancel} className="flex-1 py-2 text-gray-700 border rounded-lg hover:bg-gray-50 text-sm font-medium">Cancel</button>
        <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-semibold">
          {expense ? 'Save Changes' : 'Add Expense'}
        </button>
      </div>
    </form>
  );
};

export default ExpenseForm;