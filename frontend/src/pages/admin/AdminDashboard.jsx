import React, { useState, useEffect } from 'react';
import { Plus, Calendar, QrCode, Download, Copy, Users, FileText, BarChart3, Play, Loader2 } from 'lucide-react';
import { conferenceAPI, statisticsAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Button, Modal, Input, Textarea, Card, StatusBadge, EmptyState, Spinner } from '../../components/ui';

export default function AdminDashboard() {
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
    if (!newConf.name || !newConf.startDate || !newConf.endDate) { 
      toast.error('Please fill required fields'); 
      return; 
    }
    setCreating(true);
    try {
      await conferenceAPI.create(newConf);
      toast.success('Conference created!');
      setShowCreateModal(false);
      setNewConf({ name: '', urlCode: '', description: '', startDate: '', endDate: '' });
      loadConferences();
    } catch (err) { 
      toast.error(err.response?.data?.error || 'Failed to create'); 
    }
    finally { setCreating(false); }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(`${window.location.origin}/c/${selectedConference.urlCode}`);
    toast.success('URL copied!');
  };

  const downloadQR = async (format) => {
    try {
      const response = format === 'png' 
        ? await conferenceAPI.downloadQRPng(selectedConference.id) 
        : await conferenceAPI.downloadQRSvg(selectedConference.id);
      const url = window.URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedConference.urlCode}-qr.${format}`;
      a.click();
    } catch (err) { toast.error('Download failed'); }
  };

  const handleActivate = async () => {
    try {
      await conferenceAPI.activate(selectedConference.id);
      toast.success('Conference activated!');
      loadConferences();
    } catch (err) { toast.error('Failed to activate'); }
  };

  if (loading) return <div className="flex-1 flex items-center justify-center"><Spinner size="lg" /></div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400">Manage your conferences</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}><Plus size={18} />New Conference</Button>
      </div>
      
      {/* Conference Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {conferences.map((conf) => (
          <Card 
            key={conf.id} 
            className={`p-5 cursor-pointer transition-all ${selectedConference?.id === conf.id ? 'ring-2 ring-indigo-500 bg-indigo-600/20' : 'hover:bg-slate-750'}`} 
            onClick={() => setSelectedConference(conf)}
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-white">{conf.name}</h3>
              <StatusBadge status={conf.status} />
            </div>
            <p className="text-sm text-slate-400 mb-3 line-clamp-2">{conf.description}</p>
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <span className="flex items-center gap-1">
                <Calendar size={14} />{conf.startDate?.split('T')[0]}
              </span>
              <span className="flex items-center gap-1">
                <Users size={14} />{conf.attendeeCount || 0}
              </span>
            </div>
          </Card>
        ))}
        {conferences.length === 0 && (
          <Card className="p-8 col-span-full">
            <EmptyState 
              icon={QrCode} 
              title="No conferences yet" 
              description="Create your first conference to get started" 
              action={<Button onClick={() => setShowCreateModal(true)}><Plus size={18} />Create Conference</Button>} 
            />
          </Card>
        )}
      </div>

      {/* Selected Conference Details */}
      {selectedConference && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">{selectedConference.name}</h2>
            {selectedConference.status === 'draft' && (
              <Button variant="secondary" onClick={handleActivate}>
                <Play size={16} /> Activate
              </Button>
            )}
          </div>
          
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-500/20 rounded-lg"><Users className="w-5 h-5 text-blue-400" /></div>
                <span className="text-slate-400 text-sm">Attendees</span>
              </div>
              <p className="text-2xl font-bold text-white">{summary?.totalAttendees || 0}</p>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-500/20 rounded-lg"><FileText className="w-5 h-5 text-purple-400" /></div>
                <span className="text-slate-400 text-sm">Surveys</span>
              </div>
              <p className="text-2xl font-bold text-white">{summary?.totalSurveys || 0}</p>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-500/20 rounded-lg"><BarChart3 className="w-5 h-5 text-emerald-400" /></div>
                <span className="text-slate-400 text-sm">Responses</span>
              </div>
              <p className="text-2xl font-bold text-white">{summary?.totalResponses || 0}</p>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-amber-500/20 rounded-lg"><Play className="w-5 h-5 text-amber-400" /></div>
                <span className="text-slate-400 text-sm">Participation</span>
              </div>
              <p className="text-2xl font-bold text-white">{summary?.overallParticipationRate || 0}%</p>
            </Card>
          </div>

          {/* QR Code & Share Section */}
          <Card className="p-6">
            <h3 className="text-white font-medium mb-4">Share Conference</h3>
            <div className="flex flex-col md:flex-row gap-6">
              <div className="bg-white p-4 rounded-lg w-fit">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(window.location.origin + '/c/' + selectedConference.urlCode)}`}
                  alt="QR Code"
                  className="w-36 h-36"
                />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <label className="text-sm text-slate-400">Conference URL</label>
                  <div className="flex gap-2 mt-1">
                    <input 
                      readOnly 
                      value={`${window.location.origin}/c/${selectedConference.urlCode}`}
                      className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                    />
                    <Button variant="secondary" onClick={copyUrl}><Copy size={16} /></Button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => downloadQR('png')}><Download size={16} /> PNG</Button>
                  <Button variant="secondary" onClick={() => downloadQR('svg')}><Download size={16} /> SVG</Button>
                </div>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* Create Modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Conference">
        <div className="space-y-4">
          <Input 
            label="Conference Name *" 
            value={newConf.name} 
            onChange={(e) => setNewConf({ ...newConf, name: e.target.value })} 
            placeholder="PMI Global Summit 2026" 
          />
          <Input 
            label="URL Code" 
            value={newConf.urlCode} 
            onChange={(e) => setNewConf({ ...newConf, urlCode: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') })} 
            placeholder="Auto-generated if empty" 
          />
          <Textarea 
            label="Description" 
            value={newConf.description} 
            onChange={(e) => setNewConf({ ...newConf, description: e.target.value })} 
            rows={3} 
            placeholder="Conference description..." 
          />
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Start Date *" 
              type="date" 
              value={newConf.startDate} 
              onChange={(e) => setNewConf({ ...newConf, startDate: e.target.value })} 
            />
            <Input 
              label="End Date *" 
              type="date" 
              value={newConf.endDate} 
              onChange={(e) => setNewConf({ ...newConf, endDate: e.target.value })} 
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
          <Button onClick={handleCreate} loading={creating}>Create Conference</Button>
        </div>
      </Modal>
    </div>
  );
}
