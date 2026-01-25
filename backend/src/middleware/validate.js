const { validationResult, body, param, query } = require('express-validator');

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array());
    return res.status(400).json({ 
      error: 'Validation failed',
      details: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
}

const validateEmail = body('email')
  .isEmail()
  .withMessage('Please enter a valid email address')
  .normalizeEmail();

const validatePassword = body('password')
  .isLength({ min: 8 })
  .withMessage('Password must be at least 8 characters');

const validateConferenceCode = [
  param('code')
    .isLength({ min: 3, max: 50 })
    .withMessage('Conference code must be 3-50 characters')
];

const validateConference = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Conference name is required'),
  body('urlCode')
    .optional({ checkFalsy: true }),
  body('description')
    .optional({ checkFalsy: true }),
  body('startDate')
    .notEmpty()
    .withMessage('Start date is required'),
  body('endDate')
    .notEmpty()
    .withMessage('End date is required')
];

const validateSurvey = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Survey title is required'),
  body('conferenceId')
    .notEmpty()
    .withMessage('Conference ID is required'),
  body('description')
    .optional({ checkFalsy: true })
];

const validateQuestion = [
  body('surveyId')
    .notEmpty()
    .withMessage('Survey ID is required'),
  body('text')
    .trim()
    .notEmpty()
    .withMessage('Question text is required'),
  body('type')
    .isIn(['single_choice', 'multi_choice', 'rating', 'numeric_range', 'text_short', 'text_long'])
    .withMessage('Invalid question type'),
  body('isRequired')
    .optional()
    .isBoolean(),
  body('options')
    .optional()
];

const validateResponse = [
  body('responses')
    .isArray()
    .withMessage('Responses must be an array'),
  body('responses.*.questionId')
    .isUUID()
    .withMessage('Invalid question ID')
];

const validateUUID = (paramName) => [
  param(paramName)
    .isUUID()
    .withMessage(`Invalid ${paramName}`)
];

module.exports = {
  handleValidationErrors,
  validateEmail,
  validatePassword,
  validateConferenceCode,
  validateConference,
  validateSurvey,
  validateQuestion,
  validateResponse,
  validateUUID
};
