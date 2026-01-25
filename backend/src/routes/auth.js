const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { generatePassword, hashPassword, comparePassword } = require('../utils/password');
const { generateJWT } = require('../utils/jwt');
const config = require('../config');

const prisma = new PrismaClient();

// POST /auth/attendee/first-login - First time registration
router.post('/attendee/first-login', async (req, res) => {
  try {
    const { email, firstName, lastName, conferenceCode } = req.body;
    
    if (!email || !conferenceCode) {
      return res.status(400).json({ error: 'Email and conference code are required' });
    }
    
    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'First name and last name are required' });
    }
    
    // Find the conference
    const conference = await prisma.conference.findUnique({
      where: { urlCode: conferenceCode }
    });
    
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found' });
    }
    
    if (conference.status !== 'active') {
      return res.status(400).json({ error: 'Conference is not active' });
    }
    
    // Check if attendee already exists
    const existing = await prisma.attendee.findUnique({
      where: {
        conferenceId_email: {
          conferenceId: conference.id,
          email: email.toLowerCase()
        }
      }
    });
    
    if (existing) {
      if (existing.status === 'active') {
        return res.status(409).json({ 
          error: 'You are already registered. Please login with your password.',
          requiresPassword: true 
        });
      }
      
      // Return token for existing first_login user
      const token = generateJWT({
        id: existing.id,
        email: existing.email,
        conferenceId: conference.id,
        type: 'attendee'
      });
      
      return res.json({
        token,
        attendee: {
          id: existing.id,
          email: existing.email,
          firstName: existing.firstName,
          lastName: existing.lastName,
          status: existing.status
        },
        conference: {
          id: conference.id,
          name: conference.name,
          urlCode: conference.urlCode
        }
      });
    }
    
    // Generate password for new attendee
    const password = generatePassword();
    const passwordHash = await hashPassword(password);
    
    // Create new attendee with name
    const attendee = await prisma.attendee.create({
      data: {
        conferenceId: conference.id,
        email: email.toLowerCase(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        passwordHash,
        status: 'first_login',
        firstLoginAt: new Date(),
        lastLoginAt: new Date()
      }
    });
    
    // Log password to console (in production, send via email)
    console.log(`\n🔐 Password for ${email}: ${password}\n`);
    
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
        firstName: attendee.firstName,
        lastName: attendee.lastName,
        status: attendee.status
      },
      conference: {
        id: conference.id,
        name: conference.name,
        urlCode: conference.urlCode
      },
      // Include password in response for demo (remove in production)
      generatedPassword: password
    });
  } catch (error) {
    console.error('First login error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /auth/attendee/login - Login with password
router.post('/attendee/login', async (req, res) => {
  try {
    const { email, password, conferenceCode } = req.body;
    
    if (!email || !password || !conferenceCode) {
      return res.status(400).json({ error: 'Email, password, and conference code are required' });
    }
    
    // Find the conference
    const conference = await prisma.conference.findUnique({
      where: { urlCode: conferenceCode }
    });
    
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found' });
    }
    
    // Find the attendee
    const attendee = await prisma.attendee.findUnique({
      where: {
        conferenceId_email: {
          conferenceId: conference.id,
          email: email.toLowerCase()
        }
      }
    });
    
    if (!attendee) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Check if locked
    if (attendee.status === 'locked' && attendee.lockedUntil && new Date() < attendee.lockedUntil) {
      return res.status(423).json({ 
        error: 'Account is locked. Please try again later.',
        lockedUntil: attendee.lockedUntil 
      });
    }
    
    // Check if password is set
    if (!attendee.passwordHash) {
      return res.status(403).json({ 
        error: 'Account not activated',
        status: 'pending_password' 
      });
    }
    
    // Verify password
    const valid = await comparePassword(password, attendee.passwordHash);
    
    if (!valid) {
      const attempts = attendee.failedAttempts + 1;
      
      if (attempts >= config.lockout.attempts) {
        const lockedUntil = new Date(Date.now() + config.lockout.durationMins * 60 * 1000);
        await prisma.attendee.update({
          where: { id: attendee.id },
          data: { status: 'locked', failedAttempts: attempts, lockedUntil }
        });
        return res.status(423).json({ 
          error: 'Account locked due to too many failed attempts',
          lockedUntil 
        });
      }
      
      await prisma.attendee.update({
        where: { id: attendee.id },
        data: { failedAttempts: attempts }
      });
      
      return res.status(401).json({ 
        error: `Invalid password. ${config.lockout.attempts - attempts} attempts remaining.` 
      });
    }
    
    // Successful login - update status and reset failed attempts
    const updated = await prisma.attendee.update({
      where: { id: attendee.id },
      data: {
        status: 'active',
        failedAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date()
      }
    });
    
    const token = generateJWT({
      id: attendee.id,
      email: attendee.email,
      conferenceId: conference.id,
      type: 'attendee'
    });
    
    res.json({
      token,
      attendee: {
        id: updated.id,
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        status: updated.status
      },
      conference: {
        id: conference.id,
        name: conference.name,
        urlCode: conference.urlCode
      }
    });
  } catch (error) {
    console.error('Attendee login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /auth/admin/login - Admin login
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const admin = await prisma.admin.findUnique({
      where: { email: email.toLowerCase() }
    });
    
    if (!admin) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const valid = await comparePassword(password, admin.passwordHash);
    
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
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
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;
