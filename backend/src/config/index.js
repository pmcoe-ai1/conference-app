module.exports = {
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-me',
    expiryHours: parseInt(process.env.JWT_EXPIRY_HOURS) || 24
  },
  password: {
    delayHours: parseInt(process.env.PASSWORD_DELAY_HOURS) || 24,
    length: parseInt(process.env.PASSWORD_LENGTH) || 12,
    bcryptCost: 12
  },
  lockout: {
    attempts: parseInt(process.env.LOCKOUT_ATTEMPTS) || 5,
    durationMins: parseInt(process.env.LOCKOUT_DURATION_MINS) || 30
  },
  email: {
    from: process.env.EMAIL_FROM || 'noreply@conference-survey.app',
    retryAttempts: parseInt(process.env.EMAIL_RETRY_ATTEMPTS) || 3
  },
  aws: {
    ses: {
      region: process.env.AWS_SES_REGION || 'us-east-1'
    },
    s3: {
      bucket: process.env.AWS_S3_BUCKET || 'conference-survey-qrcodes',
      region: process.env.AWS_S3_REGION || 'us-east-1'
    }
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  }
};
