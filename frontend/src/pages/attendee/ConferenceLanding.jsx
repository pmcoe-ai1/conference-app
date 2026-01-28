import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { conferenceAPI, authAPI } from '../../services/api';
import { Button, Input, Card, Spinner } from '../../components/ui';
import { Calendar, Users, Mail, Lock, User } from 'lucide-react';

export default function ConferenceLanding() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { login, isAuthenticated, isAttendee } = useAuth();
  const toast = useToast();
  
  const [conference, setConference] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState('register'); // 'register' or 'login'
  
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password: ''
  });

  useEffect(() => {
    loadConference();
  }, [code]);

  useEffect(() => {
    if (isAuthenticated && isAttendee) {
      navigate(`/c/${code}/surveys`);
    }
  }, [isAuthenticated, isAttendee]);

  const loadConference = async () => {
    try {
      const { data } = await conferenceAPI.getByCode(code);
      setConference(data);
    } catch (err) {
      toast.error('Conference not found');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.firstName || !formData.lastName) {
      toast.error('Please fill in all fields');
      return;
    }
    
    setSubmitting(true);
    try {
      const { data } = await authAPI.firstLogin(
        formData.email, 
        formData.firstName,
        formData.lastName,
        code
      );
      
      login({
        id: data.attendee.id,
        email: data.attendee.email,
        firstName: data.attendee.firstName,
        lastName: data.attendee.lastName,
        type: 'attendee',
        conferenceId: data.conference.id
      }, data.token);
      
      if (data.generatedPassword) {
        toast.success(`Your password is: ${data.generatedPassword}`, 10000);
      }
      
      navigate(`/c/${code}/survey`);
    } catch (err) {
      if (err.response?.data?.requiresPassword) {
        setMode('login');
        toast.info('You are already registered. Please login.');
      } else {
        toast.error(err.response?.data?.error || 'Registration failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      toast.error('Please enter email and password');
      return;
    }
    
    setSubmitting(true);
    try {
      const { data } = await authAPI.attendeeLogin(formData.email, formData.password, code);
      
      login({
        id: data.attendee.id,
        email: data.attendee.email,
        firstName: data.attendee.firstName,
        lastName: data.attendee.lastName,
        type: 'attendee',
        conferenceId: data.conference.id
      }, data.token);
      
      navigate(`/c/${code}/survey`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!conference) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <h1 className="text-2xl font-bold text-white mb-4">Conference Not Found</h1>
          <p className="text-slate-400">The conference code "{code}" does not exist.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">{conference.name}</h1>
          {conference.description && (
            <p className="text-slate-400 text-sm mb-4">{conference.description}</p>
          )}
          <div className="flex items-center justify-center gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <Calendar size={14} />
              {new Date(conference.startDate).toLocaleDateString()}
            </span>
          </div>
        </div>

        {mode === 'register' ? (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="First Name"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>
            
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            
            <Button type="submit" className="w-full" loading={submitting}>
              Join Conference
            </Button>
            
            <p className="text-center text-sm text-slate-400">
              Already registered?{' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-indigo-400 hover:text-indigo-300"
              >
                Sign in
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="password"
                placeholder="Password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            
            <Button type="submit" className="w-full" loading={submitting}>
              Sign In
            </Button>
            
            <p className="text-center text-sm text-slate-400">
              New attendee?{' '}
              <button
                type="button"
                onClick={() => setMode('register')}
                className="text-indigo-400 hover:text-indigo-300"
              >
                Register
              </button>
            </p>
          </form>
        )}
      </Card>
    </div>
  );
}
