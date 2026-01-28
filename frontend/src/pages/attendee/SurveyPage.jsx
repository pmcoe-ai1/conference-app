import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check, Star, Clock, Loader2 } from 'lucide-react';
import { surveyAPI, responseAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function SurveyPage() {
  const { code, surveyId } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const toast = useToast();

  const [survey, setSurvey] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [completed, setCompleted] = useState(false);
  const [noSurvey, setNoSurvey] = useState(false);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);

  useEffect(() => { loadSurvey(); }, [surveyId]);

  const loadSurvey = async () => {
    try {
      // Load specific survey by ID for attendee
      const { data } = await surveyAPI.getForAttendee(surveyId);
      setSurvey(data);
      setQuestions(data.questions || []);
    } catch (err) {
      if (err.response?.status === 404) {
        setNoSurvey(true);
      } else if (err.response?.data?.alreadyCompleted) {
        setAlreadyCompleted(true);
      } else {
        toast.error('Failed to load survey');
      }
    } finally {
      setLoading(false);
    }
  };

  const currentQuestion = questions[currentIndex];
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  const setAnswer = (value) => {
    setAnswers({ ...answers, [currentQuestion.id]: value });
  };

  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : null;

  const canProceed = () => {
    if (!currentQuestion?.isRequired) return true;
    if (!currentAnswer) return false;
    if (Array.isArray(currentAnswer) && currentAnswer.length === 0) return false;
    return true;
  };

  const handleNext = async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      await submitSurvey();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const submitSurvey = async () => {
    setSubmitting(true);
    try {
      const responses = Object.entries(answers).map(([questionId, answer]) => ({
        questionId,
        answer: typeof answer === 'object' ? answer : { value: answer }
      }));
      await responseAPI.submit(survey.id, responses);
      setCompleted(true);
      toast.success('Survey submitted successfully!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit survey');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 flex items-center justify-center"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>;

  if (completed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-teal-900 to-emerald-800 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white/20 rounded-full mb-6 animate-bounce"><Check className="w-12 h-12 text-white" /></div>
          <h1 className="text-3xl font-bold text-white mb-3">Thank You!</h1>
          <p className="text-emerald-200 mb-8">Your responses have been submitted successfully.</p>
          <div className="space-y-3">
            <button onClick={() => navigate(`/c/${code}/surveys`)} className="w-full px-6 py-3 bg-white text-emerald-900 font-semibold rounded-xl hover:bg-emerald-100 transition-colors">Back to Survey Hub</button>
            <button onClick={() => { logout(); navigate(`/c/${code}`); }} className="w-full px-6 py-3 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-colors">Sign Out</button>
          </div>
        </div>
      </div>
    );
  }

  if (noSurvey || alreadyCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-700/50 rounded-2xl mb-6"><Clock className="w-10 h-10 text-slate-400" /></div>
          <h1 className="text-2xl font-bold text-white mb-3">{alreadyCompleted ? 'Already Completed' : 'Survey Not Available'}</h1>
          <p className="text-slate-400 mb-6">{alreadyCompleted ? 'You have already completed this survey. Thank you for your feedback!' : 'This survey is no longer active. Please check the survey hub for available surveys.'}</p>
          <div className="space-y-3">
            <button onClick={() => navigate(`/c/${code}/surveys`)} className="w-full px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors">Back to Survey Hub</button>
            <button onClick={() => { logout(); navigate(`/c/${code}`); }} className="w-full px-6 py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition-colors">Sign Out</button>
          </div>
        </div>
      </div>
    );
  }

  const renderQuestionInput = () => {
    if (!currentQuestion) return null;
    switch (currentQuestion.type) {
      case 'rating':
        return (
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button key={value} onClick={() => setAnswer(value)} className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all ${currentAnswer === value ? 'bg-amber-400 text-amber-900 scale-110 shadow-lg' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                <Star className={currentAnswer >= value ? 'fill-current' : ''} size={24} />
              </button>
            ))}
          </div>
        );
      case 'single_choice':
      case 'numeric_range':
        const singleOptions = currentQuestion.type === 'numeric_range' ? currentQuestion.options?.ranges : currentQuestion.options?.choices;
        return (
          <div className="space-y-3">
            {(singleOptions || []).map((choice) => (
              <button key={choice} onClick={() => setAnswer(choice)} className={`w-full p-4 rounded-xl text-left transition-all ${currentAnswer === choice ? 'bg-white text-indigo-900 shadow-lg' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${currentAnswer === choice ? 'border-indigo-600 bg-indigo-600' : 'border-current'}`}>{currentAnswer === choice && <div className="w-2 h-2 bg-white rounded-full" />}</div>
                  {choice}
                </div>
              </button>
            ))}
          </div>
        );
      case 'multi_choice':
        const selected = currentAnswer || [];
        return (
          <div className="space-y-3">
            {(currentQuestion.options?.choices || []).map((choice) => (
              <button key={choice} onClick={() => { const newSelected = selected.includes(choice) ? selected.filter(s => s !== choice) : [...selected, choice]; setAnswer(newSelected); }} className={`w-full p-4 rounded-xl text-left transition-all ${selected.includes(choice) ? 'bg-white text-indigo-900 shadow-lg' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${selected.includes(choice) ? 'border-indigo-600 bg-indigo-600' : 'border-current'}`}>{selected.includes(choice) && <Check size={14} className="text-white" />}</div>
                  {choice}
                </div>
              </button>
            ))}
          </div>
        );
      case 'text_long':
      case 'text_short':
        return <textarea value={currentAnswer || ''} onChange={(e) => setAnswer(e.target.value)} placeholder={currentQuestion.options?.placeholder || 'Type your answer...'} maxLength={currentQuestion.options?.maxLength || 500} rows={currentQuestion.type === 'text_long' ? 5 : 2} className="w-full p-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 flex flex-col">
      <div className="h-1 bg-white/20"><div className="h-full bg-white transition-all duration-300" style={{ width: `${progress}%` }} /></div>
      <div className="p-4 flex items-center justify-between">
        <button onClick={() => navigate(`/c/${code}`)} className="text-white/70 hover:text-white flex items-center gap-1"><ChevronLeft size={20} />Exit</button>
        <span className="text-white/70 text-sm">{currentIndex + 1} of {questions.length}</span>
      </div>
      <div className="flex-1 flex flex-col justify-center p-6 max-w-xl mx-auto w-full">
        <div className="mb-8">
          {currentQuestion?.isRequired && <span className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded mb-4 inline-block">Required</span>}
          <h2 className="text-2xl font-bold text-white mb-2">{currentQuestion?.text}</h2>
          {currentQuestion?.type === 'multi_choice' && <p className="text-purple-300 text-sm">Select all that apply</p>}
        </div>
        {renderQuestionInput()}
      </div>
      <div className="p-6 flex gap-3 max-w-xl mx-auto w-full">
        {currentIndex > 0 && <button onClick={handlePrev} className="px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors">Back</button>}
        <button onClick={handleNext} disabled={!canProceed() || submitting} className="flex-1 py-3 bg-white text-indigo-900 font-semibold rounded-xl hover:bg-purple-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{currentIndex === questions.length - 1 ? 'Submit' : 'Next'}<ChevronRight size={18} /></>}
        </button>
      </div>
    </div>
  );
}
