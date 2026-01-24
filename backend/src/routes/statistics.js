const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const { authenticateAdmin } = require('../middleware/auth');
const { handleValidationErrors, validateUUID } = require('../middleware/validate');

const prisma = new PrismaClient();

/**
 * Calculate statistics for a question
 */
async function calculateQuestionStats(questionId) {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: {
      responses: true
    }
  });
  
  if (!question) return null;
  
  const responses = question.responses;
  const totalResponses = responses.length;
  
  if (totalResponses === 0) {
    return {
      questionId,
      questionText: question.text,
      questionType: question.type,
      totalResponses: 0,
      data: []
    };
  }
  
  let data = [];
  
  switch (question.type) {
    case 'single_choice':
    case 'numeric_range': {
      // Count occurrences of each option
      const counts = {};
      responses.forEach(r => {
        const value = r.answer.selected || r.answer.value || r.answer;
        counts[value] = (counts[value] || 0) + 1;
      });
      
      data = Object.entries(counts).map(([name, value]) => ({
        name,
        value,
        percentage: Math.round((value / totalResponses) * 100)
      }));
      break;
    }
    
    case 'multi_choice': {
      // Count occurrences of each selected option
      const counts = {};
      responses.forEach(r => {
        const selected = r.answer.selected || r.answer || [];
        (Array.isArray(selected) ? selected : [selected]).forEach(option => {
          counts[option] = (counts[option] || 0) + 1;
        });
      });
      
      data = Object.entries(counts).map(([name, value]) => ({
        name,
        value,
        percentage: Math.round((value / totalResponses) * 100)
      }));
      break;
    }
    
    case 'rating': {
      // Calculate distribution and average
      const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let sum = 0;
      
      responses.forEach(r => {
        const value = parseInt(r.answer.value || r.answer);
        if (value >= 1 && value <= 5) {
          counts[value]++;
          sum += value;
        }
      });
      
      const average = sum / totalResponses;
      
      data = Object.entries(counts).map(([rating, count]) => ({
        name: `${rating} Star${rating > 1 ? 's' : ''}`,
        value: count,
        rating: parseInt(rating),
        percentage: Math.round((count / totalResponses) * 100)
      })).sort((a, b) => b.rating - a.rating);
      
      return {
        questionId,
        questionText: question.text,
        questionType: question.type,
        totalResponses,
        average: Math.round(average * 10) / 10,
        data
      };
    }
    
    case 'text_short':
    case 'text_long': {
      // Return text responses (could be used for word cloud)
      data = responses.map(r => ({
        text: r.answer.value || r.answer,
        submittedAt: r.submittedAt
      }));
      
      // Generate word frequency for word cloud
      const wordCounts = {};
      responses.forEach(r => {
        const text = (r.answer.value || r.answer || '').toLowerCase();
        const words = text.split(/\s+/).filter(w => w.length > 3);
        words.forEach(word => {
          wordCounts[word] = (wordCounts[word] || 0) + 1;
        });
      });
      
      const wordCloud = Object.entries(wordCounts)
        .map(([word, count]) => ({ word, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 30);
      
      return {
        questionId,
        questionText: question.text,
        questionType: question.type,
        totalResponses,
        responses: data,
        wordCloud
      };
    }
    
    default:
      data = [];
  }
  
  return {
    questionId,
    questionText: question.text,
    questionType: question.type,
    totalResponses,
    data
  };
}

/**
 * GET /statistics/survey/:surveyId
 * Get statistics for a survey
 */
router.get('/survey/:surveyId', authenticateAdmin, validateUUID('surveyId'), handleValidationErrors, async (req, res) => {
  try {
    const survey = await prisma.survey.findUnique({
      where: { id: req.params.surveyId },
      include: {
        conference: { select: { adminId: true, name: true } },
        questions: {
          orderBy: { sortOrder: 'asc' }
        }
      }
    });
    
    if (!survey) {
      return res.status(404).json({ error: 'Survey not found.' });
    }
    
    if (survey.conference.adminId !== req.adminId) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    
    // Get unique respondent count
    const respondentCount = await prisma.response.groupBy({
      by: ['attendeeId'],
      where: {
        question: { surveyId: survey.id }
      }
    });
    
    // Get total attendees in conference
    const totalAttendees = await prisma.attendee.count({
      where: { conferenceId: survey.conferenceId }
    });
    
    // Calculate stats for each question
    const questionStats = await Promise.all(
      survey.questions.map(q => calculateQuestionStats(q.id))
    );
    
    res.json({
      surveyId: survey.id,
      surveyTitle: survey.title,
      conferenceName: survey.conference.name,
      totalRespondents: respondentCount.length,
      totalAttendees,
      responseRate: totalAttendees > 0 
        ? Math.round((respondentCount.length / totalAttendees) * 100) 
        : 0,
      questions: questionStats.filter(q => q !== null)
    });
  } catch (error) {
    console.error('Get statistics error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics.' });
  }
});

