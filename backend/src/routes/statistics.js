const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateAdmin } = require('../middleware/auth');

const prisma = new PrismaClient();

// Calculate statistics for a single question
async function calculateQuestionStats(questionId) {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { responses: true }
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
      const counts = {};
      responses.forEach(r => {
        const value = r.answer?.selected || r.answer?.value || r.answer;
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
      const counts = {};
      responses.forEach(r => {
        const selected = r.answer?.selected || r.answer || [];
        const items = Array.isArray(selected) ? selected : [selected];
        items.forEach(item => {
          counts[item] = (counts[item] || 0) + 1;
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
      const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let sum = 0;
      responses.forEach(r => {
        const value = parseInt(r.answer?.value || r.answer);
        if (value >= 1 && value <= 5) {
          counts[value]++;
          sum += value;
        }
      });
      const average = Math.round((sum / totalResponses) * 10) / 10;
      data = Object.entries(counts)
        .map(([rating, count]) => ({
          name: `${rating} Star${rating > 1 ? 's' : ''}`,
          value: count,
          rating: parseInt(rating),
          percentage: Math.round((count / totalResponses) * 100)
        }))
        .sort((a, b) => b.rating - a.rating);
      
      return {
        questionId,
        questionText: question.text,
        questionType: question.type,
        totalResponses,
        average,
        data
      };
    }
    
    case 'text_short':
    case 'text_long': {
      const wordCounts = {};
      responses.forEach(r => {
        const text = (r.answer?.value || r.answer || '').toLowerCase();
        text.split(/\s+/).filter(word => word.length > 3).forEach(word => {
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
        responses: responses.map(r => ({ text: r.answer?.value || r.answer })),
        wordCloud
      };
    }
  }
  
  return {
    questionId,
    questionText: question.text,
    questionType: question.type,
    totalResponses,
    data
  };
}

// GET /statistics/survey/:surveyId
router.get('/survey/:surveyId', authenticateAdmin, async (req, res) => {
  try {
    const { surveyId } = req.params;
    
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        conference: { select: { adminId: true, name: true } },
        questions: { orderBy: { sortOrder: 'asc' } }
      }
    });
    
    if (!survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }
    
    if (survey.conference.adminId !== req.adminId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Count unique respondents
    const respondents = await prisma.response.groupBy({
      by: ['attendeeId'],
      where: { question: { surveyId: survey.id } }
    });
    
    // Get total attendees for this conference
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
      totalRespondents: respondents.length,
      totalAttendees,
      responseRate: totalAttendees > 0 ? Math.round((respondents.length / totalAttendees) * 100) : 0,
      questions: questionStats.filter(q => q !== null)
    });
  } catch (error) {
    console.error('Get survey statistics error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// GET /statistics/conference/:conferenceId/summary
router.get('/conference/:conferenceId/summary', authenticateAdmin, async (req, res) => {
  try {
    const { conferenceId } = req.params;
    
    const conference = await prisma.conference.findFirst({
      where: { id: conferenceId, adminId: req.adminId },
      include: {
        surveys: true,
        _count: { select: { attendees: true } }
      }
    });
    
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found' });
    }
    
    // Count total responses across all surveys
    const totalResponses = await prisma.response.count({
      where: { question: { survey: { conferenceId } } }
    });
    
    // Count unique respondents
    const uniqueRespondents = await prisma.response.groupBy({
      by: ['attendeeId'],
      where: { question: { survey: { conferenceId } } }
    });
    
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
        : 0
    });
  } catch (error) {
    console.error('Get conference summary error:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

module.exports = router;
