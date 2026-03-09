import React, { useState, useRef, useEffect } from 'react';
import { Friend } from '../types';
import { Lock, User, KeyRound } from 'lucide-react';

interface LoginProps {
  friends: Friend[];
  onLogin: (user: Friend) => void;
  onUpdatePin: (id: string, pin: string) => Promise<void>;
}

const Login: React.FC<LoginProps> = ({ friends, onLogin, onUpdatePin }) => {
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [isSettingPin, setIsSettingPin] = useState(false);
  const [isConfirmingPin, setIsConfirmingPin] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedFriend) {
      if (!selectedFriend.pin) {
        setIsSettingPin(true);
      } else {
        setIsSettingPin(false);
      }
      setIsConfirmingPin(false);
      setPin('');
      setError('');
      
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, [selectedFriend]);

  const handleLogin = (pinToUse?: string) => {
    const currentPin = pinToUse !== undefined ? pinToUse : pin;
    if (!selectedFriend) return;
    
    // If friend has no PIN, they MUST set one first
    if (!selectedFriend.pin) {
      setIsSettingPin(true);
      setPin('');
      setError('');
      return;
    }

    if (currentPin === selectedFriend.pin) {
      onLogin(selectedFriend);
    } else {
      setError('Incorrect PIN');
      setPin('');
      inputRef.current?.focus();
    }
  };

  const handleSetPin = (pinToUse?: string) => {
    const currentPin = pinToUse !== undefined ? pinToUse : pin;
    if (!selectedFriend || currentPin.length !== 4) return;
    setIsConfirmingPin(true);
    setConfirmPin(currentPin);
    setError('');
    setPin(''); 
  };

  const handleConfirmPin = async (confirmedPin: string) => {
    if (!selectedFriend || !isSettingPin) return;
    
    if (confirmedPin !== confirmPin) {
      setError('PINs do not match. Try again.');
      setIsConfirmingPin(false);
      setPin('');
      setConfirmPin('');
      return;
    }

    try {
      await onUpdatePin(selectedFriend.id, confirmedPin);
      onLogin({ ...selectedFriend, pin: confirmedPin });
    } catch (err) {
      setError('Failed to save PIN');
    }
  };

  const focusInput = () => {
    inputRef.current?.focus();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
            <Lock className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome to Sinigeng Hatian</h1>
          <p className="text-slate-500 mt-2">Select your profile to continue</p>
        </div>

        {!selectedFriend ? (
          <div className="grid grid-cols-2 gap-4">
            {friends.map((friend) => (
              <button
                key={friend.id}
                onClick={() => setSelectedFriend(friend)}
                className="flex flex-col items-center p-4 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all group"
              >
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3 group-hover:scale-105 transition-all overflow-hidden border-2 border-transparent group-hover:border-indigo-200 shadow-sm">
                  {friend.avatar ? (
                    <img src={friend.avatar} alt={friend.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full bg-slate-100 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                      <User className="text-slate-400 group-hover:text-indigo-600" size={28} />
                    </div>
                  )}
                </div>
                <span className="font-bold text-slate-700 text-sm">{friend.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-sm">
                {selectedFriend.avatar ? (
                  <img src={selectedFriend.avatar} alt={selectedFriend.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-indigo-100 flex items-center justify-center">
                    <User className="text-indigo-600" size={24} />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Logging in as</p>
                <p className="font-bold text-slate-900">{selectedFriend.name}</p>
              </div>
              <button 
                onClick={() => {
                  setSelectedFriend(null);
                  setPin('');
                  setError('');
                  setIsSettingPin(false);
                  setIsConfirmingPin(false);
                }}
                className="text-sm text-indigo-600 font-medium hover:underline"
              >
                Change
              </button>
            </div>

            <div className="space-y-2 relative">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <KeyRound size={16} />
                {isConfirmingPin 
                  ? 'Confirm your 4-digit PIN' 
                  : isSettingPin 
                    ? 'Set your new 4-digit PIN' 
                    : 'Enter your 4-digit PIN'}
              </label>
              <div 
                className="flex gap-3 justify-center cursor-pointer relative z-10"
                onClick={focusInput}
              >
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`w-12 h-14 rounded-xl border-2 flex items-center justify-center text-xl font-bold transition-all ${
                      pin.length > i 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-600' 
                        : 'border-slate-200 bg-white'
                    } ${pin.length === i ? 'ring-2 ring-indigo-200 border-indigo-400' : ''}`}
                  >
                    {pin.length > i ? '•' : ''}
                  </div>
                ))}
              </div>
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pin}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && pin.length === 4) {
                    if (isConfirmingPin) {
                      handleConfirmPin(pin);
                    } else if (isSettingPin) {
                      handleSetPin();
                    } else {
                      handleLogin();
                    }
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setPin(val);
                  if (val.length === 4) {
                    setError('');
                    // Auto-advance
                    if (isConfirmingPin) {
                      // We need to capture the value because state update is async
                      setTimeout(() => handleConfirmPin(val), 100);
                    } else if (isSettingPin) {
                      // Store the first PIN and move to confirmation
                      setTimeout(() => handleSetPin(val), 100);
                    } else {
                      // Normal login
                      setTimeout(() => handleLogin(val), 100);
                    }
                  }
                }}
                className="absolute inset-0 w-full h-full opacity-0 caret-transparent text-transparent bg-transparent outline-none cursor-default select-none z-20"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-sm text-rose-500 text-center font-medium">{error}</p>
            )}

            <button
              onClick={() => {
                if (isConfirmingPin) {
                  handleConfirmPin(pin);
                } else if (isSettingPin) {
                  handleSetPin();
                } else {
                  handleLogin();
                }
              }}
              disabled={pin.length !== 4}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none transition-all"
            >
              {isConfirmingPin ? 'Confirm PIN' : isSettingPin ? 'Next' : 'Login'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
