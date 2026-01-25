import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import { Home, FileText, BarChart3, Users, Presentation, LogOut, Menu, Plus, Calendar, QrCode, Download, Copy, Settings, ChevronDown, Loader2, Play, Pause, ExternalLink } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { conferenceAPI, surveyAPI, statisticsAPI, attendeeAPI, exportAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button, Modal, Input, Textarea, Card, StatusBadge, EmptyState, Spinner } from '../../components/ui';
import socketService from '../../services/socket';

// Sidebar Component
function Sidebar({ currentPath, collapsed, onToggle }) {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const navItems = [
    { path: '/admin', icon: Home, label: 'Dashboard', exact: true },
    { path: '/admin/surveys', icon: FileText, label: 'Surveys' },
    { path: '/admin/statistics', icon: BarChart3, label: 'Statistics' },
    { path: '/admin/attendees', icon: Users, label: 'Attendees' },
    { path: '/admin/presenter', icon: Presentation, label: 'Presenter Mode' }
  ];
  const isActive = (item) => item.exact ? currentPath === item.path : currentPath.startsWith(item.path);
  return (
    <div className={`bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        {!collapsed && <span className="font-bold text-white">ConferenceSurvey</span>}
        <button onClick={onToggle} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"><Menu size={20} /></button>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <button key={item.path} onClick={() => navigate(item.path)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive(item) ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            <item.icon size={20} />{!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>
      <div className="p-3 border-t border-slate-800">
        {!collapsed && <div className="px-3 py-2 text-sm text-slate-500 truncate">{user?.email}</div>}
        <button onClick={() => { logout(); navigate('/admin/login'); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
          <LogOut size={20} />{!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );
}

// Main Dashboard Layout
export default function AdminDashboard() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="min-h-screen bg-slate-900 flex">
      <Sidebar currentPath={location.pathname} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className="flex-1 overflow-auto"><Outlet /></div>
    </div>
  );
}

// Dashboard Home
export function DashboardHome() {
  const navigate = useNavigate();
  const toast = useToast();
  const [conferences, setConferences] = useState([]);
  const [selectedConference, setSelectedConference] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newConf, setNewConf] = useState({ name: '', urlCode: '', description: '', startDate: '', endDate: '' });
  const [summary, setSummary] = useState(null);

  useEffect(() => { loadConferences(); }, []);
  useEffect(() => { if (selectedConference) loadSummary(); }, [selectedConference]);

  const loadConferences = async () => {
    try {
      const { data } = await conferenceAPI.list();
      setConferences(data);
      if (data.length > 0) setSelectedConference(data[0]);
    } catch (err) { toast.error('Failed to load conferences'); }
    finally { setLoading(false); }
  };

  const loadSummary = async () => {
    try {
      const { data } = await statisticsAPI.getConferenceSummary(selectedConference.id);
      setSummary(data);
    } catch (err) { console.error(err); }
  };

  const handleCreate = async () => {
    if (!newConf.name || !newConf.startDate || !newConf.endDate) { toast.error('Please fill required fields'); return; }
    setCreating(true);
    try {
      await conferenceAPI.create(newConf);
      toast.success('Conference created!');
      setShowCreateModal(false);
      setNewConf({ name: '', urlCode: '', description: '', startDate: '', endDate: '' });
      loadConferences();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to create'); }
    finally { setCreating(false); }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(`${window.location.origin}/c/${selectedConference.urlCode}`);
    toast.success('URL copied!');
  };

  const downloadQR = async (format) => {
    try {
      const response = format === 'png' ? await conferenceAPI.downloadQRPng(selectedConference.id) : await conferenceAPI.downloadQRSvg(selectedConference.id);
      const url = window.URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedConference.urlCode}-qr.${format}`;
      a.click();
    } catch (err) { toast.error('Download failed'); }
  };

  if (loading) return <div className="flex-1 flex items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-white">Dashboard</h1><p className="text-slate-400">Manage your conferences</p></div>
        <Button onClick={() => setShowCreateModal(true)}><Plus size={18} />New Conference</Button>
      </div>
      
      {/* Conference Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {conferences.map((conf) => (
          <Card key={conf.id} className={`p-5 cursor-pointer transition-all ${selectedConference?.id === conf.id ? 'ring-2 ring-indigo-500 bg-indigo-600/20' : 'hover:bg-slate-750'}`} onClick={() => setSelectedConference(conf)}>
            <div className="flex items-start justify-between mb-3"><h3 className="font-semibold text-white">{conf.name}</h3><StatusBadge status={conf.status} /></div>
            <p className="text-sm text-slate-400 mb-3 line-clamp-2">{conf.description}</p>
            <div className="flex items-center gap-4 text-sm text-slate-500"><span className="flex items-center gap-1"><Calendar size={14} />{conf.startDate?.split('T')[0]}</span><span className="flex items-center gap-1"><Users size={14} />{conf.attendeeCount || 0}</span></div>
          </Card>
        ))}
        {conferences.length === 0 && <Card className="p-8 col-span-full"><EmptyState icon={QrCode} title="No conferences yet" description="Create your first conference to get started" action={<Button onClick={() => setShowCreateModal(true)}><Plus size={18} />Create Conference</Button>} /></Card>}
      </div>

      {/* Selected Conference Details */}
      {selectedConference && (
        <>
          <h2 className="text-lg font-semibold text-white mb-4">{selectedConference.name}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="p-5"><div className="flex items-center gap-3 mb-2"><div className="p-2 bg-blue-500/20 rounded-lg"><Users className="w-5 h-5 text-blue-400" /></div><span className="text-slate-400 text-sm">Attendees</span></div><p className="text-2xl font-bold text-white">{summary?.totalAttendees || 0}</p></Card>
            <Card className="p-5"><div className="flex items-center gap-3 mb-2"><div className="p-2 bg-purple-500/20 rounded-lg"><FileText className="w-5 h-5 text-purple-400" /></div><span className="text-slate-400 text-sm">Surveys</span></div><p className="text-2xl font-bold text-white">{summary?.totalSurveys || 0}</p></Card>
            <Card className="p-5"><div className="flex items-center gap-3 mb-2"><div className="p-2 bg-emerald-500/20 rounded-lg"><BarChart3 className="w-5 h-5 text-emerald-400" /></div><span className="text-slate-400 text-sm">Responses</span></div><p className="text-2xl font-bold text-white">{summary?.totalResponses || 0}</p></Card>
            <Card className="p-5"><div className="flex items-center gap-3 mb-2"><div className="p-2 bg-amber-500/20 rounded-lg"><Play className="w-5 h-5 text-amber-400" /></div><span className="text-slate-400 text-sm">Participation</span></div><p className="text-2xl font-bold text-white">{summary?.overallParticipationRate || 0}%</p></Card>
          </div>

          {/* QR Code */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Conference QR Code</h3>
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="bg-white p-4 rounded-xl"><QRCodeSVG value={`${window.location.origin}/c/${selectedConference.urlCode}`} size={180} /></div>
              <div className="flex-1">
                <p className="text-slate-400 mb-4">Attendees can scan this QR code to access the conference.</p>
                <div className="bg-slate-900 rounded-lg p-3 mb-4 flex items-center gap-2">
                  <code className="text-indigo-400 flex-1 text-sm truncate">{window.location.origin}/c/{selectedConference.urlCode}</code>
                  <button onClick={copyUrl} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white"><Copy size={16} /></button>
                  <a href={`/c/${selectedConference.urlCode}`} target="_blank" className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white"><ExternalLink size={16} /></a>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => downloadQR('png')}><Download size={16} />PNG</Button>
                  <Button variant="secondary" onClick={() => downloadQR('svg')}><Download size={16} />SVG</Button>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Conference" size="lg">
        <div className="space-y-4">
          <Input label="Conference Name *" value={newConf.name} onChange={(e) => setNewConf({ ...newConf, name: e.target.value })} placeholder="PMI Global Summit 2026" />
          <Input label="URL Code" value={newConf.urlCode} onChange={(e) => setNewConf({ ...newConf, urlCode: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') })} placeholder="Auto-generated if empty" />
          <Textarea label="Description" value={newConf.description} onChange={(e) => setNewConf({ ...newConf, description: e.target.value })} rows={3} placeholder="Conference description..." />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Date *" type="date" value={newConf.startDate} onChange={(e) => setNewConf({ ...newConf, startDate: e.target.value })} />
            <Input label="End Date *" type="date" value={newConf.endDate} onChange={(e) => setNewConf({ ...newConf, endDate: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={creating}>Create Conference</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
