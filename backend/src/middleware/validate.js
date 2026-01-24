const { validationResult, body, param, query } = require('express-validator');

/**
 * Validation error handler
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed',
      details: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
}

// Email validation
const validateEmail = body('email')
  .isEmail()
  .withMessage('Please enter a valid email address')
  .normalizeEmail()
  .isLength({ max: 255 })
  .withMessage('Email must be less than 255 characters');

// Password validation
const validatePassword = body('password')
  .isLength({ min: 8 })
  .withMessage('Password must be at least 8 characters');

// Conference code validation
const validateConferenceCode = [
  param('code')
    .matches(/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/)
    .withMessage('Invalid conference code format')
    .isLength({ min: 3, max: 50 })
    .withMessage('Conference code must be 3-50 characters')
];

// Conference creation validation
const validateConference = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Conference name is required')
    .isLength({ max: 255 })
    .withMessage('Conference name must be less than 255 characters'),
  body('urlCode')
    .optional()
    .matches(/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/)
    .withMessage('URL code can only contain letters, numbers, and hyphens')
    .isLength({ min: 3, max: 50 })
    .withMessage('URL code must be 3-50 characters'),
  body('description')
    .optional()
    .trim(),
  body('startDate')
    .isISO8601()
    .withMessage('Start date must be a valid date'),
  body('endDate')
    .isISO8601()
    .withMessage('End date must be a valid date')
    .custom((value, { req }) => {
      if (new Date(value) < new Date(req.body.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    })
];

// Survey validation
const validateSurvey = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Survey title is required')
    .isLength({ max: 255 })
    .withMessage('Survey title must be less than 255 characters'),
  body('description')
    .optional()
    .trim()
];

// Question validation
const validateQuestion = [
  body('text')
    .trim()
    .notEmpty()
    .withMessage('Question text is required'),
  body('type')
    .isIn(['single_choice', 'multi_choice', 'rating', 'numeric_range', 'text_short', 'text_long'])
    .withMessage('Invalid question type'),
  body('isRequired')
    .optional()
    .isBoolean()
    .withMessage('isRequired must be a boolean'),
  body('options')
    .optional()
    .isObject()
    .withMessage('Options must be an object')
];

// Response validation
const validateResponse = [
  body('responses')
    .isArray()
    .withMessage('Responses must be an array'),
  body('responses.*.questionId')
    .isUUID()
    .withMessage('Invalid question ID'),
  body('responses.*.answer')
    .notEmpty()
    .withMessage('Answer is required')
];

// UUID param validation
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
