const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const { authenticateAdmin, authenticateAttendee } = require('../middleware/auth');
const { handleValidationErrors, validateSurvey, validateUUID } = require('../middleware/validate');

const prisma = new PrismaClient();

/**
 * GET /surveys/conference/:conferenceId
 * List all surveys for a conference (admin)
 */
router.get('/conference/:conferenceId', authenticateAdmin, validateUUID('conferenceId'), handleValidationErrors, async (req, res) => {
  try {
    const conference = await prisma.conference.findFirst({
      where: {
        id: req.params.conferenceId,
        adminId: req.adminId
      }
    });
    
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found.' });
    }
    
    const surveys = await prisma.survey.findMany({
      where: { conferenceId: req.params.conferenceId },
      include: {
        _count: {
          select: { questions: true }
        },
        questions: {
          select: {
            id: true,
            _count: {
              select: { responses: true }
            }
          }
        }
      },
      orderBy: { sortOrder: 'asc' }
    });
    
    // Calculate response count per survey
    const surveysWithCounts = surveys.map(survey => {
      const responseCount = survey.questions.reduce((max, q) => 
        Math.max(max, q._count.responses), 0
      );
      
      return {
        ...survey,
        questionCount: survey._count.questions,
        responseCount,
        questions: undefined,
        _count: undefined
      };
    });
    
    res.json(surveysWithCounts);
  } catch (error) {
    console.error('List surveys error:', error);
    res.status(500).json({ error: 'Failed to fetch surveys.' });
  }
});

/**
 * GET /surveys/active
 * Get all active surveys for attendee's conference
 */
router.get('/active', authenticateAttendee, async (req, res) => {
  try {
    const surveys = await prisma.survey.findMany({
      where: {
        conferenceId: req.conferenceId,
        status: 'active'
      },
      include: {
        _count: { select: { questions: true } }
      },
      orderBy: { sortOrder: 'asc' }
    });
    
    // Get attendee's completed surveys
    const responses = await prisma.response.findMany({
      where: { attendeeId: req.attendeeId },
      select: { question: { select: { surveyId: true } } }
    });
    
    const completedSurveyIds = new Set(
      responses.map(r => r.question.surveyId)
    );
    
    const surveysWithStatus = surveys.map(s => ({
      ...s,
      questionCount: s._count.questions,
      isCompleted: completedSurveyIds.has(s.id),
      _count: undefined
    }));
    
    res.json(surveysWithStatus);
  } catch (error) {
    console.error('Get active surveys error:', error);
    res.status(500).json({ error: 'Failed to fetch surveys.' });
  }
});

/**
 * GET /surveys/attendee/:id
 * Get specific survey for attendee (with questions)
 */
router.get('/attendee/:id', authenticateAttendee, validateUUID('id'), handleValidationErrors, async (req, res) => {
  try {
    const survey = await prisma.survey.findFirst({
      where: {
        id: req.params.id,
        conferenceId: req.conferenceId,
        status: 'active'
      },
      include: {
        questions: {
          orderBy: { sortOrder: 'asc' }
        }
      }
    });
    
    if (!survey) {
      return res.status(404).json({ error: 'Survey not found or not active.' });
    }
    
    // Check if already completed
    const existingResponse = await prisma.response.findFirst({
      where: {
        attendeeId: req.attendeeId,
        question: { surveyId: survey.id }
      }
    });
    
    if (existingResponse) {
      return res.status(400).json({ 
        error: 'You have already completed this survey.',
        alreadyCompleted: true
      });
    }
    
    res.json(survey);
  } catch (error) {
    console.error('Get survey for attendee error:', error);
    res.status(500).json({ error: 'Failed to fetch survey.' });
  }
});

/**
 * POST /surveys
 * Create a new survey
 */
router.post('/', authenticateAdmin, validateSurvey, handleValidationErrors, async (req, res) => {
  try {
    const { conferenceId, title, description } = req.body;
    
    // Verify conference ownership
    const conference = await prisma.conference.findFirst({
      where: {
        id: conferenceId,
        adminId: req.adminId
      }
    });
    
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found.' });
    }
    
    // Get max sort order
    const maxSort = await prisma.survey.aggregate({
      where: { conferenceId },
      _max: { sortOrder: true }
    });
    
    const survey = await prisma.survey.create({
      data: {
        conferenceId,
        title,
        description,
        status: 'draft',
        sortOrder: (maxSort._max.sortOrder || 0) + 1
      }
    });
    
    res.status(201).json(survey);
  } catch (error) {
    console.error('Create survey error:', error);
    res.status(500).json({ error: 'Failed to create survey.' });
  }
});

/**
 * GET /surveys/:id
 * Get survey with questions
 */
