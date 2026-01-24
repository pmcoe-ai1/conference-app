import React from 'react';
import { X, Loader2 } from 'lucide-react';

// Button component
export function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  loading = false, 
  disabled = false,
  className = '',
  ...props 
}) {
  const variants = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    secondary: 'bg-slate-700 hover:bg-slate-600 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    ghost: 'bg-transparent hover:bg-slate-800 text-slate-300',
    outline: 'border border-slate-600 hover:bg-slate-800 text-white'
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  };

  return (
    <button
      className={`
        ${variants[variant]} 
        ${sizes[size]} 
        rounded-lg font-medium transition-colors 
        disabled:opacity-50 disabled:cursor-not-allowed
        flex items-center justify-center gap-2
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 size={18} className="animate-spin" />}
      {children}
    </button>
  );
}

// Input component
export function Input({ label, error, className = '', ...props }) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-sm font-medium text-slate-300">{label}</label>}
      <input
        className={`
          w-full px-4 py-3 bg-slate-800 border rounded-xl text-white placeholder-slate-400
          transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500
          ${error ? 'border-red-500' : 'border-slate-700 focus:border-indigo-500'}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

// Select component
export function Select({ label, error, children, className = '', ...props }) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-sm font-medium text-slate-300">{label}</label>}
      <select
        className={`
          w-full px-4 py-3 bg-slate-800 border rounded-xl text-white
          transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500
          ${error ? 'border-red-500' : 'border-slate-700 focus:border-indigo-500'}
          ${className}
        `}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

// Textarea component
export function Textarea({ label, error, className = '', ...props }) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-sm font-medium text-slate-300">{label}</label>}
      <textarea
        className={`
          w-full px-4 py-3 bg-slate-800 border rounded-xl text-white placeholder-slate-400
          transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none
          ${error ? 'border-red-500' : 'border-slate-700 focus:border-indigo-500'}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

// Modal component
export function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className={`bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full ${sizes[size]} max-h-[90vh] overflow-hidden animate-scale-in`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[calc(90vh-80px)]">
          {children}
        </div>
      </div>
    </div>
  );
}

// Status Badge component
export function StatusBadge({ status }) {
  const styles = {
    active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    inactive: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    draft: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    first_login: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    locked: 'bg-red-500/20 text-red-400 border-red-500/30',
    archived: 'bg-slate-500/20 text-slate-500 border-slate-500/30',
    pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    sent: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30'
  };

  const labels = {
    active: 'Active',
    inactive: 'Inactive',
    draft: 'Draft',
    first_login: 'Pending Password',
    locked: 'Locked',
    archived: 'Archived',
    pending: 'Pending',
    sent: 'Sent',
    failed: 'Failed'
  };

  return (
    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${styles[status] || styles.inactive}`}>
      {labels[status] || status}
    </span>
  );
}

// Card component
export function Card({ children, className = '', ...props }) {
  return (
    <div 
      className={`bg-slate-800 border border-slate-700 rounded-xl ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

// Loading Spinner
export function Spinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  return (
    <div className={`${sizes[size]} border-2 border-slate-600 border-t-indigo-500 rounded-full animate-spin ${className}`} />
  );
}

// Loading Screen
export function LoadingScreen({ message = 'Loading...' }) {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <Spinner size="lg" className="mx-auto mb-4" />
        <p className="text-slate-400">{message}</p>
      </div>
    </div>
  );
}

// Empty State
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="text-center py-12">
      {Icon && (
        <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-800 rounded-2xl mb-4">
          <Icon className="w-8 h-8 text-slate-500" />
        </div>
      )}
      <h3 className="text-lg font-medium text-white mb-2">{title}</h3>
      {description && <p className="text-slate-400 mb-4">{description}</p>}
      {action}
    </div>
  );
}
