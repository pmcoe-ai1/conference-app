const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const PDFDocument = require('pdfkit');
const { authenticateAdmin } = require('../middleware/auth');

const prisma = new PrismaClient();

// GET /export/survey/:surveyId/csv - Export survey responses as CSV
router.get('/survey/:surveyId/csv', authenticateAdmin, async (req, res) => {
  try {
    const { surveyId } = req.params;
    
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: { conference: true }
    });
    
    if (!survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }
    
    const responses = await prisma.response.findMany({
      where: { question: { surveyId: survey.id } },
      include: {
        attendee: { select: { email: true, firstName: true, lastName: true } },
        question: { select: { text: true, type: true } }
      }
    });
    
    // Build CSV
    const headers = ['id', 'first_name', 'last_name', 'email', 'question', 'type', 'answer', 'submitted'];
    const rows = responses.map(r => {
      let answer = '';
      if (Array.isArray(r.answer?.selected)) {
        answer = r.answer.selected.join('; ');
      } else if (r.answer?.selected) {
        answer = r.answer.selected;
      } else if (r.answer?.value !== undefined) {
        answer = r.answer.value;
      } else {
        answer = JSON.stringify(r.answer);
      }
      
      return [
        r.id,
        r.attendee.firstName || '',
        r.attendee.lastName || '',
        r.attendee.email,
        `"${r.question.text.replace(/"/g, '""')}"`,
        r.question.type,
        `"${String(answer).replace(/"/g, '""')}"`,
        r.submittedAt.toISOString()
      ];
    });
    
    const csv = '\ufeff' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${survey.conference.urlCode}_responses.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Export CSV error:', error);
    res.status(500).json({ error: 'Failed to export' });
  }
});

// GET /export/survey/:surveyId/pdf - Export survey report as PDF
router.get('/survey/:surveyId/pdf', authenticateAdmin, async (req, res) => {
  try {
    const { surveyId } = req.params;
    
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        conference: true,
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: { responses: true }
        }
      }
    });
    
    if (!survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }
    
    // Create PDF
    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${survey.conference.urlCode}_report.pdf"`);
    
    doc.pipe(res);
    
    // Title
    doc.fontSize(24).text('Survey Results', { align: 'center' });
    doc.moveDown();
    
    // Info
    doc.fontSize(14)
      .text(`Conference: ${survey.conference.name}`)
      .text(`Survey: ${survey.title}`)
      .text(`Date: ${new Date().toLocaleDateString()}`);
    doc.moveDown(2);
    
    // Summary
    const respondents = new Set();
    survey.questions.forEach(q => {
      q.responses.forEach(r => respondents.add(r.attendeeId));
    });
    
    doc.fontSize(12).text(`Total Responses: ${respondents.size}`);
    doc.moveDown(2);
    
    // Questions
    for (const question of survey.questions) {
      doc.fontSize(14).font('Helvetica-Bold').text(question.text);
      doc.fontSize(10).font('Helvetica').text(`${question.type} | ${question.responses.length} responses`);
      doc.moveDown();
    }
    
    doc.end();
  } catch (error) {
    console.error('Export PDF error:', error);
    res.status(500).json({ error: 'Failed to export' });
  }
});

// GET /export/conference/:conferenceId/attendees - Export attendee list as CSV
router.get('/conference/:conferenceId/attendees', authenticateAdmin, async (req, res) => {
  try {
    const { conferenceId } = req.params;
    
    const conference = await prisma.conference.findFirst({
      where: { id: conferenceId, adminId: req.adminId }
    });
    
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found' });
    }
    
    const attendees = await prisma.attendee.findMany({
      where: { conferenceId },
      include: { _count: { select: { responses: true } } }
    });
    
    // Build CSV with names
    const headers = ['first_name', 'last_name', 'email', 'status', 'first_login', 'last_login', 'responses'];
    const rows = attendees.map(a => [
      a.firstName || '',
      a.lastName || '',
      a.email,
      a.status,
      a.firstLoginAt?.toISOString() || '',
      a.lastLoginAt?.toISOString() || '',
      a._count.responses
    ]);
    
    const csv = '\ufeff' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${conference.urlCode}_attendees.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Export attendees error:', error);
    res.status(500).json({ error: 'Failed to export' });
  }
});

module.exports = router;
