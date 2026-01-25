import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink as RouterNavLink } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { Home, FileText, BarChart3, Users, Monitor, LogOut } from 'lucide-react';

// Admin Pages
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import SurveysPage from './pages/admin/SurveysPage';
import StatisticsPage from './pages/admin/StatisticsPage';
import AttendeesPage from './pages/admin/AttendeesPage';
import PresenterMode from './pages/admin/PresenterMode';

// Attendee Pages
import ConferenceLanding from './pages/attendee/ConferenceLanding';
import SurveyHub from './pages/attendee/SurveyHub';
import SurveyPage from './pages/attendee/SurveyPage';
import SurveyCompletion from './pages/attendee/SurveyCompletion';

// Protected Route for Admin
function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated || !isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
}

// Protected Route for Attendee
function AttendeeRoute({ children }) {
  const { isAuthenticated, isAttendee } = useAuth();
  if (!isAuthenticated || !isAttendee) {
    return <Navigate to="/" replace />;
  }
  return children;
}

// Admin Layout with Sidebar
function AdminLayout({ children }) {
  const { user, logout } = useAuth();
  
  const navItems = [
    { to: '/admin/dashboard', icon: Home, label: 'Dashboard' },
    { to: '/admin/surveys', icon: FileText, label: 'Surveys' },
    { to: '/admin/statistics', icon: BarChart3, label: 'Statistics' },
    { to: '/admin/attendees', icon: Users, label: 'Attendees' },
  ];
  
  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Sidebar */}
      <div className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <h1 className="text-xl font-bold text-white">Survey Admin</h1>
          <p className="text-sm text-slate-400 truncate">{user?.email}</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <RouterNavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </RouterNavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-700">
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </div>
      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Admin Routes */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={
              <AdminRoute><AdminLayout><AdminDashboard /></AdminLayout></AdminRoute>
            } />
            <Route path="/admin/surveys" element={
              <AdminRoute><AdminLayout><SurveysPage /></AdminLayout></AdminRoute>
            } />
            <Route path="/admin/statistics" element={
              <AdminRoute><AdminLayout><StatisticsPage /></AdminLayout></AdminRoute>
            } />
            <Route path="/admin/attendees" element={
              <AdminRoute><AdminLayout><AttendeesPage /></AdminLayout></AdminRoute>
            } />
            <Route path="/admin/presenter/:surveyId" element={
              <AdminRoute><PresenterMode /></AdminRoute>
            } />
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            
            {/* Attendee Routes */}
            <Route path="/c/:code" element={<SurveyHub />} />
            <Route path="/c/:code/login" element={<ConferenceLanding />} />
            <Route path="/c/:code/survey" element={
              <AttendeeRoute><SurveyPage /></AttendeeRoute>
            } />
            <Route path="/c/:code/survey/:surveyId" element={
              <AttendeeRoute><SurveyPage /></AttendeeRoute>
            } />
            <Route path="/c/:code/complete" element={
              <AttendeeRoute><SurveyCompletion /></AttendeeRoute>
            } />
            
            {/* Default */}
            <Route path="/" element={<Navigate to="/admin/login" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
