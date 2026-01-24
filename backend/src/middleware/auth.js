const { verifyJWT } = require('../utils/jwt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Authenticate admin users
 */
async function authenticateAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyJWT(token);

    if (!decoded || decoded.type !== 'admin') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const admin = await prisma.admin.findUnique({
      where: { id: decoded.id }
    });

    if (!admin) {
      return res.status(401).json({ error: 'Admin not found' });
    }

    req.admin = admin;
    req.adminId = admin.id;
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Authenticate attendee users
 */
async function authenticateAttendee(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyJWT(token);

    if (!decoded || decoded.type !== 'attendee') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const attendee = await prisma.attendee.findUnique({
      where: { id: decoded.id },
      include: { conference: true }
    });

    if (!attendee) {
      return res.status(401).json({ error: 'Attendee not found' });
    }

    if (attendee.status === 'locked') {
      if (attendee.lockedUntil && new Date() < attendee.lockedUntil) {
        return res.status(423).json({ 
          error: 'Account locked due to too many failed attempts. Try again later.',
          lockedUntil: attendee.lockedUntil
        });
      }
    }

    req.attendee = attendee;
    req.attendeeId = attendee.id;
    req.conferenceId = attendee.conferenceId;
    next();
  } catch (error) {
    console.error('Attendee auth error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Optional authentication - doesn't fail if no token
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyJWT(token);

    if (decoded) {
      if (decoded.type === 'admin') {
        req.admin = await prisma.admin.findUnique({ where: { id: decoded.id } });
        req.adminId = decoded.id;
      } else if (decoded.type === 'attendee') {
        req.attendee = await prisma.attendee.findUnique({ 
          where: { id: decoded.id },
          include: { conference: true }
        });
        req.attendeeId = decoded.id;
        req.conferenceId = decoded.conferenceId;
      }
    }
    
    next();
  } catch (error) {
    next();
  }
}

module.exports = {
  authenticateAdmin,
  authenticateAttendee,
  optionalAuth
};
