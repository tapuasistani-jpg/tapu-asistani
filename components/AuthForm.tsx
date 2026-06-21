'use client';
import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AuthForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = isSignUp 
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    
    if (error) setMessage(error.message);
    else onSuccess();
    setLoading(false);
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="border p-2 rounded text-black" />
        <input type="password" placeholder="Şifre" value={password} onChange={e => setPassword(e.target.value)} className="border p-2 rounded text-black" />
        <button type="submit" disabled={loading} className="bg-blue-600 text-white p-2 rounded">
          {isSignUp ? 'Kaydol' : 'Giriş Yap'}
        </button>
      </form>
    </div>
  );
}