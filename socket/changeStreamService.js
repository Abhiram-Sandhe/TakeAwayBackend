const { initializeOrderChangeStream, closeOrderChangeStream } = require('../controllers/orderController');

class ChangeStreamService {
  constructor() {
    this.io = null;
    this.isInitialized = false;
  }

  // Initialize the change stream service with Socket.IO instance
  initialize(socketIOInstance) {
    if (this.isInitialized) {
      console.log('Change stream service already initialized');
      return;
    }

    this.io = socketIOInstance;
    
    try {
      // Initialize order change stream
      initializeOrderChangeStream(this.io);
      
      this.isInitialized = true;
      console.log('Change stream service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize change stream service:', error);
    }
  }

  // Clean shutdown of all change streams
  shutdown() {
    try {
      closeOrderChangeStream();
      this.isInitialized = false;
      console.log('Change stream service shut down successfully');
    } catch (error) {
      console.error('Error shutting down change stream service:', error);
    }
  }

  // Check if the service is initialized
  isReady() {
    return this.isInitialized;
  }
}

// Create singleton instance
const changeStreamService = new ChangeStreamService();

module.exports = changeStreamService;