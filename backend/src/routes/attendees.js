const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const { authenticateAdmin } = require('../middleware/auth');
const { handleValidationErrors, validateUUID } = require('../middleware/validate');

const prisma = new PrismaClient();

/**
 * GET /attendees/conference/:conferenceId
 * List all attendees for a conference
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
    
    const { status, search, page = 1, limit = 50 } = req.query;
    
    const where = {
      conferenceId: req.params.conferenceId
    };
    
    if (status && ['first_login', 'active', 'locked'].includes(status)) {
      where.status = status;
    }
    
    if (search) {
      where.email = {
        contains: search,
        mode: 'insensitive'
      };
    }
    
    const [attendees, total] = await Promise.all([
      prisma.attendee.findMany({
        where,
        select: {
          id: true,
          email: true,
          status: true,
          firstLoginAt: true,
          lastLoginAt: true,
          failedAttempts: true,
          lockedUntil: true,
          createdAt: true,
          _count: {
            select: { responses: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.attendee.count({ where })
    ]);
    
    // Get survey count for response tracking
    const surveyCount = await prisma.survey.count({
      where: { conferenceId: req.params.conferenceId }
    });
    
    res.json({
      attendees: attendees.map(a => ({
        ...a,
        responseCount: a._count.responses,
        surveysCompleted: a._count.responses > 0 ? 1 : 0, // Simplified
        _count: undefined
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      surveyCount
    });
  } catch (error) {
    console.error('List attendees error:', error);
    res.status(500).json({ error: 'Failed to fetch attendees.' });
  }
});

/**
 * GET /attendees/:id
 * Get attendee details
 */
router.get('/:id', authenticateAdmin, validateUUID('id'), handleValidationErrors, async (req, res) => {
  try {
    const attendee = await prisma.attendee.findUnique({
      where: { id: req.params.id },
      include: {
        conference: {
          select: { adminId: true, name: true }
        },
        responses: {
          include: {
            question: {
              select: { text: true, type: true, surveyId: true }
            }
          }
        }
      }
    });
    
    if (!attendee) {
      return res.status(404).json({ error: 'Attendee not found.' });
    }
    
    if (attendee.conference.adminId !== req.adminId) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    
    // Get surveys completed
    const surveysCompleted = await prisma.response.groupBy({
      by: ['questionId'],
      where: { attendeeId: attendee.id },
      _count: true
    });
    
    res.json({
      ...attendee,
      responseCount: attendee.responses.length,
      passwordHash: undefined
    });
  } catch (error) {
    console.error('Get attendee error:', error);
    res.status(500).json({ error: 'Failed to fetch attendee.' });
  }
});

/**
 * PUT /attendees/:id/unlock
 * Unlock a locked attendee account
 */
router.put('/:id/unlock', authenticateAdmin, validateUUID('id'), handleValidationErrors, async (req, res) => {
  try {
    const attendee = await prisma.attendee.findUnique({
      where: { id: req.params.id },
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
    
    const updated = await prisma.attendee.update({
      where: { id: req.params.id },
      data: {
        status: 'active',
        failedAttempts: 0,
        lockedUntil: null
      }
    });
    
    res.json({
      message: 'Attendee account unlocked.',
      attendee: {
        id: updated.id,
        email: updated.email,
        status: updated.status
      }
    });
  } catch (error) {
    console.error('Unlock attendee error:', error);
    res.status(500).json({ error: 'Failed to unlock attendee.' });
  }
});

/**
 * DELETE /attendees/:id
 * Remove attendee (admin only)
 */
router.delete('/:id', authenticateAdmin, validateUUID('id'), handleValidationErrors, async (req, res) => {
  try {
    const attendee = await prisma.attendee.findUnique({
      where: { id: req.params.id },
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
    
    await prisma.attendee.delete({
      where: { id: req.params.id }
    });
    
    res.json({ message: 'Attendee removed successfully.' });
  } catch (error) {
    console.error('Delete attendee error:', error);
    res.status(500).json({ error: 'Failed to remove attendee.' });
  }
});

/**
 * GET /attendees/conference/:conferenceId/non-responders
 * Get attendees who haven't responded to active survey
 */
router.get('/conference/:conferenceId/non-responders', authenticateAdmin, validateUUID('conferenceId'), handleValidationErrors, async (req, res) => {
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
    
    // Get active survey
    const activeSurvey = await prisma.survey.findFirst({
      where: {
        conferenceId: req.params.conferenceId,
        status: 'active'
      }
    });
    
    if (!activeSurvey) {
      return res.json({ 
        message: 'No active survey.',
        nonResponders: [],
        activeSurvey: null
      });
    }
    
    // Get attendees who have responded
    const respondedAttendeeIds = await prisma.response.findMany({
      where: {
        question: { surveyId: activeSurvey.id }
      },
      select: { attendeeId: true },
      distinct: ['attendeeId']
    });
    
    const respondedIds = respondedAttendeeIds.map(r => r.attendeeId);
    
    // Get non-responders
    const nonResponders = await prisma.attendee.findMany({
      where: {
        conferenceId: req.params.conferenceId,
        id: { notIn: respondedIds }
      },
      select: {
        id: true,
        email: true,
        status: true,
        firstLoginAt: true,
        lastLoginAt: true
      }
    });
    
    res.json({
      activeSurvey: {
        id: activeSurvey.id,
        title: activeSurvey.title
      },
      nonResponders,
      totalAttendees: await prisma.attendee.count({
        where: { conferenceId: req.params.conferenceId }
      }),
      respondedCount: respondedIds.length
    });
  } catch (error) {
    console.error('Get non-responders error:', error);
    res.status(500).json({ error: 'Failed to fetch non-responders.' });
  }
});

module.exports = router;
