const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const { authenticateAdmin } = require('../middleware/auth');
const { handleValidationErrors, validateConference, validateUUID } = require('../middleware/validate');
const { generateQRCodeDataURL, generateQRCodeBuffer, generateQRCodeSVG, buildConferenceURL } = require('../utils/qrcode');

const prisma = new PrismaClient();

/**
 * Generate URL code from conference name
 */
function generateUrlCode(name) {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 40);
  
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${base}-${suffix}`;
}

/**
 * GET /conferences
 * List all conferences for the authenticated admin
 */
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const conferences = await prisma.conference.findMany({
      where: { adminId: req.adminId },
      include: {
        _count: {
          select: {
            attendees: true,
            surveys: true
          }
        }
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

/**
 * POST /conferences
 * Create a new conference
 */
router.post('/', authenticateAdmin, validateConference, handleValidationErrors, async (req, res) => {
  try {
    const { name, urlCode, description, startDate, endDate } = req.body;
    
    // Generate URL code if not provided
    const finalUrlCode = urlCode || generateUrlCode(name);
    
    // Check if URL code is unique
    const existingConf = await prisma.conference.findUnique({
      where: { urlCode: finalUrlCode }
    });
    
    if (existingConf) {
      return res.status(409).json({ error: 'A conference with this URL code already exists.' });
    }
    
    // Generate QR code
    const conferenceUrl = buildConferenceURL(finalUrlCode);
    const qrCodeDataUrl = await generateQRCodeDataURL(conferenceUrl);
    
    const conference = await prisma.conference.create({
      data: {
        name,
        urlCode: finalUrlCode,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        adminId: req.adminId,
        qrCodeUrl: qrCodeDataUrl,
        status: 'draft'
      }
    });
    
    res.status(201).json({
      ...conference,
      conferenceUrl
    });
  } catch (error) {
    console.error('Create conference error:', error);
    res.status(500).json({ error: 'Failed to create conference.' });
  }
});

/**
 * GET /conferences/:id
 * Get conference details
 */
router.get('/:id', authenticateAdmin, validateUUID('id'), handleValidationErrors, async (req, res) => {
  try {
    const conference = await prisma.conference.findFirst({
      where: {
        id: req.params.id,
        adminId: req.adminId
      },
      include: {
        _count: {
          select: {
            attendees: true,
            surveys: true
          }
        },
        surveys: {
          orderBy: { sortOrder: 'asc' },
          include: {
            _count: {
              select: { questions: true }
            }
          }
        }
      }
    });
    
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found.' });
    }
    
    res.json({
      ...conference,
      attendeeCount: conference._count.attendees,
      surveyCount: conference._count.surveys,
      conferenceUrl: buildConferenceURL(conference.urlCode)
    });
  } catch (error) {
    console.error('Get conference error:', error);
    res.status(500).json({ error: 'Failed to fetch conference.' });
  }
});

/**
 * PUT /conferences/:id
 * Update conference
 */
router.put('/:id', authenticateAdmin, validateUUID('id'), validateConference, handleValidationErrors, async (req, res) => {
  try {
    const { name, description, startDate, endDate, status } = req.body;
    
    const conference = await prisma.conference.findFirst({
      where: {
        id: req.params.id,
        adminId: req.adminId
      }
    });
    
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found.' });
    }
    
    const updated = await prisma.conference.update({
      where: { id: req.params.id },
      data: {
        name,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: status || conference.status
      }
    });
    
    res.json(updated);
  } catch (error) {
    console.error('Update conference error:', error);
    res.status(500).json({ error: 'Failed to update conference.' });
  }
});

/**
 * DELETE /conferences/:id
 * Archive conference (soft delete)
 */
router.delete('/:id', authenticateAdmin, validateUUID('id'), handleValidationErrors, async (req, res) => {
  try {
    const conference = await prisma.conference.findFirst({
      where: {
        id: req.params.id,
        adminId: req.adminId
      }
    });
    
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found.' });
    }
    
    await prisma.conference.update({
      where: { id: req.params.id },
      data: { status: 'archived' }
    });
    
    res.json({ message: 'Conference archived successfully.' });
  } catch (error) {
    console.error('Archive conference error:', error);
    res.status(500).json({ error: 'Failed to archive conference.' });
  }
});

/**
 * POST /conferences/:id/activate
 * Activate conference
 */
router.post('/:id/activate', authenticateAdmin, validateUUID('id'), handleValidationErrors, async (req, res) => {
  try {
    const conference = await prisma.conference.findFirst({
      where: {
        id: req.params.id,
        adminId: req.adminId
      }
    });
    
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found.' });
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

/**
 * POST /conferences/:id/qr-code
 * Regenerate QR code
 */
router.post('/:id/qr-code', authenticateAdmin, validateUUID('id'), handleValidationErrors, async (req, res) => {
  try {
    const conference = await prisma.conference.findFirst({
      where: {
        id: req.params.id,
        adminId: req.adminId
      }
    });
    
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found.' });
    }
    
    const conferenceUrl = buildConferenceURL(conference.urlCode);
    const qrCodeDataUrl = await generateQRCodeDataURL(conferenceUrl);
    
    await prisma.conference.update({
      where: { id: req.params.id },
      data: { qrCodeUrl: qrCodeDataUrl }
    });
    
    res.json({ qrCodeUrl: qrCodeDataUrl, conferenceUrl });
  } catch (error) {
    console.error('Regenerate QR error:', error);
    res.status(500).json({ error: 'Failed to regenerate QR code.' });
  }
});

/**
 * GET /conferences/:id/qr-code/png
 * Download QR code as PNG
 */
router.get('/:id/qr-code/png', authenticateAdmin, validateUUID('id'), handleValidationErrors, async (req, res) => {
  try {
    const conference = await prisma.conference.findFirst({
      where: {
        id: req.params.id,
        adminId: req.adminId
      }
    });
    
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found.' });
    }
    
    const conferenceUrl = buildConferenceURL(conference.urlCode);
    const qrBuffer = await generateQRCodeBuffer(conferenceUrl);
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${conference.urlCode}-qr.png"`);
    res.send(qrBuffer);
  } catch (error) {
    console.error('Download QR PNG error:', error);
    res.status(500).json({ error: 'Failed to generate QR code.' });
  }
});

/**
 * GET /conferences/:id/qr-code/svg
 * Download QR code as SVG
 */
router.get('/:id/qr-code/svg', authenticateAdmin, validateUUID('id'), handleValidationErrors, async (req, res) => {
  try {
    const conference = await prisma.conference.findFirst({
      where: {
        id: req.params.id,
        adminId: req.adminId
      }
    });
    
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found.' });
    }
    
    const conferenceUrl = buildConferenceURL(conference.urlCode);
    const qrSvg = await generateQRCodeSVG(conferenceUrl);
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Content-Disposition', `attachment; filename="${conference.urlCode}-qr.svg"`);
    res.send(qrSvg);
  } catch (error) {
    console.error('Download QR SVG error:', error);
    res.status(500).json({ error: 'Failed to generate QR code.' });
  }
});

/**
 * GET /conferences/by-code/:code
 * Get conference by URL code (public endpoint for attendees)
 */
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
      return res.status(404).json({ error: 'Conference not found. Please check the QR code.' });
    }
    
    res.json(conference);
  } catch (error) {
    console.error('Get conference by code error:', error);
    res.status(500).json({ error: 'Failed to fetch conference.' });
  }
});

module.exports = router;