router.get('/:id', authenticateAdmin, validateUUID('id'), handleValidationErrors, async (req, res) => {
  try {
    const survey = await prisma.survey.findUnique({
      where: { id: req.params.id },
      include: {
        conference: {
          select: { adminId: true, name: true }
        },
        questions: {
          orderBy: { sortOrder: 'asc' }
        },
        _count: {
          select: { questions: true }
        }
      }
    });
    
    if (!survey) {
      return res.status(404).json({ error: 'Survey not found.' });
    }
    
    if (survey.conference.adminId !== req.adminId) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    
    res.json(survey);
  } catch (error) {
    console.error('Get survey error:', error);
    res.status(500).json({ error: 'Failed to fetch survey.' });
  }
});

/**
 * PUT /surveys/:id
 * Update survey
 */
router.put('/:id', authenticateAdmin, validateUUID('id'), validateSurvey, handleValidationErrors, async (req, res) => {
  try {
    const { title, description, sortOrder } = req.body;
    
    const survey = await prisma.survey.findUnique({
      where: { id: req.params.id },
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
    
    const updated = await prisma.survey.update({
      where: { id: req.params.id },
      data: { title, description, sortOrder }
    });
    
    res.json(updated);
  } catch (error) {
    console.error('Update survey error:', error);
    res.status(500).json({ error: 'Failed to update survey.' });
  }
});

/**
 * PUT /surveys/:id/activate
 * Activate survey (deactivates others in same conference)
 */
router.put('/:id/activate', authenticateAdmin, validateUUID('id'), handleValidationErrors, async (req, res) => {
  try {
    const { sendNotification = true } = req.body; // Option to skip email
    
    const survey = await prisma.survey.findUnique({
      where: { id: req.params.id },
      include: {
        conference: { select: { adminId: true, id: true, name: true, urlCode: true } }
      }
    });
    
    if (!survey) {
      return res.status(404).json({ error: 'Survey not found.' });
    }
    
    if (survey.conference.adminId !== req.adminId) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    
    // Deactivate all other surveys in this conference
    await prisma.survey.updateMany({
      where: {
        conferenceId: survey.conferenceId,
        id: { not: survey.id },
        status: 'active'
      },
      data: { status: 'inactive' }
    });
    
    // Activate this survey
    const updated = await prisma.survey.update({
      where: { id: req.params.id },
      data: { status: 'active' }
    });
    
    // Emit WebSocket event
    const io = req.app.get('io');
    io.to(`conference:${survey.conferenceId}`).emit('survey_activated', {
      surveyId: survey.id,
      title: survey.title
    });
    
    // Send email notifications to all attendees (async, don't wait)
    if (sendNotification) {
      const { sendSurveyNotificationEmail } = require('../services/emailService');
      const config = require('../config');
      
      // Get all attendees for this conference
      const attendees = await prisma.attendee.findMany({
        where: { 
          conferenceId: survey.conferenceId,
          status: { in: ['active', 'first_login'] }
        },
        select: { email: true, firstName: true }
      });
      
      // Build survey URL
      const baseUrl = config.frontendUrl || process.env.FRONTEND_URL || 'https://affectionate-courage-production.up.railway.app';
      const surveyUrl = `${baseUrl}/c/${survey.conference.urlCode}/surveys`;
      
      // Send emails in background (don't block response)
      setImmediate(async () => {
        let sent = 0;
        let failed = 0;
        
        for (const attendee of attendees) {
          try {
            await sendSurveyNotificationEmail(attendee.email, {
              conferenceName: survey.conference.name,
              surveyTitle: survey.title,
              surveyUrl,
              firstName: attendee.firstName
            });
            sent++;
          } catch (err) {
            console.error(`Failed to send notification to ${attendee.email}:`, err.message);
            failed++;
          }
        }
        
        console.log(`Survey notification emails: ${sent} sent, ${failed} failed`);
      });
    }
    
    res.json(updated);
  } catch (error) {
    console.error('Activate survey error:', error);
    res.status(500).json({ error: 'Failed to activate survey.' });
  }
});

/**
 * PUT /surveys/:id/deactivate
 * Deactivate survey
 */
router.put('/:id/deactivate', authenticateAdmin, validateUUID('id'), handleValidationErrors, async (req, res) => {
  try {
    const survey = await prisma.survey.findUnique({
      where: { id: req.params.id },
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
    
    const updated = await prisma.survey.update({
      where: { id: req.params.id },
      data: { status: 'inactive' }
    });
    
    // Emit WebSocket event
    const io = req.app.get('io');
    io.to(`conference:${survey.conferenceId}`).emit('survey_deactivated', {
      surveyId: survey.id
    });
    
    res.json(updated);
  } catch (error) {
    console.error('Deactivate survey error:', error);
    res.status(500).json({ error: 'Failed to deactivate survey.' });
  }
});

/**
 * DELETE /surveys/:id
 * Delete survey
 */
router.delete('/:id', authenticateAdmin, validateUUID('id'), handleValidationErrors, async (req, res) => {
  try {
    const survey = await prisma.survey.findUnique({
      where: { id: req.params.id },
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
    
    await prisma.survey.delete({
      where: { id: req.params.id }
    });
    
    res.json({ message: 'Survey deleted successfully.' });
  } catch (error) {
    console.error('Delete survey error:', error);
    res.status(500).json({ error: 'Failed to delete survey.' });
  }
});

module.exports = router;
