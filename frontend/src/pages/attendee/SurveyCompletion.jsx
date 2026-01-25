import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { surveyAPI, responseAPI } from '../../services/api';
import { Card, Button, Spinner } from '../../components/ui';
import { CheckCircle, ChevronRight, Home, Award, ExternalLink } from 'lucide-react';

export default function SurveyCompletion() {
  const { code } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const [surveys, setSurveys] = useState([]);
  const [completedSurveyIds, setCompletedSurveyIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [nextSurvey, setNextSurvey] = useState(null);

  // Get the survey title from navigation state if available
  const completedSurveyTitle = location.state?.surveyTitle || 'Survey';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [surveysRes, responsesRes] = await Promise.all([
        surveyAPI.getActive(),
        responseAPI.getMyResponses()
      ]);
      
      setSurveys(surveysRes.data);
      
      const completed = new Set(
        responsesRes.data.map(r => r.question?.survey?.id).filter(Boolean)
      );
      setCompletedSurveyIds(completed);
      
      // Find next uncompleted survey
      const uncompleted = surveysRes.data.find(s => !completed.has(s.id));
      setNextSurvey(uncompleted || null);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const completedCount = surveys.filter(s => completedSurveyIds.has(s.id)).length;
  const allComplete = surveys.length > 0 && completedCount === surveys.length;
  const progressPercent = surveys.length > 0 ? Math.round((completedCount / surveys.length) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        
        {/* Success Card */}
        <Card className="p-8 text-center">
          {/* Animated Checkmark */}
          <div className="mb-6">
            <div className="w-20 h-20 mx-auto bg-emerald-500/20 rounded-full flex items-center justify-center animate-pulse">
              <CheckCircle className="w-12 h-12 text-emerald-400" />
            </div>
          </div>
          
          {/* Thank You Message */}
          <h1 className="text-2xl font-bold text-white mb-2">
            {allComplete ? '🎉 All Done' : 'Thank You'}{user?.firstName ? `, ${user.firstName}!` : '!'}
          </h1>
          
          <p className="text-slate-400 mb-6">
            {allComplete 
              ? "You've completed all surveys. We appreciate your feedback!"
              : `Your response to "${completedSurveyTitle}" has been saved.`
            }
          </p>
          
          {/* Progress */}
          <div className="bg-slate-800 rounded-lg p-4 mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-400">Progress</span>
              <span className="text-white font-medium">{completedCount} of {surveys.length} completed</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="space-y-3">
            {nextSurvey ? (
              <>
                <Button 
                  onClick={() => navigate(`/c/${code}/survey/${nextSurvey.id}`)}
                  className="w-full"
                >
                  Continue to Next Survey
                  <ChevronRight size={18} />
                </Button>
                <Button 
                  variant="secondary"
                  onClick={() => navigate(`/c/${code}`)}
                  className="w-full"
                >
                  <Home size={18} />
                  View All Surveys
                </Button>
              </>
            ) : (
              <Button 
                onClick={() => navigate(`/c/${code}`)}
                className="w-full"
              >
                <Home size={18} />
                Return to Survey Hub
              </Button>
            )}
          </div>
        </Card>

        {/* ============================================ */}
        {/* POST-COMPLETION CTA - CUSTOMIZE FOR PMCOE  */}
        {/* ============================================ */}
        
        {allComplete && (
          <Card className="p-6 bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border-indigo-500/30">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Award className="w-6 h-6 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white mb-1">
                  Continue Your PM Journey
                </h3>
                <p className="text-sm text-slate-300 mb-3">
                  Explore certification courses and resources from PM CoE
                </p>
                <a 
                  href="https://pmcoe.com/courses"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Explore Courses <ExternalLink size={14} />
                </a>
              </div>
            </div>
          </Card>
        )}

        {/* ============================================ */}
        {/* PROMOTIONAL BANNER PLACEHOLDER              */}
        {/* ============================================ */}
        
        <a 
          href="https://pmcoe.com/summit-offer"
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <Card className="p-4 hover:bg-slate-750 transition-colors group">
            <div className="flex items-center gap-3">
              <div className="text-2xl">🎯</div>
              <div className="flex-1">
                <p className="text-white font-medium group-hover:text-indigo-300 transition-colors">
                  Summit Attendee Exclusive
                </p>
                <p className="text-sm text-slate-400">
                  20% off certification courses
                </p>
              </div>
              <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
            </div>
          </Card>
        </a>

      </div>
    </div>
  );
}
