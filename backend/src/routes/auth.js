const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { body } = require('express-validator');

const { generatePassword, hashPassword, comparePassword, generateToken } = require('../utils/password');
const { generateJWT } = require('../utils/jwt');
const { handleValidationErrors, validateEmail, validatePassword } = require('../middleware/validate');
const { sendPasswordEmail, sendPasswordResetEmail } = require('../services/emailService');
const config = require('../config');

const prisma = new PrismaClient();

/**
 * POST /auth/attendee/first-login
 * First-time login with email only
 */
router.post('/attendee/first-login', [
  validateEmail,
  body('conferenceCode').notEmpty().withMessage('Conference code is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { email, conferenceCode } = req.body;
    
    // Find conference
    const conference = await prisma.conference.findUnique({
      where: { urlCode: conferenceCode }
    });
    
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found. Please check the QR code.' });
    }
    
    if (conference.status !== 'active') {
      return res.status(400).json({ error: 'This conference is not currently active.' });
    }
    
    // Check if attendee already exists
    const existingAttendee = await prisma.attendee.findUnique({
      where: {
        conferenceId_email: {
          conferenceId: conference.id,
          email: email.toLowerCase()
        }
      }
    });
    
    if (existingAttendee) {
      if (existingAttendee.status === 'active') {
        return res.status(409).json({ 
          error: 'This email is already registered. Please log in with your password.',
          requiresPassword: true
        });
      }
      
      // Return existing attendee token for first_login status
      if (existingAttendee.status === 'first_login') {
        const token = generateJWT({
          id: existingAttendee.id,
          email: existingAttendee.email,
          conferenceId: conference.id,
          type: 'attendee'
        });
        
        return res.json({
          token,
          attendee: {
            id: existingAttendee.id,
            email: existingAttendee.email,
            status: existingAttendee.status
          },
          conference: {
            id: conference.id,
            name: conference.name,
            urlCode: conference.urlCode
          }
        });
      }
    }
    
    // Create new attendee
    const now = new Date();
    const attendee = await prisma.attendee.create({
      data: {
        conferenceId: conference.id,
        email: email.toLowerCase(),
        status: 'first_login',
        firstLoginAt: now,
        lastLoginAt: now
      }
    });
    
    // Generate password and schedule delivery for 24 hours later
    const password = generatePassword();
    const passwordHash = await hashPassword(password);
    
    // Store password hash (will be null until 24h later email sends)
    await prisma.attendee.update({
      where: { id: attendee.id },
      data: { passwordHash }
    });
    
    // Schedule password email
    const scheduledAt = new Date(now.getTime() + config.password.delayHours * 60 * 60 * 1000);
    
    await prisma.passwordQueue.create({
      data: {
        attendeeId: attendee.id,
        scheduledAt,
        status: 'pending'
      }
    });
    
    // Store password temporarily for the job to send (in production, use Redis or encrypted storage)
    // For this implementation, we'll send it immediately in dev mode
    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n🔐 Password for ${email}: ${password}`);
      console.log(`   (In production, this would be sent via email in 24 hours)\n`);
    }
    
    // Generate JWT
    const token = generateJWT({
      id: attendee.id,
      email: attendee.email,
      conferenceId: conference.id,
      type: 'attendee'
    });
    
    res.status(201).json({
      token,
      attendee: {
        id: attendee.id,
        email: attendee.email,
        status: attendee.status
      },
      conference: {
        id: conference.id,
        name: conference.name,
        urlCode: conference.urlCode
      }
    });
    
  } catch (error) {
    console.error('First login error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

/**
 * POST /auth/attendee/login
 * Return login with email and password
 */
router.post('/attendee/login', [
  validateEmail,
  body('password').notEmpty().withMessage('Password is required'),
  body('conferenceCode').notEmpty().withMessage('Conference code is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { email, password, conferenceCode } = req.body;
    
    // Find conference
    const conference = await prisma.conference.findUnique({
      where: { urlCode: conferenceCode }
    });
    
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found.' });
    }
    
    // Find attendee
    const attendee = await prisma.attendee.findUnique({
      where: {
        conferenceId_email: {
          conferenceId: conference.id,
          email: email.toLowerCase()
        }
      }
    });
    
    if (!attendee) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }
    
    // Check if locked
    if (attendee.status === 'locked') {
      if (attendee.lockedUntil && new Date() < attendee.lockedUntil) {
        const minutesRemaining = Math.ceil((attendee.lockedUntil - new Date()) / 60000);
        return res.status(423).json({ 
          error: `Account locked due to too many failed attempts. Try again in ${minutesRemaining} minutes.`,
          lockedUntil: attendee.lockedUntil
        });
      }
      
      // Unlock if lockout period has passed
      await prisma.attendee.update({
        where: { id: attendee.id },
        data: { status: 'active', failedAttempts: 0, lockedUntil: null }
      });
    }
    
    // Verify password
    if (!attendee.passwordHash) {
      return res.status(403).json({ 
        error: 'Your account is not yet active. Please check your email for your password.',
        status: 'pending_password'
      });
    }
    
    const passwordValid = await comparePassword(password, attendee.passwordHash);
    
    if (!passwordValid) {
      // Increment failed attempts
      const newFailedAttempts = attendee.failedAttempts + 1;
      
      if (newFailedAttempts >= config.lockout.attempts) {
        // Lock account
        const lockedUntil = new Date(Date.now() + config.lockout.durationMins * 60 * 1000);
        
        await prisma.attendee.update({
          where: { id: attendee.id },
          data: {
            status: 'locked',
            failedAttempts: newFailedAttempts,
            lockedUntil
          }
        });
        
        return res.status(423).json({ 
          error: `Account locked due to too many failed attempts. Try again in ${config.lockout.durationMins} minutes.`,
          lockedUntil
        });
      }
      
      await prisma.attendee.update({
        where: { id: attendee.id },
        data: { failedAttempts: newFailedAttempts }
      });
      
      const attemptsRemaining = config.lockout.attempts - newFailedAttempts;
      return res.status(401).json({ 
        error: `Incorrect email or password. ${attemptsRemaining} attempts remaining.`
      });
    }
    
    // Successful login - reset failed attempts and update status
    const updatedAttendee = await prisma.attendee.update({
      where: { id: attendee.id },
      data: {
        status: 'active',
        failedAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date()
      }
    });
    
    // Generate JWT
    const token = generateJWT({
      id: attendee.id,
      email: attendee.email,
      conferenceId: conference.id,
      type: 'attendee'
    });
    
    res.json({
      token,
      attendee: {
        id: updatedAttendee.id,
        email: updatedAttendee.email,
        status: updatedAttendee.status
      },
      conference: {
        id: conference.id,
        name: conference.name,
        urlCode: conference.urlCode
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

/**
 * POST /auth/attendee/forgot-password
 * Request password reset
 */
router.post('/attendee/forgot-password', [
  validateEmail,
  body('conferenceCode').notEmpty().withMessage('Conference code is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { email, conferenceCode } = req.body;
    
    // Find conference
    const conference = await prisma.conference.findUnique({
      where: { urlCode: conferenceCode }
    });
    
    if (!conference) {
      // Don't reveal if conference exists
      return res.json({ message: 'If an account exists, a reset link will be sent.' });
    }
    
    // Find attendee
    const attendee = await prisma.attendee.findUnique({
      where: {
        conferenceId_email: {
          conferenceId: conference.id,
          email: email.toLowerCase()
        }
      }
    });
    
    if (!attendee) {
      // Don't reveal if account exists
      return res.json({ message: 'If an account exists, a reset link will be sent.' });
    }
    
    // Generate reset token
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    
    await prisma.passwordReset.create({
      data: {
        email: attendee.email,
        token,
        expiresAt
      }
    });
    
    // Send reset email
    const resetUrl = `${process.env.FRONTEND_URL}/c/${conferenceCode}/reset-password?token=${token}`;
    
    await sendPasswordResetEmail(attendee.email, {
      conferenceName: conference.name,
      resetUrl,
      expiresIn: '1 hour'
    });
    
    res.json({ message: 'If an account exists, a reset link will be sent.' });
    
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Request failed. Please try again.' });
  }
});

/**
 * POST /auth/attendee/reset-password
 * Reset password with token
 */
router.post('/attendee/reset-password', [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('conferenceCode').notEmpty().withMessage('Conference code is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { token, newPassword, conferenceCode } = req.body;
    
    // Find reset request
    const resetRequest = await prisma.passwordReset.findUnique({
      where: { token }
    });
    
    if (!resetRequest || resetRequest.used || new Date() > resetRequest.expiresAt) {
      return res.status(400).json({ error: 'Invalid or expired reset link.' });
    }
    
    // Find conference
    const conference = await prisma.conference.findUnique({
      where: { urlCode: conferenceCode }
    });
    
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found.' });
    }
    
    // Find attendee
    const attendee = await prisma.attendee.findUnique({
      where: {
        conferenceId_email: {
          conferenceId: conference.id,
          email: resetRequest.email
        }
      }
    });
    
    if (!attendee) {
      return res.status(404).json({ error: 'Account not found.' });
    }
    
    // Update password
    const passwordHash = await hashPassword(newPassword);
    
    await prisma.attendee.update({
      where: { id: attendee.id },
      data: {
        passwordHash,
        status: 'active',
        failedAttempts: 0,
        lockedUntil: null
      }
    });
    
    // Mark token as used
    await prisma.passwordReset.update({
      where: { id: resetRequest.id },
      data: { used: true }
    });
    
    // Generate JWT
    const jwtToken = generateJWT({
      id: attendee.id,
      email: attendee.email,
      conferenceId: conference.id,
      type: 'attendee'
    });
    
    res.json({
      message: 'Password reset successful.',
      token: jwtToken,
      attendee: {
        id: attendee.id,
        email: attendee.email,
        status: 'active'
      }
    });
    
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Password reset failed. Please try again.' });
  }
});

/**
 * POST /auth/admin/login
 * Admin login
 */
router.post('/admin/login', [
  validateEmail,
  validatePassword,
  handleValidationErrors
], async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const admin = await prisma.admin.findUnique({
      where: { email: email.toLowerCase() }
    });
    
    if (!admin) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }
    
    const passwordValid = await comparePassword(password, admin.passwordHash);
    
    if (!passwordValid) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }
    
    const token = generateJWT({
      id: admin.id,
      email: admin.email,
      type: 'admin'
    });
    
    res.json({
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name
      }
    });
    
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

/**
 * POST /auth/admin/register
 * Admin registration (could be restricted in production)
 */
router.post('/admin/register', [
  validateEmail,
  validatePassword,
  body('name').optional().trim(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    const existingAdmin = await prisma.admin.findUnique({
      where: { email: email.toLowerCase() }
    });
    
    if (existingAdmin) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    
    const passwordHash = await hashPassword(password);
    
    const admin = await prisma.admin.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name
      }
    });
    
    const token = generateJWT({
      id: admin.id,
      email: admin.email,
      type: 'admin'
    });
    
    res.status(201).json({
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name
      }
    });
    
  } catch (error) {
    console.error('Admin registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

module.exports = router;
