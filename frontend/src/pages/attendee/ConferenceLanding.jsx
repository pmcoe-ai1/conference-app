import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ChevronRight, AlertCircle, FileText, Loader2 } from 'lucide-react';
import { conferenceAPI, authAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function ConferenceLanding() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const toast = useToast();

  const [conference, setConference] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('first');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => { loadConference(); }, [code]);

  const loadConference = async () => {
    try {
      const { data } = await conferenceAPI.getByCode(code);
      setConference(data);
      if (data.status !== 'active') setError('This conference is not currently active.');
    } catch (err) {
      setError('Conference not found. Please check the QR code.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !email.includes('@')) { setError('Please enter a valid email address'); return; }
    if (mode === 'return' && !password) { setError('Password is required'); return; }
    setSubmitting(true);
    try {
      const response = mode === 'first' 
        ? await authAPI.firstLogin(email, code)
        : await authAPI.attendeeLogin(email, password, code);
      const { token, attendee, conference: conf } = response.data;
      login({ ...attendee, type: 'attendee', conference: conf }, token);
      toast.success(`Welcome to ${conf.name}!`);
      navigate(`/c/${code}/survey`);
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData?.requiresPassword) { setMode('return'); setError('This email is already registered. Please enter your password.'); }
      else setError(errorData?.error || 'Login failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 flex items-center justify-center"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
      </div>
      <div className="relative w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-4"><FileText className="w-8 h-8 text-white" /></div>
            {conference ? (<><h1 className="text-2xl font-bold text-white mb-2">{conference.name}</h1><p className="text-purple-200 text-sm">{mode === 'return' ? 'Welcome back! Enter your credentials.' : 'Enter your email to get started.'}</p></>) : <h1 className="text-2xl font-bold text-white mb-2">Conference Not Found</h1>}
          </div>
          {conference && conference.status === 'active' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="block text-sm font-medium text-purple-200 mb-2">Email Address</label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-300" /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-400" placeholder="you@example.com" /></div></div>
              {mode === 'return' && (<div><label className="block text-sm font-medium text-purple-200 mb-2">Password</label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-300" /><input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-11 pr-12 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-400" placeholder="Enter your password" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-300 hover:text-white">{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button></div><button type="button" onClick={() => navigate(`/c/${code}/forgot-password`)} className="text-sm text-purple-300 hover:text-white mt-2">Forgot password?</button></div>)}
              {error && <div className="flex items-center gap-2 text-red-300 text-sm bg-red-500/20 px-4 py-3 rounded-lg"><AlertCircle size={18} /><span>{error}</span></div>}
              <button type="submit" disabled={submitting} className="w-full py-3 bg-white text-indigo-900 font-semibold rounded-xl hover:bg-purple-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2">{submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{mode === 'return' ? 'Sign In' : 'Continue'}<ChevronRight size={18} /></>}</button>
            </form>
          ) : <div className="text-center"><div className="bg-red-500/20 text-red-300 px-4 py-3 rounded-lg">{error || 'This conference is not available.'}</div></div>}
          {conference && conference.status === 'active' && <div className="mt-6 text-center"><button onClick={() => { setMode(mode === 'first' ? 'return' : 'first'); setError(''); setPassword(''); }} className="text-sm text-purple-300 hover:text-white">{mode === 'return' ? 'First time here? Register with email' : 'Already registered? Sign in'}</button></div>}
        </div>
        <p className="text-center text-purple-300/60 text-xs mt-6">By continuing, you agree to our Privacy Policy</p>
      </div>
    </div>
  );
}
