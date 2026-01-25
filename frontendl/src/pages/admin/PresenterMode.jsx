import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, X, Loader2, AlertCircle } from 'lucide-react';
import { conferenceAPI, surveyAPI, statisticsAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Select } from '../../components/ui';
import socketService from '../../services/socket';

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6'];

export default function PresenterMode() {
  const navigate = useNavigate();
  const toast = useToast();
  const [conferences, setConferences] = useState([]);
  const [selectedConference, setSelectedConference] = useState(null);
  const [surveys, setSurveys] = useState([]);
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [presenting, setPresenting] = useState(false);

  useEffect(() => { loadConferences(); }, []);
  useEffect(() => { if (selectedConference) loadSurveys(); }, [selectedConference]);
  useEffect(() => { if (selectedSurvey) loadStats(); }, [selectedSurvey]);

  useEffect(() => {
    if (selectedConference && presenting) {
      socketService.connect();
      socketService.joinConference(selectedConference.id);
      socketService.on('stats_update', loadStats);
      socketService.on('new_response', loadStats);
      return () => {
        socketService.off('stats_update', loadStats);
        socketService.off('new_response', loadStats);
      };
    }
  }, [selectedConference, presenting]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!presenting) return;
      if (e.key === 'ArrowRight' || e.key === ' ') setCurrentSlide(prev => Math.min(prev + 1, (stats?.questions?.length || 1) - 1));
      else if (e.key === 'ArrowLeft') setCurrentSlide(prev => Math.max(prev - 1, 0));
      else if (e.key === 'Escape') setPresenting(false);
      else if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [presenting, stats]);

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
      const activeSurvey = data.find(s => s.status === 'active');
      setSelectedSurvey(activeSurvey || data[0]);
    } catch (err) { toast.error('Failed to load surveys'); }
  };

  const loadStats = useCallback(async () => {
    if (!selectedSurvey) return;
    try {
      const { data } = await statisticsAPI.getSurveyStats(selectedSurvey.id);
      setStats(data);
    } catch (err) { console.error(err); }
  }, [selectedSurvey]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const startPresenting = () => {
    setPresenting(true);
    setCurrentSlide(0);
  };

  if (loading) return <div className="flex-1 flex items-center justify-center p-6"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>;

  // Presenter View
  if (presenting) {
    const questions = stats?.questions || [];
    const currentQuestion = questions[currentSlide];

    if (!currentQuestion) {
      return (
        <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-slate-500 mx-auto mb-4" />
            <p className="text-xl text-slate-400">No questions to display</p>
            <button onClick={() => setPresenting(false)} className="mt-6 px-6 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600">Exit</button>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col">
        {/* Header */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
          <div className="bg-black/30 backdrop-blur-sm rounded-lg px-4 py-2">
            <p className="text-white font-medium">{stats?.surveyTitle}</p>
            <p className="text-slate-400 text-sm">{stats?.totalRespondents} responses</p>
          </div>
          <div className="flex gap-2">
            <button onClick={toggleFullscreen} className="p-2 bg-black/30 backdrop-blur-sm rounded-lg text-white hover:bg-black/50">
              {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
            <button onClick={() => setPresenting(false)} className="p-2 bg-black/30 backdrop-blur-sm rounded-lg text-white hover:bg-black/50"><X size={20} /></button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center p-8 pt-24">
          <div className="w-full max-w-5xl">
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-12">{currentQuestion.questionText}</h2>
            
            {currentQuestion.data?.length > 0 && (
              <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-8">
                {currentQuestion.questionType === 'rating' ? (
                  <div className="space-y-4">
                    <div className="text-center mb-8">
                      <p className="text-6xl font-bold text-white">{currentQuestion.average}</p>
                      <p className="text-slate-400 text-xl">Average Rating</p>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={currentQuestion.data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="name" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 16 }} />
                        <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 14 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                        <Bar dataKey="value" fill="#6366f1" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex items-center gap-8">
                    <ResponsiveContainer width="50%" height={350}>
                      <PieChart>
                        <Pie data={currentQuestion.data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={70} outerRadius={140} label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                          {currentQuestion.data.map((_, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-4">
                      {currentQuestion.data.map((item, index) => (
                        <div key={index} className="flex items-center gap-4">
                          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                          <span className="text-lg text-white flex-1">{item.name}</span>
                          <span className="text-2xl text-white font-bold">{item.value}</span>
                          <span className="text-slate-400">({item.percentage}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4">
          <button onClick={() => setCurrentSlide(prev => Math.max(prev - 1, 0))} disabled={currentSlide === 0} className="p-3 bg-white/10 backdrop-blur-sm rounded-full text-white hover:bg-white/20 disabled:opacity-30"><ChevronLeft size={24} /></button>
          <div className="flex gap-2">
            {questions.map((_, index) => (
              <button key={index} onClick={() => setCurrentSlide(index)} className={`w-3 h-3 rounded-full transition-colors ${index === currentSlide ? 'bg-white' : 'bg-white/30 hover:bg-white/50'}`} />
            ))}
          </div>
          <button onClick={() => setCurrentSlide(prev => Math.min(prev + 1, questions.length - 1))} disabled={currentSlide === questions.length - 1} className="p-3 bg-white/10 backdrop-blur-sm rounded-full text-white hover:bg-white/20 disabled:opacity-30"><ChevronRight size={24} /></button>
        </div>

        {/* Keyboard hints */}
        <div className="absolute bottom-4 right-4 text-slate-500 text-sm">
          <span className="bg-slate-800/50 px-2 py-1 rounded mr-2">←→</span>Navigate
          <span className="bg-slate-800/50 px-2 py-1 rounded mx-2">F</span>Fullscreen
          <span className="bg-slate-800/50 px-2 py-1 rounded ml-2">ESC</span>Exit
        </div>
      </div>
    );
  }

  // Setup View
  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">Presenter Mode</h1>
        <p className="text-slate-400 mb-8">Display real-time statistics on a projector during your sessions.</p>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-6">
          <Select label="Conference" value={selectedConference?.id || ''} onChange={(e) => setSelectedConference(conferences.find(c => c.id === e.target.value))}>
            {conferences.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>

          <Select label="Survey" value={selectedSurvey?.id || ''} onChange={(e) => setSelectedSurvey(surveys.find(s => s.id === e.target.value))}>
            {surveys.map(s => <option key={s.id} value={s.id}>{s.title} {s.status === 'active' ? '(Active)' : ''}</option>)}
          </Select>

          {stats && (
            <div className="bg-slate-900 rounded-lg p-4">
              <p className="text-slate-400 text-sm mb-1">Preview</p>
              <p className="text-white font-medium">{stats.surveyTitle}</p>
              <p className="text-slate-500 text-sm">{stats.questions?.length || 0} questions • {stats.totalRespondents} responses</p>
            </div>
          )}

          <button onClick={startPresenting} disabled={!stats?.questions?.length} className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            Start Presentation
          </button>

          <div className="text-center text-slate-500 text-sm">
            <p>Keyboard shortcuts: ←→ Navigate • F Fullscreen • ESC Exit</p>
          </div>
        </div>
      </div>
    </div>
  );
}
