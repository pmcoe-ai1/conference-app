import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect() {
    if (this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    this.socket.on('connect', () => {
      console.log('🔌 Socket connected:', this.socket.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
    });

    this.socket.on('error', (error) => {
      console.error('🔌 Socket error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinConference(conferenceId) {
    if (!this.socket) this.connect();
    this.socket.emit('join_conference', { conferenceId });
  }

  leaveConference(conferenceId) {
    if (this.socket) {
      this.socket.emit('leave_conference', { conferenceId });
    }
  }

  requestStats(surveyId) {
    if (this.socket) {
      this.socket.emit('request_stats', { surveyId });
    }
  }

  on(event, callback) {
    if (!this.socket) this.connect();
    this.socket.on(event, callback);
    
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
    
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) callbacks.splice(index, 1);
    }
  }

  removeAllListeners() {
    if (this.socket) {
      this.listeners.forEach((callbacks, event) => {
        callbacks.forEach(cb => this.socket.off(event, cb));
      });
      this.listeners.clear();
    }
  }
}

export const socketService = new SocketService();
export default socketService;
