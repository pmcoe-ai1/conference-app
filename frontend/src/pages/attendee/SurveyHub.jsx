import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { surveyAPI, responseAPI } from '../../services/api';
import { Card, Spinner, Button } from '../../components/ui';
import { CheckCircle, Circle, Clock, ChevronRight, ExternalLink, Award, BookOpen, Users, Calendar } from 'lucide-react';

export default function SurveyHub() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  
  const [surveys, setSurveys] = useState([]);
  const [completedSurveyIds, setCompletedSurveyIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data } = await surveyAPI.getActive();
      
      // Handle both array and single object responses
      const surveyList = Array.isArray(data) ? data : (data ? [data] : []);
      setSurveys(surveyList);
      
      // Build completed set from isCompleted flag
      const completed = new Set(
        surveyList.filter(s => s.isCompleted).map(s => s.id)
      );
      setCompletedSurveyIds(completed);
    } catch (err) {
      toast.error('Failed to load surveys');
    } finally {
      setLoading(false);
    }
  };

  const completedCount = surveys.filter(s => completedSurveyIds.has(s.id)).length;
  const allComplete = surveys.length > 0 && completedCount === surveys.length;
  const progressPercent = surveys.length > 0 ? Math.round((completedCount / surveys.length) * 100) : 0;

  const handleSurveyClick = (survey) => {
    if (completedSurveyIds.has(survey.id)) {
      toast.info('You have already completed this survey');
      return;
    }
    navigate(`/c/${code}/survey/${survey.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-white mb-2">
            Welcome{user?.firstName ? `, ${user.firstName}` : ''}!
          </h1>
          <p className="text-indigo-100">
            Your feedback helps us improve future events
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        
        {/* Progress Card */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Your Progress</h2>
            <span className="text-2xl font-bold text-indigo-400">{completedCount}/{surveys.length}</span>
          </div>
          
          {/* Progress Bar */}
          <div className="h-3 bg-slate-700 rounded-full overflow-hidden mb-2">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-sm text-slate-400">
            {allComplete 
              ? '🎉 All surveys completed! Thank you!' 
              : `${surveys.length - completedCount} survey${surveys.length - completedCount !== 1 ? 's' : ''} remaining`
            }
          </p>
        </Card>

        {/* Survey List */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white px-1">Surveys</h2>
          
          {surveys.length === 0 ? (
            <Card className="p-8 text-center">
              <Clock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No surveys available yet</p>
              <p className="text-sm text-slate-500 mt-1">Check back soon!</p>
            </Card>
          ) : (
            surveys.map((survey) => {
              const isCompleted = completedSurveyIds.has(survey.id);
              return (
                <Card 
                  key={survey.id}
                  className={`p-4 cursor-pointer transition-all ${
                    isCompleted 
                      ? 'bg-slate-800/50 border-slate-700' 
                      : 'hover:bg-slate-750 hover:border-indigo-500/50'
                  }`}
                  onClick={() => handleSurveyClick(survey)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${isCompleted ? 'bg-emerald-500/20' : 'bg-slate-700'}`}>
                      {isCompleted 
                        ? <CheckCircle className="w-6 h-6 text-emerald-400" />
                        : <Circle className="w-6 h-6 text-slate-400" />
                      }
                    </div>
                    <div className="flex-1">
                      <h3 className={`font-medium ${isCompleted ? 'text-slate-400' : 'text-white'}`}>
                        {survey.title}
                      </h3>
                      {survey.description && (
                        <p className="text-sm text-slate-500 line-clamp-1">{survey.description}</p>
                      )}
                    </div>
                    {!isCompleted && (
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    )}
                    {isCompleted && (
                      <span className="text-xs text-emerald-400 font-medium">Completed</span>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* ============================================ */}
        {/* PMCOE CALL TO ACTION SECTION - PLACEHOLDER */}
        {/* ============================================ */}
        
        {allComplete && (
          <Card className="p-6 bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border-indigo-500/30">
            <div className="text-center mb-4">
              <Award className="w-10 h-10 text-yellow-400 mx-auto mb-2" />
              <h3 className="text-lg font-semibold text-white">Thank You for Your Feedback!</h3>
              <p className="text-sm text-slate-300 mt-1">
                Your input helps us create better experiences
              </p>
            </div>
          </Card>
        )}

        {/* ============================================ */}
        {/* CTA CARDS - CUSTOMIZE FOR PMCOE            */}
        {/* ============================================ */}
        
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white px-1">Resources</h2>
          
          {/* CTA 1: Website Link */}
          <CTACard
            icon={<BookOpen className="w-5 h-5 text-indigo-400" />}
            title="Explore PM CoE Resources"
            description="Access templates, guides, and best practices"
            linkText="Visit pmcoe.com"
            linkUrl="https://pmcoe.com"
          />
          
          {/* CTA 2: Certification Courses */}
          <CTACard
            icon={<Award className="w-5 h-5 text-amber-400" />}
            title="PMP Certification Training"
            description="Advance your career with industry-recognized credentials"
            linkText="View Courses"
            linkUrl="https://pmcoe.com/courses"
          />
          
          {/* CTA 3: Community */}
          <CTACard
            icon={<Users className="w-5 h-5 text-emerald-400" />}
            title="Join Our Community"
            description="Connect with project management professionals"
            linkText="Join Network"
            linkUrl="https://pmcoe.com/community"
          />
          
          {/* CTA 4: Upcoming Events */}
          <CTACard
            icon={<Calendar className="w-5 h-5 text-purple-400" />}
            title="Upcoming Events"
            description="Workshops, webinars, and networking opportunities"
            linkText="View Calendar"
            linkUrl="https://pmcoe.com/events"
          />
        </div>

        {/* ============================================ */}
        {/* CUSTOM BANNER PLACEHOLDER                   */}
        {/* Replace src with actual banner image        */}
        {/* ============================================ */}
        
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-center">
            {/* Placeholder for promotional banner */}
            <p className="text-white font-semibold mb-2">
              🎯 Special Offer for Summit Attendees
            </p>
            <p className="text-indigo-100 text-sm mb-4">
              Get 20% off your next certification course
            </p>
            <a 
              href="https://pmcoe.com/summit-offer"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-white text-indigo-600 px-4 py-2 rounded-lg font-medium hover:bg-indigo-50 transition-colors"
            >
              Claim Offer <ExternalLink size={16} />
            </a>
          </div>
        </Card>

        {/* ============================================ */}
        {/* FOOTER LINKS PLACEHOLDER                    */}
        {/* ============================================ */}
        
        <div className="text-center py-4 space-y-2">
          <div className="flex justify-center gap-4 text-sm">
            <a href="https://pmcoe.com" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors">
              Website
            </a>
            <span className="text-slate-600">•</span>
            <a href="https://pmcoe.com/contact" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors">
              Contact
            </a>
            <span className="text-slate-600">•</span>
            <a href="https://pmcoe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-white transition-colors">
              Privacy
            </a>
          </div>
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} PM Centre of Excellence
          </p>
        </div>

      </div>
    </div>
  );
}

/* ============================================ */
/* CTA CARD COMPONENT                          */
/* Reusable card for call-to-action links      */
/* ============================================ */

function CTACard({ icon, title, description, linkText, linkUrl }) {
  return (
    <a 
      href={linkUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
    >
      <Card className="p-4 hover:bg-slate-750 hover:border-slate-600 transition-all group">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-slate-700 rounded-lg group-hover:bg-slate-600 transition-colors">
            {icon}
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-white group-hover:text-indigo-300 transition-colors">
              {title}
            </h3>
            <p className="text-sm text-slate-400">{description}</p>
          </div>
          <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
        </div>
      </Card>
    </a>
  );
}
