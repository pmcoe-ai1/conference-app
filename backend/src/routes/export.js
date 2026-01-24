const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const PDFDocument = require('pdfkit');

const { authenticateAdmin } = require('../middleware/auth');
const { handleValidationErrors, validateUUID } = require('../middleware/validate');

const prisma = new PrismaClient();

/**
 * GET /export/survey/:surveyId/csv
 * Export survey responses as CSV
 */
router.get('/survey/:surveyId/csv', authenticateAdmin, validateUUID('surveyId'), handleValidationErrors, async (req, res) => {
  try {
    const survey = await prisma.survey.findUnique({
      where: { id: req.params.surveyId },
      include: {
        conference: { select: { adminId: true, name: true, urlCode: true } },
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
    
    // Get all responses grouped by attendee
    const responses = await prisma.response.findMany({
      where: {
        question: { surveyId: survey.id }
      },
      include: {
        attendee: { select: { email: true } },
        question: { select: { text: true, type: true, sortOrder: true } }
      },
      orderBy: [
        { attendeeId: 'asc' },
        { question: { sortOrder: 'asc' } }
      ]
    });
    
    // Build CSV
    const headers = ['response_id', 'attendee_email', 'question_text', 'question_type', 'answer', 'submitted_at'];
    
    const rows = responses.map(r => {
      let answerStr = '';
      if (typeof r.answer === 'object') {
        if (Array.isArray(r.answer.selected)) {
          answerStr = r.answer.selected.join('; ');
        } else if (r.answer.selected) {
          answerStr = r.answer.selected;
        } else if (r.answer.value !== undefined) {
          answerStr = String(r.answer.value);
        } else {
          answerStr = JSON.stringify(r.answer);
        }
      } else {
        answerStr = String(r.answer);
      }
      
      return [
        r.id,
        r.attendee.email,
        `"${r.question.text.replace(/"/g, '""')}"`,
        r.question.type,
        `"${answerStr.replace(/"/g, '""')}"`,
        r.submittedAt.toISOString()
      ];
    });
    
    // Add BOM for Excel UTF-8 compatibility
    const BOM = '\ufeff';
    const csv = BOM + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const filename = `${survey.conference.urlCode}_${survey.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error('Export CSV error:', error);
    res.status(500).json({ error: 'Failed to export CSV.' });
  }
});

/**
 * GET /export/survey/:surveyId/pdf
 * Export survey statistics as PDF
 */
router.get('/survey/:surveyId/pdf', authenticateAdmin, validateUUID('surveyId'), handleValidationErrors, async (req, res) => {
  try {
    const survey = await prisma.survey.findUnique({
      where: { id: req.params.surveyId },
      include: {
        conference: { select: { adminId: true, name: true, urlCode: true } },
        questions: {
          orderBy: { sortOrder: 'asc' },
          include: {
            responses: true
          }
        }
      }
    });
    
    if (!survey) {
      return res.status(404).json({ error: 'Survey not found.' });
    }
    
    if (survey.conference.adminId !== req.adminId) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    
    // Create PDF
    const doc = new PDFDocument({ margin: 50 });
    
    const filename = `${survey.conference.urlCode}_${survey.title.replace(/\s+/g, '_')}_report_${new Date().toISOString().split('T')[0]}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    doc.pipe(res);
    
    // Title
    doc.fontSize(24).font('Helvetica-Bold').text('Survey Results Report', { align: 'center' });
    doc.moveDown();
    
    // Conference & Survey info
    doc.fontSize(14).font('Helvetica').text(`Conference: ${survey.conference.name}`);
    doc.text(`Survey: ${survey.title}`);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`);
    doc.moveDown();
    
    // Get unique respondents
    const uniqueRespondents = new Set();
    survey.questions.forEach(q => {
      q.responses.forEach(r => uniqueRespondents.add(r.attendeeId));
    });
    
    doc.fontSize(12).text(`Total Responses: ${uniqueRespondents.size}`);
    doc.moveDown(2);
    
    // Questions and statistics
    for (const question of survey.questions) {
      doc.fontSize(14).font('Helvetica-Bold').text(question.text);
      doc.fontSize(10).font('Helvetica').fillColor('#666').text(`Type: ${question.type.replace('_', ' ')}`);
      doc.fillColor('#000');
      doc.moveDown(0.5);
      
      const responses = question.responses;
      
      if (responses.length === 0) {
        doc.fontSize(11).text('No responses yet.');
      } else {
        switch (question.type) {
          case 'single_choice':
          case 'multi_choice':
          case 'numeric_range': {
            const counts = {};
            responses.forEach(r => {
              const values = Array.isArray(r.answer.selected) ? r.answer.selected : [r.answer.selected || r.answer.value || r.answer];
              values.forEach(v => {
                counts[v] = (counts[v] || 0) + 1;
              });
            });
            
            Object.entries(counts)
              .sort((a, b) => b[1] - a[1])
              .forEach(([option, count]) => {
                const pct = Math.round((count / responses.length) * 100);
                doc.fontSize(11).text(`• ${option}: ${count} (${pct}%)`);
              });
            break;
          }
          
          case 'rating': {
            let sum = 0;
            const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            
            responses.forEach(r => {
              const val = parseInt(r.answer.value || r.answer);
              if (val >= 1 && val <= 5) {
                counts[val]++;
                sum += val;
              }
            });
            
            const avg = (sum / responses.length).toFixed(1);
            doc.fontSize(12).font('Helvetica-Bold').text(`Average: ${avg} / 5`);
            doc.font('Helvetica');
            
            for (let i = 5; i >= 1; i--) {
              const pct = Math.round((counts[i] / responses.length) * 100);
              doc.fontSize(11).text(`${i} star${i > 1 ? 's' : ''}: ${counts[i]} (${pct}%)`);
            }
            break;
          }
          
          case 'text_short':
          case 'text_long': {
            doc.fontSize(11).text(`${responses.length} text responses collected.`);
            // Show first few responses
            responses.slice(0, 5).forEach((r, i) => {
              const text = r.answer.value || r.answer;
              doc.fontSize(10).fillColor('#444').text(`"${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
            });
            doc.fillColor('#000');
            if (responses.length > 5) {
              doc.fontSize(10).text(`... and ${responses.length - 5} more responses`);
            }
            break;
          }
        }
      }
      
      doc.moveDown(1.5);
      
      // Add page break if needed
      if (doc.y > 700) {
        doc.addPage();
      }
    }
    
    // Footer
    doc.fontSize(9).fillColor('#999').text(
      `Generated by Conference Survey App`,
      50,
      doc.page.height - 50,
      { align: 'center' }
    );
    
    doc.end();
  } catch (error) {
    console.error('Export PDF error:', error);
    res.status(500).json({ error: 'Failed to export PDF.' });
  }
});

/**
 * GET /export/conference/:conferenceId/attendees
 * Export attendee list as CSV
 */
router.get('/conference/:conferenceId/attendees', authenticateAdmin, validateUUID('conferenceId'), handleValidationErrors, async (req, res) => {
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
    
    const attendees = await prisma.attendee.findMany({
      where: { conferenceId: req.params.conferenceId },
      include: {
        _count: { select: { responses: true } }
      },
      orderBy: { createdAt: 'asc' }
    });
    
    const headers = ['email', 'status', 'first_login', 'last_login', 'response_count', 'created_at'];
    
    const rows = attendees.map(a => [
      a.email,
      a.status,
      a.firstLoginAt?.toISOString() || '',
      a.lastLoginAt?.toISOString() || '',
      a._count.responses,
      a.createdAt.toISOString()
    ]);
    
    const BOM = '\ufeff';
    const csv = BOM + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const filename = `${conference.urlCode}_attendees_${new Date().toISOString().split('T')[0]}.csv`;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error('Export attendees error:', error);
    res.status(500).json({ error: 'Failed to export attendees.' });
  }
});

module.exports = router;
