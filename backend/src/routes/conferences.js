const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateAdmin } = require('../middleware/auth');
const { handleValidationErrors, validateConference, validateUUID } = require('../middleware/validate');
const { generateQRCodeDataURL, generateQRCodeBuffer, generateQRCodeSVG, buildConferenceURL } = require('../utils/qrcode');

const prisma = new PrismaClient();

function generateUrlCode(name) {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 40);
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${base}-${suffix}`;
}

// GET /conferences - List all conferences for admin
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const conferences = await prisma.conference.findMany({
      where: { adminId: req.adminId },
      include: {
        _count: { select: { attendees: true, surveys: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(conferences.map(conf => ({
      ...conf,
      attendeeCount: conf._count.attendees,
      surveyCount: conf._count.surveys,
      _count: undefined
    })));
  } catch (error) {
    console.error('List conferences error:', error);
    res.status(500).json({ error: 'Failed to fetch conferences.' });
  }
});

// POST /conferences - Create new conference
router.post('/', authenticateAdmin, validateConference, handleValidationErrors, async (req, res) => {
  try {
    const { name, urlCode, description, startDate, endDate } = req.body;
    
    const finalUrlCode = urlCode && urlCode.trim() ? urlCode.trim() : generateUrlCode(name);
    
    // Check if URL code already exists
    const existing = await prisma.conference.findUnique({ where: { urlCode: finalUrlCode } });
    if (existing) {
      return res.status(409).json({ error: 'URL code already exists. Please choose another.' });
    }
    
    // Build the conference URL (don't store QR data - generate on demand)
    const conferenceUrl = buildConferenceURL(finalUrlCode);
    
    const conference = await prisma.conference.create({
      data: {
        name,
        urlCode: finalUrlCode,
        description: description || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        adminId: req.adminId,
        qrCodeUrl: conferenceUrl, // Store just the URL, not the QR data
        status: 'draft'
      }
    });
    
    res.status(201).json({ ...conference, conferenceUrl });
  } catch (error) {
    console.error('Create conference error:', error);
    res.status(500).json({ error: 'Failed to create conference.' });
  }
});

// GET /conferences/by-code/:code - Public endpoint for attendees
router.get('/by-code/:code', async (req, res) => {
  try {
    const conference = await prisma.conference.findUnique({
      where: { urlCode: req.params.code },
      select: {
        id: true,
        name: true,
        urlCode: true,
        description: true,
        startDate: true,
        endDate: true,
        status: true
      }
    });
    
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found' });
    }
    
    res.json(conference);
  } catch (error) {
    console.error('Get conference by code error:', error);
    res.status(500).json({ error: 'Failed to fetch conference.' });
  }
});

// GET /conferences/:id - Get single conference
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    const conference = await prisma.conference.findFirst({
      where: { id: req.params.id, adminId: req.adminId },
      include: {
        _count: { select: { attendees: true, surveys: true } },
        surveys: { orderBy: { sortOrder: 'asc' } }
      }
    });
    
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found' });
    }
    
    res.json({
      ...conference,
      attendeeCount: conference._count.attendees,
      conferenceUrl: buildConferenceURL(conference.urlCode)
    });
  } catch (error) {
    console.error('Get conference error:', error);
    res.status(500).json({ error: 'Failed to fetch conference.' });
  }
});

// PUT /conferences/:id - Update conference
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { name, description, startDate, endDate, status } = req.body;
    
    const conference = await prisma.conference.findFirst({
      where: { id: req.params.id, adminId: req.adminId }
    });
    
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found' });
    }
    
    const updated = await prisma.conference.update({
      where: { id: req.params.id },
      data: {
        name: name || conference.name,
        description: description !== undefined ? description : conference.description,
        startDate: startDate ? new Date(startDate) : conference.startDate,
        endDate: endDate ? new Date(endDate) : conference.endDate,
        status: status || conference.status
      }
    });
    
    res.json(updated);
  } catch (error) {
    console.error('Update conference error:', error);
    res.status(500).json({ error: 'Failed to update conference.' });
  }
});

// POST /conferences/:id/activate - Activate conference
router.post('/:id/activate', authenticateAdmin, async (req, res) => {
  try {
    const conference = await prisma.conference.findFirst({
      where: { id: req.params.id, adminId: req.adminId }
    });
    
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found' });
    }
    
    const updated = await prisma.conference.update({
      where: { id: req.params.id },
      data: { status: 'active' }
    });
    
    res.json(updated);
  } catch (error) {
    console.error('Activate conference error:', error);
    res.status(500).json({ error: 'Failed to activate conference.' });
  }
});

// GET /conferences/:id/qr-code/png - Download QR as PNG
router.get('/:id/qr-code/png', authenticateAdmin, async (req, res) => {
  try {
    const conference = await prisma.conference.findFirst({
      where: { id: req.params.id, adminId: req.adminId }
    });
    
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found' });
    }
    
    const qrBuffer = await generateQRCodeBuffer(buildConferenceURL(conference.urlCode));
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${conference.urlCode}-qr.png"`);
    res.send(qrBuffer);
  } catch (error) {
    console.error('Generate QR PNG error:', error);
    res.status(500).json({ error: 'Failed to generate QR code.' });
  }
});

// GET /conferences/:id/qr-code/svg - Download QR as SVG
router.get('/:id/qr-code/svg', authenticateAdmin, async (req, res) => {
  try {
    const conference = await prisma.conference.findFirst({
      where: { id: req.params.id, adminId: req.adminId }
    });
    
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found' });
    }
    
    const qrSvg = await generateQRCodeSVG(buildConferenceURL(conference.urlCode));
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Content-Disposition', `attachment; filename="${conference.urlCode}-qr.svg"`);
    res.send(qrSvg);
  } catch (error) {
    console.error('Generate QR SVG error:', error);
    res.status(500).json({ error: 'Failed to generate QR code.' });
  }
});

// DELETE /conferences/:id - Delete conference
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const conference = await prisma.conference.findFirst({
      where: { id: req.params.id, adminId: req.adminId }
    });
    
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found' });
    }
    
    await prisma.conference.delete({ where: { id: req.params.id } });
    
    res.json({ message: 'Conference deleted successfully.' });
  } catch (error) {
    console.error('Delete conference error:', error);
    res.status(500).json({ error: 'Failed to delete conference.' });
  }
});

module.exports = router;
