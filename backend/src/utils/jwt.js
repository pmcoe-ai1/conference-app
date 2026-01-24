const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Generate a JWT token
 */
function generateJWT(payload, expiresIn = `${config.jwt.expiryHours}h`) {
  return jwt.sign(payload, config.jwt.secret, { expiresIn });
}

/**
 * Verify and decode a JWT token
 */
function verifyJWT(token) {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    return null;
  }
}

/**
 * Decode a JWT token without verification
 */
function decodeJWT(token) {
  return jwt.decode(token);
}

module.exports = {
  generateJWT,
  verifyJWT,
  decodeJWT
};
