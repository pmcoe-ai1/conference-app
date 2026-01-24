/**
 * Background job queue using Bull
 * Handles scheduled password emails and other async tasks
 */

const Queue = require('bull');
const config = require('../config');
const { sendPasswordEmail } = require('../services/emailService');
const { generatePassword, hashPassword } = require('../utils/password');
const { buildConferenceURL } = require('../utils/qrcode');

let passwordQueue = null;

function initializeJobQueue(prisma) {
  // Only initialize if Redis is available
  if (!process.env.REDIS_URL && process.env.NODE_ENV === 'production') {
    console.log('⚠️  REDIS_URL not set, background jobs disabled');
    return;
  }
  
  try {
    passwordQueue = new Queue('password-delivery', config.redis.url, {
      defaultJobOptions: {
        attempts: config.email.retryAttempts,
        backoff: {
          type: 'exponential',
          delay: 60000 // 1 minute initial delay, exponential backoff
        },
        removeOnComplete: 100,
        removeOnFail: 50
      }
    });
    
    /**
     * Process password delivery jobs
     */
    passwordQueue.process(async (job) => {
      const { attendeeId, queueId } = job.data;
      
      console.log(`📧 Processing password delivery for attendee ${attendeeId}`);
      
      try {
        // Get attendee and conference info
        const attendee = await prisma.attendee.findUnique({
          where: { id: attendeeId },
          include: {
            conference: true,
            passwordQueue: true
          }
        });
        
        if (!attendee) {
          throw new Error('Attendee not found');
        }
        
        if (!attendee.passwordQueue || attendee.passwordQueue.status === 'sent') {
          console.log(`📧 Password already sent for attendee ${attendeeId}`);
          return { skipped: true };
        }
        
        // Generate a new password if needed
        let password;
        if (!attendee.passwordHash) {
          password = generatePassword();
          const hash = await hashPassword(password);
          await prisma.attendee.update({
            where: { id: attendeeId },
            data: { passwordHash: hash }
          });
        } else {
          // In production, you would NOT be able to recover the password
          // This is for demo purposes - in reality, you'd store the plain password
          // temporarily in Redis or generate at send time
          password = generatePassword(); // Generate new one
          const hash = await hashPassword(password);
          await prisma.attendee.update({
            where: { id: attendeeId },
            data: { passwordHash: hash }
          });
        }
        
        // Send email
        const loginUrl = `${buildConferenceURL(attendee.conference.urlCode)}/login`;
        
        await sendPasswordEmail(attendee.email, {
          conferenceName: attendee.conference.name,
          password,
          loginUrl
        });
        
        // Update queue status
        await prisma.passwordQueue.update({
          where: { id: queueId },
          data: {
            status: 'sent',
            sentAt: new Date()
          }
        });
        
        // Update attendee status
        await prisma.attendee.update({
          where: { id: attendeeId },
          data: { status: 'active' }
        });
        
        console.log(`✅ Password delivered to ${attendee.email}`);
        return { success: true, email: attendee.email };
        
      } catch (error) {
        console.error(`❌ Password delivery failed:`, error);
        
        // Update queue with error
        await prisma.passwordQueue.update({
          where: { id: queueId },
          data: {
            status: 'failed',
            attempts: { increment: 1 },
            errorMessage: error.message
          }
        });
        
        throw error; // Re-throw to trigger retry
      }
    });
    
    /**
     * Job event handlers
     */
    passwordQueue.on('completed', (job, result) => {
      console.log(`📧 Job ${job.id} completed:`, result);
    });
    
    passwordQueue.on('failed', (job, err) => {
      console.error(`📧 Job ${job.id} failed:`, err.message);
    });
    
    passwordQueue.on('error', (err) => {
      console.error('📧 Queue error:', err);
    });
    
    /**
     * Check for pending password emails on startup
     */
    async function processPendingEmails() {
      try {
        const pendingEmails = await prisma.passwordQueue.findMany({
          where: {
            status: 'pending',
            scheduledAt: { lte: new Date() }
          },
          include: { attendee: true }
        });
        
        console.log(`📧 Found ${pendingEmails.length} pending password emails`);
        
        for (const item of pendingEmails) {
          await passwordQueue.add({
            attendeeId: item.attendeeId,
            queueId: item.id
          });
        }
      } catch (error) {
        console.error('Error processing pending emails:', error);
      }
    }
    
    // Process pending emails on startup
    processPendingEmails();
    
    // Check for pending emails every minute
    setInterval(processPendingEmails, 60000);
    
    console.log('📧 Background job queue initialized');
    
  } catch (error) {
    console.error('Failed to initialize job queue:', error);
    console.log('⚠️  Running without background jobs');
  }
}

/**
 * Add a password delivery job
 */
async function schedulePasswordDelivery(attendeeId, queueId, delayMs) {
  if (!passwordQueue) {
    console.log('⚠️  Job queue not available, skipping password scheduling');
    return null;
  }
  
  return passwordQueue.add(
    { attendeeId, queueId },
    { delay: delayMs }
  );
}

module.exports = {
  initializeJobQueue,
  schedulePasswordDelivery
};
