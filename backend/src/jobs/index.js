// Background job queue - Redis is optional
// If Redis is not available, jobs will be logged but not queued

let queue = null;

function initializeJobQueue(prisma) {
  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    console.log('📧 Job queue disabled (no REDIS_URL)');
    return;
  }
  
  try {
    const Queue = require('bull');
    queue = new Queue('password-emails', redisUrl);
    
    queue.process(async (job) => {
      console.log('Processing job:', job.data);
      // TODO: Implement actual email sending
    });
    
    queue.on('error', (err) => {
      console.error('Queue error:', err.message);
    });
    
    console.log('📧 Background job queue initialized');
  } catch (error) {
    console.log('📧 Job queue disabled (Redis not available)');
  }
}

function addPasswordJob(data) {
  if (queue) {
    return queue.add(data, { delay: data.delayMs || 0 });
  }
  console.log('📧 Password job queued (mock):', data.email);
  return Promise.resolve();
}

module.exports = { initializeJobQueue, addPasswordJob };
