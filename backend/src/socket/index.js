/**
 * Socket.io WebSocket handler
 * Manages real-time connections for live statistics updates
 */

function initializeSocket(io, prisma) {
  io.on('connection', (socket) => {
    console.log(`📡 Client connected: ${socket.id}`);
    
    /**
     * Join a conference room for real-time updates
     */
    socket.on('join_conference', async ({ conferenceId, token }) => {
      try {
        // Validate that conference exists
        const conference = await prisma.conference.findUnique({
          where: { id: conferenceId }
        });
        
        if (!conference) {
          socket.emit('error', { message: 'Conference not found' });
          return;
        }
        
        socket.join(`conference:${conferenceId}`);
        console.log(`📡 Socket ${socket.id} joined conference:${conferenceId}`);
        
        socket.emit('joined_conference', { 
          conferenceId,
          conferenceName: conference.name
        });
      } catch (error) {
        console.error('Join conference error:', error);
        socket.emit('error', { message: 'Failed to join conference' });
      }
    });
    
    /**
     * Leave a conference room
     */
    socket.on('leave_conference', ({ conferenceId }) => {
      socket.leave(`conference:${conferenceId}`);
      console.log(`📡 Socket ${socket.id} left conference:${conferenceId}`);
    });
    
    /**
     * Request current statistics for a survey
     */
    socket.on('request_stats', async ({ surveyId }) => {
      try {
        const survey = await prisma.survey.findUnique({
          where: { id: surveyId },
          include: {
            questions: {
              include: {
                responses: true
              }
            }
          }
        });
        
        if (!survey) {
          socket.emit('error', { message: 'Survey not found' });
          return;
        }
        
        // Calculate basic stats
        const stats = survey.questions.map(q => {
          const responses = q.responses;
          return {
            questionId: q.id,
            questionText: q.text,
            questionType: q.type,
            responseCount: responses.length
          };
        });
        
        socket.emit('stats_data', {
          surveyId,
          stats
        });
      } catch (error) {
        console.error('Request stats error:', error);
        socket.emit('error', { message: 'Failed to fetch statistics' });
      }
    });
    
    /**
     * Ping/pong for connection keep-alive
     */
    socket.on('ping', () => {
      socket.emit('pong');
    });
    
    /**
     * Handle disconnection
     */
    socket.on('disconnect', (reason) => {
      console.log(`📡 Client disconnected: ${socket.id} (${reason})`);
    });
  });
  
  // Helper function to broadcast stats update to a conference
  io.broadcastStatsUpdate = async (conferenceId, surveyId) => {
    io.to(`conference:${conferenceId}`).emit('stats_update', {
      surveyId,
      timestamp: new Date().toISOString()
    });
  };
  
  // Helper function to broadcast new response notification
  io.broadcastNewResponse = (conferenceId, surveyId, questionId) => {
    io.to(`conference:${conferenceId}`).emit('new_response', {
      surveyId,
      questionId,
      timestamp: new Date().toISOString()
    });
  };
  
  // Helper function to notify attendee joined
  io.broadcastAttendeeJoined = (conferenceId, attendeeEmail) => {
    io.to(`conference:${conferenceId}`).emit('attendee_joined', {
      email: attendeeEmail,
      timestamp: new Date().toISOString()
    });
  };
  
  console.log('📡 WebSocket handlers initialized');
}

module.exports = { initializeSocket };
