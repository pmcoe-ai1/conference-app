import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { surveyAPI, questionAPI, responseAPI } from '../../services/api';
import { Button, Card, Spinner } from '../../components/ui';
import { ChevronLeft, ChevronRight, Send, AlertCircle } from 'lucide-react';

export default function SurveyPage() {
  const { code, surveyId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  
  const [survey, setSurvey] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (surveyId) {
      loadSurvey();
    } else {
      loadFirstSurvey();
    }
  }, [surveyId]);

  const loadFirstSurvey = async () => {
    try {
      const { data } = await surveyAPI.getActive();
      if (data.length > 0) {
        navigate(`/c/${code}/survey/${data[0].id}`, { replace: true });
      } else {
        toast.info('No surveys available');
        navigate(`/c/${code}`);
      }
    } catch (err) {
      toast.error('Failed to load surveys');
    } finally {
      setLoading(false);
    }
  };

  const loadSurvey = async () => {
    try {
      const [surveyRes, questionsRes] = await Promise.all([
        surveyAPI.get(surveyId),
        questionAPI.listBySurvey(surveyId)
      ]);
      setSurvey(surveyRes.data);
      setQuestions(questionsRes.data);
    } catch (err) {
      toast.error('Failed to load survey');
      navigate(`/c/${code}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (questionId, answer) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = async () => {
    // Validate required questions
    const unanswered = questions.filter(q => q.isRequired && !answers[q.id]);
    if (unanswered.length > 0) {
      toast.error(`Please answer all required questions (${unanswered.length} remaining)`);
      // Navigate to first unanswered required question
      const firstUnanswered = questions.findIndex(q => q.isRequired && !answers[q.id]);
      setCurrentIndex(firstUnanswered);
      return;
    }
    
    setSubmitting(true);
    try {
      const responses = Object.entries(answers).map(([questionId, answer]) => ({
        questionId,
        answer: typeof answer === 'object' ? answer : { value: answer }
      }));
      
      await responseAPI.submit(surveyId, responses);
      
      // Navigate to completion page with survey title
      navigate(`/c/${code}/complete`, { 
        state: { surveyTitle: survey?.title }
      });
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error('You have already submitted this survey');
        navigate(`/c/${code}`);
      } else {
        toast.error(err.response?.data?.error || 'Failed to submit survey');
      }
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

  if (!survey || questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No Questions Available</h2>
          <p className="text-slate-400 mb-4">This survey doesn't have any questions yet.</p>
          <Button onClick={() => navigate(`/c/${code}`)}>
            <ChevronLeft size={18} /> Back to Surveys
          </Button>
        </Card>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === questions.length - 1;
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <button 
              onClick={() => navigate(`/c/${code}`)}
              className="text-slate-400 hover:text-white transition-colors flex items-center gap-1"
            >
              <ChevronLeft size={18} /> Exit
            </button>
            <span className="text-sm text-slate-400">
              {currentIndex + 1} of {questions.length}
            </span>
          </div>
          <h1 className="text-lg font-semibold text-white">{survey.title}</h1>
          {/* Progress bar */}
          <div className="mt-3 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Question Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <Card className="p-6">
            <div className="mb-6">
              <div className="flex items-start gap-2 mb-2">
                <span className="text-indigo-400 font-medium">Q{currentIndex + 1}.</span>
                <h2 className="text-xl text-white font-medium">{currentQuestion.text}</h2>
              </div>
              {currentQuestion.isRequired && (
                <span className="text-xs text-red-400">* Required</span>
              )}
              {currentQuestion.helpText && (
                <p className="text-sm text-slate-400 mt-2">{currentQuestion.helpText}</p>
              )}
            </div>

            {/* Answer Input based on type */}
            <QuestionInput
              question={currentQuestion}
              value={answers[currentQuestion.id]}
              onChange={(value) => handleAnswer(currentQuestion.id, value)}
            />
          </Card>
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="bg-slate-800 border-t border-slate-700 px-4 py-4">
        <div className="max-w-2xl mx-auto flex justify-between">
          <Button
            variant="secondary"
            onClick={() => setCurrentIndex(i => i - 1)}
            disabled={isFirst}
          >
            <ChevronLeft size={18} /> Previous
          </Button>
          
          {isLast ? (
            <Button onClick={handleSubmit} loading={submitting}>
              <Send size={18} /> Submit Survey
            </Button>
          ) : (
            <Button onClick={() => setCurrentIndex(i => i + 1)}>
              Next <ChevronRight size={18} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function QuestionInput({ question, value, onChange }) {
  const { type, options } = question;
  
  switch (type) {
    case 'single_choice':
      return (
        <div className="space-y-2">
          {(options?.choices || []).map((choice, i) => (
            <label key={i} className={`flex items-center gap-3 p-4 rounded-lg cursor-pointer transition-all ${
              value?.selected === choice 
                ? 'bg-indigo-600/20 border-2 border-indigo-500' 
                : 'bg-slate-800 border-2 border-transparent hover:border-slate-600'
            }`}>
              <input
                type="radio"
                name={question.id}
                checked={value?.selected === choice}
                onChange={() => onChange({ selected: choice })}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                value?.selected === choice ? 'border-indigo-500 bg-indigo-500' : 'border-slate-500'
              }`}>
                {value?.selected === choice && <div className="w-2 h-2 rounded-full bg-white" />}
              </div>
              <span className="text-white">{choice}</span>
            </label>
          ))}
        </div>
      );
      
    case 'multi_choice':
      const selected = value?.selected || [];
      return (
        <div className="space-y-2">
          {(options?.choices || []).map((choice, i) => (
            <label key={i} className={`flex items-center gap-3 p-4 rounded-lg cursor-pointer transition-all ${
              selected.includes(choice) 
                ? 'bg-indigo-600/20 border-2 border-indigo-500' 
                : 'bg-slate-800 border-2 border-transparent hover:border-slate-600'
            }`}>
              <input
                type="checkbox"
                checked={selected.includes(choice)}
                onChange={(e) => {
                  const newSelected = e.target.checked
                    ? [...selected, choice]
                    : selected.filter(c => c !== choice);
                  onChange({ selected: newSelected });
                }}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                selected.includes(choice) ? 'border-indigo-500 bg-indigo-500' : 'border-slate-500'
              }`}>
                {selected.includes(choice) && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <span className="text-white">{choice}</span>
            </label>
          ))}
        </div>
      );
      
    case 'rating':
      const maxRating = options?.max || 5;
      return (
        <div className="flex justify-center gap-2">
          {Array.from({ length: maxRating }, (_, i) => i + 1).map((rating) => (
            <button
              key={rating}
              onClick={() => onChange({ value: rating })}
              className={`w-12 h-12 rounded-lg text-lg font-medium transition-all ${
                value?.value === rating
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {rating}
            </button>
          ))}
        </div>
      );
      
    case 'numeric_range':
      const min = options?.min || 0;
      const max = options?.max || 10;
      return (
        <div className="space-y-4">
          <input
            type="range"
            min={min}
            max={max}
            value={value?.value || min}
            onChange={(e) => onChange({ value: parseInt(e.target.value) })}
            className="w-full"
          />
          <div className="flex justify-between text-sm text-slate-400">
            <span>{options?.minLabel || min}</span>
            <span className="text-2xl text-white font-bold">{value?.value || min}</span>
            <span>{options?.maxLabel || max}</span>
          </div>
        </div>
      );
      
    case 'text_short':
      return (
        <input
          type="text"
          value={value?.value || ''}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder="Your answer..."
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      );
      
    case 'text_long':
      return (
        <textarea
          value={value?.value || ''}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder="Your answer..."
          rows={4}
          className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      );
      
    default:
      return <p className="text-slate-400">Unsupported question type</p>;
  }
}
