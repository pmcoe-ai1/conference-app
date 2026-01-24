const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const { authenticateAttendee, authenticateAdmin } = require('../middleware/auth');
const { handleValidationErrors, validateResponse, validateUUID } = require('../middleware/validate');

const prisma = new PrismaClient();

/**
 * POST /responses/survey/:surveyId
 * Submit survey responses
 */
router.post('/survey/:surveyId', authenticateAttendee, validateUUID('surveyId'), validateResponse, handleValidationErrors, async (req, res) => {
  try {
    const { responses } = req.body;
    const surveyId = req.params.surveyId;
    
    // Verify survey exists and is active
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        questions: true
      }
    });
    
    if (!survey) {
      return res.status(404).json({ error: 'Survey not found.' });
    }
    
    if (survey.status !== 'active') {
      return res.status(400).json({ error: 'This survey is not currently active.' });
    }
    
    if (survey.conferenceId !== req.conferenceId) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    
    // Check for existing responses
    const existingResponse = await prisma.response.findFirst({
      where: {
        attendeeId: req.attendeeId,
        question: { surveyId }
      }
    });
    
    if (existingResponse) {
      return res.status(409).json({ error: 'You have already submitted a response to this survey.' });
    }
    
    // Validate required questions
    const requiredQuestionIds = survey.questions
      .filter(q => q.isRequired)
      .map(q => q.id);
    
    const answeredQuestionIds = responses.map(r => r.questionId);
    const missingRequired = requiredQuestionIds.filter(id => !answeredQuestionIds.includes(id));
    
    if (missingRequired.length > 0) {
      return res.status(400).json({ 
        error: 'Please answer all required questions.',
        missingQuestions: missingRequired
      });
    }
    
    // Create responses
    const createdResponses = await prisma.$transaction(
      responses.map(response =>
        prisma.response.create({
          data: {
            questionId: response.questionId,
            attendeeId: req.attendeeId,
            answer: response.answer
          }
        })
      )
    );
    
    // Emit WebSocket event for real-time statistics update
    const io = req.app.get('io');
    
    for (const response of responses) {
      io.to(`conference:${req.conferenceId}`).emit('new_response', {
        surveyId,
        questionId: response.questionId,
        conferenceId: req.conferenceId
      });
    }
    
    // Emit stats update
    io.to(`conference:${req.conferenceId}`).emit('stats_update', {
      surveyId,
      conferenceId: req.conferenceId
    });
    
    res.status(201).json({
      message: 'Responses submitted successfully.',
      responseCount: createdResponses.length
    });
  } catch (error) {
    console.error('Submit responses error:', error);
    res.status(500).json({ error: 'Failed to submit responses.' });
  }
});

/**
 * GET /responses/survey/:surveyId
 * Get all responses for a survey (admin only)
 */
router.get('/survey/:surveyId', authenticateAdmin, validateUUID('surveyId'), handleValidationErrors, async (req, res) => {
  try {
    const survey = await prisma.survey.findUnique({
      where: { id: req.params.surveyId },
      include: {
        conference: { select: { adminId: true } }
      }
    });
    
    if (!survey) {
      return res.status(404).json({ error: 'Survey not found.' });
    }
    
    if (survey.conference.adminId !== req.adminId) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    
    const responses = await prisma.response.findMany({
      where: {
        question: { surveyId: req.params.surveyId }
      },
      include: {
        question: {
          select: { text: true, type: true }
        },
        attendee: {
          select: { email: true }
        }
      },
      orderBy: { submittedAt: 'desc' }
    });
    
    res.json(responses);
  } catch (error) {
    console.error('Get responses error:', error);
    res.status(500).json({ error: 'Failed to fetch responses.' });
  }
});

/**
 * GET /responses/attendee/:attendeeId
 * Get all responses from a specific attendee (admin only)
 */
router.get('/attendee/:attendeeId', authenticateAdmin, validateUUID('attendeeId'), handleValidationErrors, async (req, res) => {
  try {
    const attendee = await prisma.attendee.findUnique({
      where: { id: req.params.attendeeId },
      include: {
        conference: { select: { adminId: true } }
      }
    });
    
    if (!attendee) {
      return res.status(404).json({ error: 'Attendee not found.' });
    }
    
    if (attendee.conference.adminId !== req.adminId) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    
    const responses = await prisma.response.findMany({
      where: { attendeeId: req.params.attendeeId },
      include: {
        question: {
          select: { text: true, type: true, surveyId: true }
        }
      },
      orderBy: { submittedAt: 'desc' }
    });
    
    res.json(responses);
  } catch (error) {
    console.error('Get attendee responses error:', error);
    res.status(500).json({ error: 'Failed to fetch responses.' });
  }
});

module.exports = router;
