const express = require("express");
const mongoose = require("mongoose");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const handleOrderSocket = require("./socket/orderSocket");
const changeStreamService = require('./socket/changeStreamService'); 
require("dotenv").config();

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST"],
  },
});

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("io", io);

handleOrderSocket(io);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle joining specific restaurant rooms
  socket.on('joinRestaurant', (restaurantId) => {
    socket.join(`restaurant_${restaurantId}`);
    console.log(`User ${socket.id} joined restaurant room: ${restaurantId}`);
  });

  // Handle leaving restaurant rooms
  socket.on('leaveRestaurant', (restaurantId) => {
    socket.leave(`restaurant_${restaurantId}`);
    console.log(`User ${socket.id} left restaurant room: ${restaurantId}`);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });

  // Handle connection errors
  socket.on('connect_error', (error) => {
    console.log('Connection error:', error);
  });
});

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('Connected to MongoDB');
  
  // Initialize change stream service after successful DB connection
  changeStreamService.initialize(io);
})
.catch((error) => {
  console.error('MongoDB connection error:', error);
  process.exit(1);
});

// Routes
// Public routes (no authentication required)
app.use("/api/public", require("./routes/public"));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/restaurant", require("./routes/restaurant"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/restaurant-applications", require("./routes/restaurantApplicationRoutes"));
app.use("/api/orders", require("./routes/order"));

app.use('/api/cart', require('./routes/cart'));
app.use('/api/categories', require('./routes/category'));

app.use('/api/payment', require('./routes/payment'));

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Received SIGINT. Graceful shutdown...');
  
  changeStreamService.shutdown();
  
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(() => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Graceful shutdown...');
  
  changeStreamService.shutdown();
  
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(() => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));