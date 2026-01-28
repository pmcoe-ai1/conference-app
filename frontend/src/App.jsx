import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

// Attendee Pages
import ConferenceLanding from './pages/attendee/ConferenceLanding';
import SurveyHub from './pages/attendee/SurveyHub';
import SurveyPage from './pages/attendee/SurveyPage';

// Admin Pages
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard, { DashboardHome } from './pages/admin/AdminDashboard';
import SurveysPage from './pages/admin/SurveysPage';
import StatisticsPage from './pages/admin/StatisticsPage';
import AttendeesPage from './pages/admin/AttendeesPage';
import PresenterMode from './pages/admin/PresenterMode';

// Protected Route Component
function ProtectedRoute({ children, requireAdmin = false }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-slate-600 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to={requireAdmin ? '/admin/login' : '/'} replace />;
  }
  
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }
  
  return children;
}

// Attendee Protected Route
function AttendeeRoute({ children }) {
  const { isAuthenticated, isAttendee, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-slate-600 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }
  
  if (!isAuthenticated || !isAttendee) {
    return <Navigate to="/" replace />;
  }
  
  return children;
}

// Home redirect
function HomeRedirect() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-bold text-white mb-4">Conference Survey</h1>
        <p className="text-slate-400 mb-8">Scan a conference QR code to participate in surveys, or login as an admin to manage conferences.</p>
        <a href="/admin/login" className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors">
          Admin Login
        </a>
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      {/* Home */}
      <Route path="/" element={<HomeRedirect />} />
      
      {/* Attendee Routes */}
      <Route path="/c/:code" element={<ConferenceLanding />} />
      <Route path="/c/:code/surveys" element={
        <AttendeeRoute>
          <SurveyHub />
        </AttendeeRoute>
      } />
      <Route path="/c/:code/survey/:surveyId" element={
        <AttendeeRoute>
          <SurveyPage />
        </AttendeeRoute>
      } />
      <Route path="/c/:code/forgot-password" element={<ConferenceLanding />} />
      
      {/* Admin Routes */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={
        <ProtectedRoute requireAdmin>
          <AdminDashboard />
        </ProtectedRoute>
      }>
        <Route index element={<DashboardHome />} />
        <Route path="surveys" element={<SurveysPage />} />
        <Route path="statistics" element={<StatisticsPage />} />
        <Route path="attendees" element={<AttendeesPage />} />
        <Route path="presenter" element={<PresenterMode />} />
      </Route>
      
      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
