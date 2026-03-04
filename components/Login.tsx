
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Friend } from '../types';

interface LoginProps {
  friends: Friend[];
  onLogin: (friend: Friend) => void;
  onUpdatePin: (id: string, newPin: string) => Promise<void>;
}

const Login: React.FC<LoginProps> = ({ friends, onLogin, onUpdatePin }) => {
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFriend) {
      setError('Please select your profile');
      return;
    }

    if (isChangingPin) {
      if (newPin.length < 4) {
        setError('New PIN must be 4 digits');
        return;
      }
      if (newPin !== confirmPin) {
        setError('PINs do not match');
        return;
      }
      if (newPin === '1234') {
        setError('Please choose a PIN other than 1234');
        return;
      }

      setIsSyncing(true);
      try {
        await onUpdatePin(selectedFriend.id, newPin);
        onLogin({ ...selectedFriend, pin: newPin });
      } catch (err) {
        setError('Failed to update PIN. Try again.');
      } finally {
        setIsSyncing(false);
      }
      return;
    }

    // Verify PIN against the friend's pin property (defaults to '1234' if not set)
    const validPin = selectedFriend.pin || '1234';
    if (pin === validPin) {
      if (pin === '1234') {
        setIsChangingPin(true);
        setError('');
      } else {
        onLogin(selectedFriend);
      }
    } else {
      setError('Incorrect PIN. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl shadow-indigo-100 p-8 border border-white"
      >
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200 rotate-3">
            <span className="text-4xl">🦖</span>
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Sinigeng Hatian</h1>
          <p className="text-gray-500 font-medium mt-2">Welcome back! Please select your profile.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {!isChangingPin ? (
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase ml-1">Who are you?</label>
              <div className="grid grid-cols-2 gap-3">
                {friends.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setSelectedFriend(f);
                      setError('');
                    }}
                    className={`p-4 rounded-2xl border-2 transition-all text-left flex items-center space-x-3 ${
                      selectedFriend?.id === f.id 
                        ? 'border-indigo-600 bg-indigo-50 ring-4 ring-indigo-50' 
                        : 'border-gray-100 hover:border-indigo-200 bg-gray-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                      selectedFriend?.id === f.id ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {f.name.charAt(0).toUpperCase()}
                    </div>
                    <span className={`font-bold truncate ${selectedFriend?.id === f.id ? 'text-indigo-700' : 'text-gray-700'}`}>
                      {f.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 mb-4">
                <p className="text-xs font-bold text-indigo-700 uppercase mb-1">First Time Login</p>
                <p className="text-[10px] text-indigo-600 leading-tight">For security, please change your default PIN (1234) to something else.</p>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">New 4-Digit PIN</label>
                <input
                  type="password"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="••••"
                  maxLength={4}
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 text-center text-2xl tracking-[1em] font-black focus:border-indigo-600 focus:ring-0 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">Confirm New PIN</label>
                <input
                  type="password"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  placeholder="••••"
                  maxLength={4}
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 text-center text-2xl tracking-[1em] font-black focus:border-indigo-600 focus:ring-0 outline-none transition-all"
                />
              </div>
            </div>
          )}

          <AnimatePresence>
            {selectedFriend && !isChangingPin && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 overflow-hidden"
              >
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">Enter your 4-digit PIN</label>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••"
                  maxLength={4}
                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 text-center text-2xl tracking-[1em] font-black focus:border-indigo-600 focus:ring-0 outline-none transition-all"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <p className="text-rose-500 text-sm font-bold text-center animate-bounce">{error}</p>
          )}

          <button
            type="submit"
            className="w-full bg-indigo-600 text-white rounded-2xl py-4 font-black text-lg shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-1 active:translate-y-0 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
            disabled={isSyncing || (!isChangingPin && (!selectedFriend || pin.length < 4)) || (isChangingPin && (newPin.length < 4 || confirmPin.length < 4))}
          >
            {isSyncing ? 'Saving...' : isChangingPin ? 'Set New PIN & Sign In' : 'Sign In'}
          </button>
          
          {isChangingPin && (
            <button 
              type="button" 
              onClick={() => { setIsChangingPin(false); setPin(''); setNewPin(''); setConfirmPin(''); setError(''); }}
              className="w-full text-gray-400 text-xs font-bold uppercase hover:text-gray-600 transition-colors"
            >
              Cancel
            </button>
          )}
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-sm text-gray-400 font-black tracking-widest uppercase">
            Roooooor 🦖
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
