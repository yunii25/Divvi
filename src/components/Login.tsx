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
  const [error, setError] = useState('');
  const [isSettingPin, setIsSettingPin] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedFriend && inputRef.current) {
      inputRef.current.focus();
    }
  }, [selectedFriend]);

  const handleLogin = () => {
    if (!selectedFriend) return;
    
    if (!selectedFriend.pin) {
      setIsSettingPin(true);
      return;
    }

    if (pin === selectedFriend.pin) {
      onLogin(selectedFriend);
    } else {
      setError('Incorrect PIN');
      setPin('');
      inputRef.current?.focus();
    }
  };

  const handleSetPin = async () => {
    if (!selectedFriend || pin.length !== 4) return;
    try {
      await onUpdatePin(selectedFriend.id, pin);
      onLogin({ ...selectedFriend, pin });
    } catch (err) {
      setError('Failed to set PIN');
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

        <div className="mb-6 p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-3">
          <div className="mt-0.5 text-emerald-600">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 4.946-2.56 9.29-6.433 11.717A11.99 11.99 0 0110 19.056c-1.336 0-2.603-.218-3.784-.622-3.873-2.427-6.433-6.77-6.433-11.717 0-.68.056-1.35.166-2.001zm8.334 1.5a1 1 0 10-2 0v4a1 1 0 00.293.707l2 2a1 1 0 001.414-1.414L10.5 10.086V6.499z" clipRule="evenodd" /></svg>
          </div>
          <div className="text-[10px] text-emerald-800 leading-tight">
            <span className="font-bold">Secure Access:</span> This is a private bill-splitting app. Your data is encrypted and stored securely via Supabase.
          </div>
        </div>

        {!selectedFriend ? (
          <div className="grid grid-cols-2 gap-4">
            {friends.map((friend) => (
              <button
                key={friend.id}
                onClick={() => setSelectedFriend(friend)}
                className="flex flex-col items-center p-4 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all group"
              >
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-indigo-100 transition-colors">
                  <User className="text-slate-400 group-hover:text-indigo-600" size={24} />
                </div>
                <span className="font-medium text-slate-700">{friend.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                <User className="text-indigo-600" size={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-500">Logging in as</p>
                <p className="font-semibold text-slate-900">{selectedFriend.name}</p>
              </div>
              <button 
                onClick={() => {
                  setSelectedFriend(null);
                  setPin('');
                  setError('');
                  setIsSettingPin(false);
                }}
                className="text-sm text-indigo-600 font-medium hover:underline"
              >
                Change
              </button>
            </div>

            <div className="space-y-2 relative">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <KeyRound size={16} />
                {isSettingPin ? 'Set your 4-digit PIN' : 'Enter your 4-digit PIN'}
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
                    isSettingPin ? handleSetPin() : handleLogin();
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setPin(val);
                  if (val.length === 4) {
                    setError('');
                  }
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-default"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-sm text-rose-500 text-center font-medium">{error}</p>
            )}

            <button
              onClick={isSettingPin ? handleSetPin : handleLogin}
              disabled={pin.length !== 4}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 disabled:shadow-none transition-all"
            >
              {isSettingPin ? 'Set PIN & Login' : 'Login'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
