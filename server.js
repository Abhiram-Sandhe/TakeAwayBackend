  const express = require("express");
  const mongoose = require("mongoose");
  const http = require("http");
  const cors = require("cors");
  const { Server } = require("socket.io");
  const handleOrderSocket = require("./socket/orderSocket");
  const { setSocketIO } = require('./controllers/orderController')
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

  setSocketIO(io);

  app.use(
    cors({
      origin: "http://localhost:3000",
      credentials: true,
    })
  );
  app.use(express.json());

  mongoose.connect(process.env.MONGODB_URI);

  app.set("io", io);

  // Public routes (no authentication required)
  app.use("/api/public", require("./routes/public"));

  app.use("/api/auth", require("./routes/auth"));
  app.use("/api/restaurant", require("./routes/restaurant"));
  app.use("/api/admin", require("./routes/admin"));
  app.use("/api/restaurant-applications", require("./routes/restaurantApplicationRoutes"));
  app.use("/api/orders", require("./routes/order"));

  app.use('/api/cart', require('./routes/cart'));
  app.use('/api/categories', require('./routes/category'))

  handleOrderSocket(io);

  const PORT = process.env.PORT || 8080;
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
