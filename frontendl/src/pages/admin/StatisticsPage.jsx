import React, { useState, useEffect } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Download, RefreshCw, Loader2 } from 'lucide-react';
import { conferenceAPI, surveyAPI, statisticsAPI, exportAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Button, Card, Select } from '../../components/ui';
import socketService from '../../services/socket';

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6'];

export default function StatisticsPage() {
  const toast = useToast();
  const [conferences, setConferences] = useState([]);
  const [selectedConference, setSelectedConference] = useState(null);
  const [surveys, setSurveys] = useState([]);
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadConferences(); }, []);
  useEffect(() => { if (selectedConference) loadSurveys(); }, [selectedConference]);
  useEffect(() => { if (selectedSurvey) loadStats(); }, [selectedSurvey]);
  
  useEffect(() => {
    if (selectedConference) {
      socketService.connect();
      socketService.joinConference(selectedConference.id);
      socketService.on('stats_update', handleStatsUpdate);
      socketService.on('new_response', handleStatsUpdate);
      return () => {
        socketService.off('stats_update', handleStatsUpdate);
        socketService.off('new_response', handleStatsUpdate);
        socketService.leaveConference(selectedConference.id);
      };
    }
  }, [selectedConference]);

  const handleStatsUpdate = () => { if (selectedSurvey) loadStats(); };

  const loadConferences = async () => {
    try {
      const { data } = await conferenceAPI.list();
      setConferences(data);
      if (data.length > 0) setSelectedConference(data[0]);
    } catch (err) { toast.error('Failed to load conferences'); }
    finally { setLoading(false); }
  };

  const loadSurveys = async () => {
    try {
      const { data } = await surveyAPI.listByConference(selectedConference.id);
      setSurveys(data);
      if (data.length > 0) setSelectedSurvey(data[0]);
    } catch (err) { toast.error('Failed to load surveys'); }
  };

  const loadStats = async () => {
    setRefreshing(true);
    try {
      const { data } = await statisticsAPI.getSurveyStats(selectedSurvey.id);
      setStats(data);
    } catch (err) { toast.error('Failed to load statistics'); }
    finally { setRefreshing(false); }
  };

  const downloadCSV = async () => {
    try {
      const response = await exportAPI.surveyCSV(selectedSurvey.id);
      const url = window.URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedSurvey.title.replace(/\s+/g, '_')}_responses.csv`;
      a.click();
      toast.success('CSV downloaded');
    } catch (err) { toast.error('Download failed'); }
  };

  const downloadPDF = async () => {
    try {
      const response = await exportAPI.surveyPDF(selectedSurvey.id);
      const url = window.URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedSurvey.title.replace(/\s+/g, '_')}_report.pdf`;
      a.click();
      toast.success('PDF downloaded');
    } catch (err) { toast.error('Download failed'); }
  };

  if (loading) return <div className="flex-1 flex items-center justify-center p-6"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Statistics</h1>
          <p className="text-slate-400">Real-time survey analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={downloadCSV} disabled={!selectedSurvey}><Download size={18} />CSV</Button>
          <Button variant="secondary" onClick={downloadPDF} disabled={!selectedSurvey}><Download size={18} />PDF</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Select label="Conference" value={selectedConference?.id || ''} onChange={(e) => setSelectedConference(conferences.find(c => c.id === e.target.value))}>
          {conferences.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select label="Survey" value={selectedSurvey?.id || ''} onChange={(e) => setSelectedSurvey(surveys.find(s => s.id === e.target.value))}>
          {surveys.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
        </Select>
      </div>

      {/* Summary */}
      {stats && (
        <Card className="p-5 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">{stats.surveyTitle}</h3>
              <p className="text-slate-400 text-sm">{stats.conferenceName}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-white">{stats.totalRespondents}</p>
              <p className="text-sm text-slate-400">{stats.responseRate}% response rate ({stats.totalRespondents}/{stats.totalAttendees})</p>
            </div>
            <Button variant="ghost" onClick={loadStats} disabled={refreshing}><RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} /></Button>
          </div>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {stats?.questions?.map((question) => (
          <Card key={question.questionId} className="overflow-hidden">
            <div className="p-4 border-b border-slate-700">
              <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded mb-1 inline-block">{question.questionType.replace('_', ' ')}</span>
              <h3 className="text-white font-medium">{question.questionText}</h3>
              <p className="text-sm text-slate-500">{question.totalResponses} responses</p>
            </div>
            <div className="p-4">
              {question.questionType === 'rating' && question.data?.length > 0 ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-4xl font-bold text-white">{question.average}</p>
                    <p className="text-slate-400 text-sm">Average Rating</p>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={question.data} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis type="number" stroke="#64748b" />
                      <YAxis dataKey="name" type="category" stroke="#64748b" width={70} />
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                      <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : question.questionType === 'text_long' || question.questionType === 'text_short' ? (
                <div>
                  <p className="text-slate-400 mb-2">{question.totalResponses} text responses</p>
                  {question.wordCloud?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {question.wordCloud.slice(0, 15).map((word, i) => (
                        <span key={i} className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-sm" style={{ fontSize: Math.max(12, Math.min(20, 10 + word.count * 2)) }}>{word.word}</span>
                      ))}
                    </div>
                  )}
                </div>
              ) : question.data?.length > 0 ? (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={200}>
                    <PieChart>
                      <Pie data={question.data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={80}>
                        {question.data.map((_, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {question.data.slice(0, 6).map((item, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="text-sm text-slate-400 flex-1 truncate">{item.name}</span>
                        <span className="text-sm text-white font-medium">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-slate-500 text-center py-8">No responses yet</p>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
