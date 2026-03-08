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
  const [date, setDate] = useState(expense?.date ? new Date(expense.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState(expense?.notes || '');
  const [proofOfPayment, setProofOfPayment] = useState<string[]>(expense?.proofOfPayment || []);
  
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [paidFriendIds, setPaidFriendIds] = useState<string[]>([]);
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({});

  useEffect(() => {
    if (expense?.splits) {
      const activeIds = expense.splits.filter((s: ExpenseSplit) => s.amount > 0).map((s: ExpenseSplit) => s.friendId);
      const settledIds = expense.splits.filter((s: ExpenseSplit) => s.isPaid).map((s: ExpenseSplit) => s.friendId);
      
      setSelectedFriendIds(activeIds);
      setPaidFriendIds(settledIds);
      
      const splitsObj: Record<string, string> = {};
      expense.splits.forEach((s: ExpenseSplit) => {
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
      date: new Date(date).toISOString(),
      notes,
      proofOfPayment
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles: string[] = [];
      Array.from(files).forEach(file => {
        if (file.size > 1024 * 1024) { // 1MB limit for base64
          alert(`File ${file.name} is too large. Please upload images smaller than 1MB.`);
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          setProofOfPayment(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeFile = (index: number) => {
    setProofOfPayment(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2.5 border bg-white text-gray-900 placeholder-gray-400"
          placeholder="Lunch, Groceries, etc."
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Amount</label>
          <div className="relative rounded-xl shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 text-sm">₱</span>
            </div>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="block w-full pl-7 pr-4 rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2.5 border bg-white text-gray-900"
              placeholder="0.00"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Paid By</label>
          <select
            value={payerId}
            onChange={e => setPayerId(e.target.value)}
            className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2.5 border bg-white text-gray-900"
          >
            {friends.map(f => (
              <option key={f.id} value={f.id} className="text-gray-900">{f.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2.5 border bg-white text-gray-900"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Split Method</label>
          <select
            value={splitType}
            onChange={e => setSplitType(e.target.value as 'equal' | 'custom')}
            className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2.5 border bg-white text-gray-900"
          >
            <option value="equal" className="text-gray-900">Equally</option>
            <option value="custom" className="text-gray-900">Custom Amounts</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Split Details</label>
        <div className="space-y-1.5 border border-gray-100/50 rounded-2xl p-3 bg-gray-50/50">
          {friends.map(f => (
            <div key={f.id} className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  checked={selectedFriendIds.includes(f.id)}
                  onChange={() => toggleFriendSelection(f.id)}
                  className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 bg-white"
                />
                <span className={`text-xs ${selectedFriendIds.includes(f.id) ? 'text-gray-900 font-bold' : 'text-gray-400 font-medium'}`}>
                  {f.name} {f.id === payerId && <span className="text-[8px] bg-indigo-100 text-indigo-600 px-1 rounded ml-1">PAYER</span>}
                </span>
              </div>
              
              {selectedFriendIds.includes(f.id) && (
                <div className="flex items-center space-x-2">
                  {splitType === 'custom' && (
                    <div className="relative">
                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">₱</span>
                      <input
                        type="number"
                        step="0.01"
                        value={customSplits[f.id] || ''}
                        onChange={e => setCustomSplits({...customSplits, [f.id]: e.target.value})}
                        className="w-16 pl-4 pr-1 py-1 text-[10px] border border-gray-200 rounded-lg bg-white text-gray-900 font-bold"
                        placeholder="0.00"
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={f.id === payerId}
                    onClick={() => togglePaidStatus(f.id)}
                    className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-[9px] font-black transition-all ${
                      f.id === payerId || paidFriendIds.includes(f.id)
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    } ${f.id === payerId ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
                  >
                    {f.id === payerId || paidFriendIds.includes(f.id) ? (
                      <><svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg><span>Settled</span></>
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
           <div className="text-right text-[10px] font-bold text-gray-400 mt-1">
             Sum: ₱{(Object.values(customSplits) as string[]).reduce((sum: number, val: string) => sum + (parseFloat(val) || 0), 0).toFixed(2)} / {amount ? `₱${parseFloat(amount).toFixed(2)}` : '₱0.00'}
           </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="block w-full rounded-xl border-gray-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2.5 border bg-white text-gray-900 placeholder-gray-400"
          placeholder="Add extra details..."
          rows={1}
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Proof of Payment</label>
        <div className="mt-1 flex items-center space-x-4">
          <label className="cursor-pointer bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors border border-indigo-100">
            <span>Upload Images</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
          {proofOfPayment.length > 0 && (
            <div className="flex flex-wrap gap-1.5 flex-1">
              {proofOfPayment.map((file, idx) => (
                <div key={idx} className="relative w-10 h-10 rounded-lg overflow-hidden border border-gray-200">
                  <img src={file} alt={`Proof ${idx + 1}`} className="w-full h-full object-cover" />
                  <button 
                    type="button" 
                    onClick={() => removeFile(idx)}
                    className="absolute top-0 right-0 bg-rose-500 text-white p-0.5 rounded-bl-lg"
                  >
                    <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex space-x-3 pt-4">
        <button type="button" onClick={onCancel} className="flex-1 py-2 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium">Cancel</button>
        <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-semibold">
          {expense ? 'Save Changes' : 'Add Expense'}
        </button>
      </div>
    </form>
  );
};

export default ExpenseForm;