/**
 * GET /statistics/question/:questionId
 * Get statistics for a single question
 */
router.get('/question/:questionId', authenticateAdmin, validateUUID('questionId'), handleValidationErrors, async (req, res) => {
  try {
    const question = await prisma.question.findUnique({
      where: { id: req.params.questionId },
      include: {
        survey: {
          include: {
            conference: { select: { adminId: true } }
          }
        }
      }
    });
    
    if (!question) {
      return res.status(404).json({ error: 'Question not found.' });
    }
    
    if (question.survey.conference.adminId !== req.adminId) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    
    const stats = await calculateQuestionStats(req.params.questionId);
    res.json(stats);
  } catch (error) {
    console.error('Get question statistics error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics.' });
  }
});

/**
 * GET /statistics/conference/:conferenceId/summary
 * Get summary statistics for entire conference
 */
router.get('/conference/:conferenceId/summary', authenticateAdmin, validateUUID('conferenceId'), handleValidationErrors, async (req, res) => {
  try {
    const conference = await prisma.conference.findFirst({
      where: {
        id: req.params.conferenceId,
        adminId: req.adminId
      },
      include: {
        surveys: {
          include: {
            _count: { select: { questions: true } }
          }
        },
        _count: { select: { attendees: true } }
      }
    });
    
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found.' });
    }
    
    // Get total responses across all surveys
    const totalResponses = await prisma.response.count({
      where: {
        question: {
          survey: { conferenceId: conference.id }
        }
      }
    });
    
    // Get unique respondents
    const uniqueRespondents = await prisma.response.groupBy({
      by: ['attendeeId'],
      where: {
        question: {
          survey: { conferenceId: conference.id }
        }
      }
    });
    
    // Survey completion rates
    const surveyStats = await Promise.all(
      conference.surveys.map(async (survey) => {
        const respondents = await prisma.response.groupBy({
          by: ['attendeeId'],
          where: {
            question: { surveyId: survey.id }
          }
        });
        
        return {
          surveyId: survey.id,
          title: survey.title,
          status: survey.status,
          questionCount: survey._count.questions,
          respondentCount: respondents.length,
          completionRate: conference._count.attendees > 0
            ? Math.round((respondents.length / conference._count.attendees) * 100)
            : 0
        };
      })
    );
    
    res.json({
      conferenceId: conference.id,
      conferenceName: conference.name,
      totalAttendees: conference._count.attendees,
      totalSurveys: conference.surveys.length,
      activeSurveys: conference.surveys.filter(s => s.status === 'active').length,
      totalResponses,
      uniqueRespondents: uniqueRespondents.length,
      overallParticipationRate: conference._count.attendees > 0
        ? Math.round((uniqueRespondents.length / conference._count.attendees) * 100)
        : 0,
      surveys: surveyStats
    });
  } catch (error) {
    console.error('Get conference summary error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics.' });
  }
});

module.exports = router;
