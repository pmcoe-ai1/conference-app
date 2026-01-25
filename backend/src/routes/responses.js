const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateAttendee, authenticateAdmin } = require('../middleware/auth');

const prisma = new PrismaClient();

// POST /responses/survey/:surveyId - Submit survey responses
router.post('/survey/:surveyId', authenticateAttendee, async (req, res) => {
  try {
    const { surveyId } = req.params;
    const { responses } = req.body;
    
    if (!responses || !Array.isArray(responses)) {
      return res.status(400).json({ error: 'Responses must be an array' });
    }
    
    // Get the survey
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: { questions: true }
    });
    
    if (!survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }
    
    if (survey.status !== 'active') {
      return res.status(400).json({ error: 'Survey is not active' });
    }
    
    if (survey.conferenceId !== req.conferenceId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Check if already submitted
    const existingResponse = await prisma.response.findFirst({
      where: {
        attendeeId: req.attendeeId,
        question: { surveyId }
      }
    });
    
    if (existingResponse) {
      return res.status(409).json({ error: 'You have already submitted this survey' });
    }
    
    // Create responses
    const created = await prisma.$transaction(
      responses.map(r => 
        prisma.response.create({
          data: {
            questionId: r.questionId,
            attendeeId: req.attendeeId,
            answer: r.answer
          }
        })
      )
    );
    
    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.to(`conference:${req.conferenceId}`).emit('new_response', { surveyId });
      io.to(`conference:${req.conferenceId}`).emit('stats_update', { surveyId });
    }
    
    res.status(201).json({ 
      message: 'Survey submitted successfully', 
      count: created.length 
    });
  } catch (error) {
    console.error('Submit response error:', error);
    res.status(500).json({ error: 'Failed to submit survey' });
  }
});

// GET /responses/survey/:surveyId - Get all responses for a survey (admin)
router.get('/survey/:surveyId', authenticateAdmin, async (req, res) => {
  try {
    const { surveyId } = req.params;
    
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: { conference: { select: { adminId: true } } }
    });
    
    if (!survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }
    
    if (survey.conference.adminId !== req.adminId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const responses = await prisma.response.findMany({
      where: { question: { surveyId } },
      include: {
        question: { select: { text: true, type: true } },
        attendee: { select: { email: true } }
      },
      orderBy: { submittedAt: 'desc' }
    });
    
    res.json(responses);
  } catch (error) {
    console.error('Get responses error:', error);
    res.status(500).json({ error: 'Failed to fetch responses' });
  }
});

// GET /responses/attendee - Get current attendee's responses
router.get('/attendee', authenticateAttendee, async (req, res) => {
  try {
    const responses = await prisma.response.findMany({
      where: { attendeeId: req.attendeeId },
      include: {
        question: {
          select: {
            text: true,
            type: true,
            survey: { select: { id: true, title: true } }
          }
        }
      },
      orderBy: { submittedAt: 'desc' }
    });
    
    res.json(responses);
  } catch (error) {
    console.error('Get attendee responses error:', error);
    res.status(500).json({ error: 'Failed to fetch responses' });
  }
});

module.exports = router;
