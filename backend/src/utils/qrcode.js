const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs').promises;

/**
 * Generate QR code as data URL
 */
async function generateQRCodeDataURL(text, options = {}) {
  const defaultOptions = {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    width: 1024,
    margin: 2,
    color: {
      dark: '#1e1b4b',
      light: '#ffffff'
    }
  };

  return QRCode.toDataURL(text, { ...defaultOptions, ...options });
}

/**
 * Generate QR code as Buffer
 */
async function generateQRCodeBuffer(text, options = {}) {
  const defaultOptions = {
    errorCorrectionLevel: 'M',
    type: 'png',
    width: 1024,
    margin: 2,
    color: {
      dark: '#1e1b4b',
      light: '#ffffff'
    }
  };

  return QRCode.toBuffer(text, { ...defaultOptions, ...options });
}

/**
 * Generate QR code SVG string
 */
async function generateQRCodeSVG(text, options = {}) {
  const defaultOptions = {
    errorCorrectionLevel: 'M',
    type: 'svg',
    width: 1024,
    margin: 2,
    color: {
      dark: '#1e1b4b',
      light: '#ffffff'
    }
  };

  return QRCode.toString(text, { ...defaultOptions, ...options });
}

/**
 * Build conference URL
 */
function buildConferenceURL(urlCode) {
  const baseURL = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${baseURL}/c/${urlCode}`;
}

module.exports = {
  generateQRCodeDataURL,
  generateQRCodeBuffer,
  generateQRCodeSVG,
  buildConferenceURL
};
