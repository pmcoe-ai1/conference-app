const nodemailer = require('nodemailer');
const config = require('../config');

// For development, use ethereal email or console logging
// For production, use AWS SES
let transporter;

if (process.env.NODE_ENV === 'production' && process.env.AWS_ACCESS_KEY_ID) {
  // AWS SES configuration
  const aws = require('@aws-sdk/client-ses');
  const { defaultProvider } = require('@aws-sdk/credential-provider-node');
  
  transporter = nodemailer.createTransport({
    SES: {
      ses: new aws.SES({
        region: config.aws.ses.region,
        credentialDefaultProvider: defaultProvider
      }),
      aws
    }
  });
} else {
  // Development: log to console or use ethereal
  transporter = {
    sendMail: async (options) => {
      console.log('\n📧 EMAIL SENT (Development Mode)');
      console.log('================================');
      console.log(`To: ${options.to}`);
      console.log(`Subject: ${options.subject}`);
      console.log(`Body:\n${options.text || options.html}`);
      console.log('================================\n');
      return { messageId: 'dev-' + Date.now() };
    }
  };
}

/**
 * Send password delivery email
 */
async function sendPasswordEmail(to, { conferenceName, password, loginUrl }) {
  const subject = 'Your Conference Access Password';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; }
        .password-box { background: white; border: 2px solid #e2e8f0; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
        .password { font-size: 28px; font-family: monospace; color: #6366f1; letter-spacing: 2px; }
        .button { display: inline-block; background: #6366f1; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; margin-top: 20px; }
        .footer { text-align: center; color: #64748b; font-size: 14px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">Conference Survey</h1>
          <p style="margin: 10px 0 0; opacity: 0.9;">${conferenceName}</p>
        </div>
        <div class="content">
          <h2>Your Access Password</h2>
          <p>Your password has been generated for secure access to the conference surveys. Use this password along with your email to log in.</p>
          
          <div class="password-box">
            <p style="margin: 0 0 10px; color: #64748b; font-size: 14px;">Your Password</p>
            <div class="password">${password}</div>
          </div>
          
          <p>Keep this password safe. You'll need it to access surveys on Day 2 and beyond.</p>
          
          <center>
            <a href="${loginUrl}" class="button">Login to Conference</a>
          </center>
          
          <div class="footer">
            <p>If you didn't register for this conference, please ignore this email.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const text = `
Conference Survey - ${conferenceName}

Your Access Password
====================

Your password: ${password}

Use this password along with your email to log in at:
${loginUrl}

Keep this password safe. You'll need it to access surveys on Day 2 and beyond.

If you didn't register for this conference, please ignore this email.
  `;

  return transporter.sendMail({
    from: config.email.from,
    to,
    subject,
    html,
    text
  });
}

/**
 * Send password reset email
 */
async function sendPasswordResetEmail(to, { conferenceName, resetUrl, expiresIn }) {
  const subject = 'Reset Your Conference Password';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; }
        .button { display: inline-block; background: #6366f1; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; margin: 20px 0; }
        .warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin-top: 20px; }
        .footer { text-align: center; color: #64748b; font-size: 14px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">Password Reset</h1>
          <p style="margin: 10px 0 0; opacity: 0.9;">${conferenceName}</p>
        </div>
        <div class="content">
          <h2>Reset Your Password</h2>
          <p>We received a request to reset your password for the conference survey portal.</p>
          
          <center>
            <a href="${resetUrl}" class="button">Reset Password</a>
          </center>
          
          <div class="warning">
            <strong>⚠️ This link expires in ${expiresIn}.</strong>
            <p style="margin: 5px 0 0;">If you didn't request this reset, please ignore this email.</p>
          </div>
          
          <div class="footer">
            <p>This is an automated message from Conference Survey.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  return transporter.sendMail({
    from: config.email.from,
    to,
    subject,
    html
  });
}

/**
 * Send survey activation notification email
 */
async function sendSurveyNotificationEmail(to, { conferenceName, surveyTitle, surveyUrl, firstName }) {
  const subject = `New Survey Available: ${surveyTitle}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 12px 12px; }
        .survey-box { background: white; border: 2px solid #e2e8f0; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
        .survey-title { font-size: 22px; color: #1e293b; margin: 0; }
        .button { display: inline-block; background: #6366f1; color: white; padding: 14px 35px; border-radius: 8px; text-decoration: none; margin-top: 20px; font-weight: 600; }
        .footer { text-align: center; color: #64748b; font-size: 14px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">📋 New Survey Available</h1>
          <p style="margin: 10px 0 0; opacity: 0.9;">${conferenceName}</p>
        </div>
        <div class="content">
          <h2>Hi${firstName ? ' ' + firstName : ''},</h2>
          <p>A new survey is now available for you to complete. Your feedback is valuable to us!</p>
          
          <div class="survey-box">
            <p style="margin: 0 0 5px; color: #64748b; font-size: 14px;">Survey</p>
            <p class="survey-title">${surveyTitle}</p>
          </div>
          
          <p>Click the button below to access the survey. You'll be taken directly to the survey page.</p>
          
          <center>
            <a href="${surveyUrl}" class="button">Take Survey Now →</a>
          </center>
          
          <div class="footer">
            <p>Thank you for participating in ${conferenceName}!</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const text = `
New Survey Available - ${conferenceName}

Hi${firstName ? ' ' + firstName : ''},

A new survey is now available: ${surveyTitle}

Click here to take the survey:
${surveyUrl}

Thank you for participating!
  `;

  return transporter.sendMail({
    from: config.email.from,
    to,
    subject,
    html,
    text
  });
}

module.exports = {
  sendPasswordEmail,
  sendPasswordResetEmail,
  sendSurveyNotificationEmail
};
