const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateAdmin } = require('../middleware/auth');
const { handleValidationErrors, validateQuestion, validateUUID } = require('../middleware/validate');

const prisma = new PrismaClient();

// Get all questions for a survey
router.get('/survey/:surveyId', authenticateAdmin, validateUUID('surveyId'), handleValidationErrors, async (req, res) => {
  try {
    const survey = await prisma.survey.findUnique({
      where: { id: req.params.surveyId },
      include: { conference: { select: { adminId: true } } }
    });
    
    if (!survey) return res.status(404).json({ error: 'Survey not found' });
    if (survey.conference.adminId !== req.adminId) return res.status(403).json({ error: 'Access denied' });
    
    const questions = await prisma.question.findMany({
      where: { surveyId: req.params.surveyId },
      orderBy: { sortOrder: 'asc' }
    });
    
    res.json(questions);
  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// Create a new question
router.post('/', authenticateAdmin, validateQuestion, handleValidationErrors, async (req, res) => {
  try {
    const { surveyId, text, type, options, isRequired, helpText } = req.body;
    
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: { conference: { select: { adminId: true } } }
    });
    
    if (!survey) return res.status(404).json({ error: 'Survey not found' });
    if (survey.conference.adminId !== req.adminId) return res.status(403).json({ error: 'Access denied' });
    
    const maxSort = await prisma.question.aggregate({
      where: { surveyId },
      _max: { sortOrder: true }
    });
    
    const question = await prisma.question.create({
      data: {
        surveyId,
        text,
        type,
        options: options || {},
        isRequired: isRequired || false,
        helpText,
        sortOrder: (maxSort._max.sortOrder || 0) + 1
      }
    });
    
    res.status(201).json(question);
  } catch (error) {
    console.error('Create question error:', error);
    res.status(500).json({ error: 'Failed to create question' });
  }
});

// Update a question
router.put('/:id', authenticateAdmin, validateUUID('id'), handleValidationErrors, async (req, res) => {
  try {
    const { text, type, options, isRequired, helpText, sortOrder } = req.body;
    
    const question = await prisma.question.findUnique({
      where: { id: req.params.id },
      include: { survey: { include: { conference: { select: { adminId: true } } } } }
    });
    
    if (!question) return res.status(404).json({ error: 'Question not found' });
    if (question.survey.conference.adminId !== req.adminId) return res.status(403).json({ error: 'Access denied' });
    
    const updated = await prisma.question.update({
      where: { id: req.params.id },
      data: { text, type, options, isRequired, helpText, sortOrder }
    });
    
    res.json(updated);
  } catch (error) {
    console.error('Update question error:', error);
    res.status(500).json({ error: 'Failed to update question' });
  }
});

// Reorder questions
router.put('/reorder', authenticateAdmin, async (req, res) => {
  try {
    const { surveyId, questionIds } = req.body;
    
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: { conference: { select: { adminId: true } } }
    });
    
    if (!survey) return res.status(404).json({ error: 'Survey not found' });
    if (survey.conference.adminId !== req.adminId) return res.status(403).json({ error: 'Access denied' });
    
    await Promise.all(
      questionIds.map((id, index) =>
        prisma.question.update({ where: { id }, data: { sortOrder: index } })
      )
    );
    
    res.json({ message: 'Questions reordered' });
  } catch (error) {
    console.error('Reorder error:', error);
    res.status(500).json({ error: 'Failed to reorder' });
  }
});

// Delete a question
router.delete('/:id', authenticateAdmin, validateUUID('id'), handleValidationErrors, async (req, res) => {
  try {
    const question = await prisma.question.findUnique({
      where: { id: req.params.id },
      include: { survey: { include: { conference: { select: { adminId: true } } } } }
    });
    
    if (!question) return res.status(404).json({ error: 'Question not found' });
    if (question.survey.conference.adminId !== req.adminId) return res.status(403).json({ error: 'Access denied' });
    
    await prisma.question.delete({ where: { id: req.params.id } });
    
    res.json({ message: 'Question deleted' });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

module.exports = router;
