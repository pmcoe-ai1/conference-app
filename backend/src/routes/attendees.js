const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateAdmin } = require('../middleware/auth');

const prisma = new PrismaClient();

// GET /attendees/conference/:conferenceId - List attendees
router.get('/conference/:conferenceId', authenticateAdmin, async (req, res) => {
  try {
    const { conferenceId } = req.params;
    const { status, search, page = 1, limit = 50 } = req.query;
    
    // Verify conference belongs to admin
    const conference = await prisma.conference.findFirst({
      where: { id: conferenceId, adminId: req.adminId }
    });
    
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found' });
    }
    
    // Build where clause
    const where = { conferenceId };
    
    if (status && ['first_login', 'active', 'locked'].includes(status)) {
      where.status = status;
    }
    
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    // Get attendees with pagination
    const [attendees, total] = await Promise.all([
      prisma.attendee.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          firstLoginAt: true,
          lastLoginAt: true,
          _count: { select: { responses: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.attendee.count({ where })
    ]);
    
    res.json({
      attendees: attendees.map(a => ({
        ...a,
        responseCount: a._count.responses,
        _count: undefined
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('List attendees error:', error);
    res.status(500).json({ error: 'Failed to fetch attendees' });
  }
});

// GET /attendees/:id - Get single attendee
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    const attendee = await prisma.attendee.findUnique({
      where: { id: req.params.id },
      include: {
        conference: { select: { adminId: true } },
        _count: { select: { responses: true } }
      }
    });
    
    if (!attendee) {
      return res.status(404).json({ error: 'Attendee not found' });
    }
    
    if (attendee.conference.adminId !== req.adminId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json({
      id: attendee.id,
      email: attendee.email,
      firstName: attendee.firstName,
      lastName: attendee.lastName,
      status: attendee.status,
      firstLoginAt: attendee.firstLoginAt,
      lastLoginAt: attendee.lastLoginAt,
      responseCount: attendee._count.responses
    });
  } catch (error) {
    console.error('Get attendee error:', error);
    res.status(500).json({ error: 'Failed to fetch attendee' });
  }
});

// PUT /attendees/:id/unlock - Unlock attendee account
router.put('/:id/unlock', authenticateAdmin, async (req, res) => {
  try {
    const attendee = await prisma.attendee.findUnique({
      where: { id: req.params.id },
      include: { conference: { select: { adminId: true } } }
    });
    
    if (!attendee) {
      return res.status(404).json({ error: 'Attendee not found' });
    }
    
    if (attendee.conference.adminId !== req.adminId) {
      return res.status(403).json({ error: 'Access denied' });
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
      message: 'Account unlocked',
      attendee: {
        id: updated.id,
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        status: updated.status
      }
    });
  } catch (error) {
    console.error('Unlock attendee error:', error);
    res.status(500).json({ error: 'Failed to unlock account' });
  }
});

// DELETE /attendees/:id - Remove attendee
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const attendee = await prisma.attendee.findUnique({
      where: { id: req.params.id },
      include: { conference: { select: { adminId: true } } }
    });
    
    if (!attendee) {
      return res.status(404).json({ error: 'Attendee not found' });
    }
    
    if (attendee.conference.adminId !== req.adminId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await prisma.attendee.delete({ where: { id: req.params.id } });
    
    res.json({ message: 'Attendee removed' });
  } catch (error) {
    console.error('Delete attendee error:', error);
    res.status(500).json({ error: 'Failed to remove attendee' });
  }
});

module.exports = router;
