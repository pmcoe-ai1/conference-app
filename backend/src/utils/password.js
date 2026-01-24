const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('../config');

/**
 * Generate a random password
 * Uses alphanumeric characters only for easy typing on mobile
 */
function generatePassword(length = config.password.length) {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const randomBytes = crypto.randomBytes(length);
  let password = '';
  
  for (let i = 0; i < length; i++) {
    password += chars[randomBytes[i] % chars.length];
  }
  
  return password;
}

/**
 * Hash a password using bcrypt
 */
async function hashPassword(password) {
  return bcrypt.hash(password, config.password.bcryptCost);
}

/**
 * Compare a password with its hash
 */
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a secure random token
 */
function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

module.exports = {
  generatePassword,
  hashPassword,
  comparePassword,
  generateToken
};
