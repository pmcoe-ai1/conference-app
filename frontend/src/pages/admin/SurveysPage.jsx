import React, { useState, useEffect } from 'react';
import { Plus, FileText, Play, Pause, Trash2, Edit3, Check, Star, Type, ListChecks, BarChart3, Loader2 } from 'lucide-react';
import { conferenceAPI, surveyAPI, questionAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Button, Modal, Input, Textarea, Card, StatusBadge, EmptyState, Select } from '../../components/ui';

const QUESTION_TYPES = [
  { id: 'single_choice', label: 'Single Choice', icon: Type },
  { id: 'multi_choice', label: 'Multiple Choice', icon: ListChecks },
  { id: 'rating', label: 'Rating (1-5)', icon: Star },
  { id: 'numeric_range', label: 'Numeric Range', icon: BarChart3 },
  { id: 'text_short', label: 'Short Text', icon: Type },
  { id: 'text_long', label: 'Long Text', icon: FileText }
];

export default function SurveysPage() {
  const toast = useToast();
  const [conferences, setConferences] = useState([]);
  const [selectedConference, setSelectedConference] = useState(null);
  const [surveys, setSurveys] = useState([]);
  const [selectedSurvey, setSelectedSurvey] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newSurvey, setNewSurvey] = useState({ title: '', description: '' });
  const [newQuestion, setNewQuestion] = useState({ text: '', type: 'single_choice', isRequired: true, options: { choices: ['', ''] } });

  useEffect(() => { loadConferences(); }, []);
  useEffect(() => { if (selectedConference) loadSurveys(); }, [selectedConference]);
  useEffect(() => { if (selectedSurvey) loadQuestions(); }, [selectedSurvey]);

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
      if (data.length > 0 && !selectedSurvey) setSelectedSurvey(data[0]);
    } catch (err) { toast.error('Failed to load surveys'); }
  };

  const loadQuestions = async () => {
    try {
      const { data } = await questionAPI.listBySurvey(selectedSurvey.id);
      setQuestions(data);
    } catch (err) { toast.error('Failed to load questions'); }
  };

  const handleCreateSurvey = async () => {
    if (!newSurvey.title) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      await surveyAPI.create({ ...newSurvey, conferenceId: selectedConference.id });
      toast.success('Survey created!');
      setShowSurveyModal(false);
      setNewSurvey({ title: '', description: '' });
      loadSurveys();
    } catch (err) { toast.error('Failed to create survey'); }
    finally { setSaving(false); }
  };

  const toggleSurveyStatus = async (survey) => {
    try {
      if (survey.status === 'active') await surveyAPI.deactivate(survey.id);
      else await surveyAPI.activate(survey.id);
      toast.success(`Survey ${survey.status === 'active' ? 'deactivated' : 'activated'}`);
      loadSurveys();
    } catch (err) { toast.error('Failed to update survey'); }
  };

  const deleteSurvey = async (survey) => {
    if (!confirm('Delete this survey and all its questions?')) return;
    try {
      await surveyAPI.delete(survey.id);
      toast.success('Survey deleted');
      if (selectedSurvey?.id === survey.id) setSelectedSurvey(null);
      loadSurveys();
    } catch (err) { toast.error('Failed to delete survey'); }
  };

  const handleCreateQuestion = async () => {
    if (!newQuestion.text) { toast.error('Question text is required'); return; }
    setSaving(true);
    try {
      let options = {};
      if (newQuestion.type === 'rating') {
        options = { min: 1, max: 5, labels: { 1: 'Poor', 5: 'Excellent' } };
      } else if (newQuestion.type === 'single_choice' || newQuestion.type === 'multi_choice') {
        options = { choices: newQuestion.options.choices.filter(c => c.trim()) };
      } else if (newQuestion.type === 'numeric_range') {
        options = { ranges: newQuestion.options.choices.filter(c => c.trim()) };
      } else if (newQuestion.type === 'text_long' || newQuestion.type === 'text_short') {
        options = { maxLength: 500 };
      }
      
      await questionAPI.create({
        surveyId: selectedSurvey.id,
        text: newQuestion.text,
        type: newQuestion.type,
        isRequired: newQuestion.isRequired,
        options
      });
      toast.success('Question added!');
      setShowQuestionModal(false);
      setNewQuestion({ text: '', type: 'single_choice', isRequired: true, options: { choices: ['', ''] } });
      loadQuestions();
    } catch (err) { toast.error('Failed to create question'); }
    finally { setSaving(false); }
  };

  const deleteQuestion = async (question) => {
    if (!confirm('Delete this question?')) return;
    try {
      await questionAPI.delete(question.id);
      toast.success('Question deleted');
      loadQuestions();
    } catch (err) { toast.error('Failed to delete question'); }
  };

  if (loading) return <div className="flex-1 flex items-center justify-center p-6"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Surveys</h1>
          <p className="text-slate-400">Create and manage survey questions</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedConference?.id || ''} onChange={(e) => setSelectedConference(conferences.find(c => c.id === e.target.value))} className="w-64">
            {conferences.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Button onClick={() => setShowSurveyModal(true)}><Plus size={18} />New Survey</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Survey List */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider">All Surveys</h2>
          {surveys.length === 0 ? (
            <Card className="p-6"><EmptyState icon={FileText} title="No surveys" description="Create your first survey" /></Card>
          ) : (
            surveys.map((survey) => (
              <Card key={survey.id} className={`p-4 cursor-pointer transition-all ${selectedSurvey?.id === survey.id ? 'ring-2 ring-indigo-500' : 'hover:bg-slate-750'}`} onClick={() => setSelectedSurvey(survey)}>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-white">{survey.title}</h3>
                  <StatusBadge status={survey.status} />
                </div>
                <p className="text-sm text-slate-400 mb-3 line-clamp-2">{survey.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{survey.responseCount || 0} responses</span>
                  <div className="flex gap-1">
                    <button onClick={(e) => { e.stopPropagation(); toggleSurveyStatus(survey); }} className={`p-1.5 rounded-lg transition-colors ${survey.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                      {survey.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteSurvey(survey); }} className="p-1.5 rounded-lg bg-slate-700 text-slate-400 hover:bg-red-500/20 hover:text-red-400">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Question Editor */}
        <div className="lg:col-span-2">
          {selectedSurvey ? (
            <Card>
              <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-white">{selectedSurvey.title}</h2>
                  <p className="text-sm text-slate-400">{questions.length} questions</p>
                </div>
                <Button size="sm" onClick={() => setShowQuestionModal(true)}><Plus size={16} />Add Question</Button>
              </div>
              <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
                {questions.length === 0 ? (
                  <EmptyState icon={FileText} title="No questions" description="Add questions to this survey" />
                ) : (
                  questions.map((question, index) => (
                    <div key={question.id} className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-slate-800 rounded-lg text-slate-400 text-sm font-medium">{index + 1}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{question.type.replace('_', ' ')}</span>
                            {question.isRequired && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">Required</span>}
                          </div>
                          <p className="text-white">{question.text}</p>
                          {question.options?.choices && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {question.options.choices.map((choice, i) => (
                                <span key={i} className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded">{choice}</span>
                              ))}
                            </div>
                          )}
                          {question.options?.ranges && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {question.options.ranges.map((range, i) => (
                                <span key={i} className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded">{range}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button onClick={() => deleteQuestion(question)} className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-red-400">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          ) : (
            <Card className="p-12"><EmptyState icon={FileText} title="Select a survey" description="Choose a survey from the list to manage questions" /></Card>
          )}
        </div>
      </div>

      {/* Create Survey Modal */}
      <Modal isOpen={showSurveyModal} onClose={() => setShowSurveyModal(false)} title="Create Survey">
        <div className="space-y-4">
          <Input label="Survey Title *" value={newSurvey.title} onChange={(e) => setNewSurvey({ ...newSurvey, title: e.target.value })} placeholder="Day 1 Feedback Survey" />
          <Textarea label="Description" value={newSurvey.description} onChange={(e) => setNewSurvey({ ...newSurvey, description: e.target.value })} rows={3} placeholder="Brief description..." />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowSurveyModal(false)}>Cancel</Button>
            <Button onClick={handleCreateSurvey} loading={saving}>Create Survey</Button>
          </div>
        </div>
      </Modal>

      {/* Create Question Modal */}
      <Modal isOpen={showQuestionModal} onClose={() => setShowQuestionModal(false)} title="Add Question" size="lg">
        <div className="space-y-4">
          <Textarea label="Question Text *" value={newQuestion.text} onChange={(e) => setNewQuestion({ ...newQuestion, text: e.target.value })} rows={2} placeholder="Enter your question..." />
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Question Type</label>
            <div className="grid grid-cols-3 gap-2">
              {QUESTION_TYPES.map((type) => (
                <button key={type.id} onClick={() => setNewQuestion({ ...newQuestion, type: type.id })} className={`p-3 rounded-lg border text-left flex items-center gap-2 transition-colors ${newQuestion.type === type.id ? 'border-indigo-500 bg-indigo-500/20 text-white' : 'border-slate-700 hover:border-slate-600 text-slate-400'}`}>
                  <type.icon size={18} /><span className="text-sm">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {(newQuestion.type === 'single_choice' || newQuestion.type === 'multi_choice' || newQuestion.type === 'numeric_range') && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{newQuestion.type === 'numeric_range' ? 'Ranges' : 'Options'}</label>
              <div className="space-y-2">
                {newQuestion.options.choices.map((choice, index) => (
                  <div key={index} className="flex gap-2">
                    <input type="text" value={choice} onChange={(e) => { const newChoices = [...newQuestion.options.choices]; newChoices[index] = e.target.value; setNewQuestion({ ...newQuestion, options: { choices: newChoices } }); }} className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-indigo-500" placeholder={newQuestion.type === 'numeric_range' ? `Range ${index + 1} (e.g., 0-5 years)` : `Option ${index + 1}`} />
                    {newQuestion.options.choices.length > 2 && (
                      <button onClick={() => { const newChoices = newQuestion.options.choices.filter((_, i) => i !== index); setNewQuestion({ ...newQuestion, options: { choices: newChoices } }); }} className="p-2 text-slate-400 hover:text-red-400"><Trash2 size={18} /></button>
                    )}
                  </div>
                ))}
                <button onClick={() => setNewQuestion({ ...newQuestion, options: { choices: [...newQuestion.options.choices, ''] } })} className="text-sm text-indigo-400 hover:text-indigo-300">+ Add option</button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input type="checkbox" id="required" checked={newQuestion.isRequired} onChange={(e) => setNewQuestion({ ...newQuestion, isRequired: e.target.checked })} className="rounded border-slate-600 bg-slate-800 text-indigo-600" />
            <label htmlFor="required" className="text-sm text-slate-300">Required question</label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowQuestionModal(false)}>Cancel</Button>
            <Button onClick={handleCreateQuestion} loading={saving}>Add Question</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
