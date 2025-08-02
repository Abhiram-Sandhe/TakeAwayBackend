  const express = require("express");
  const mongoose = require("mongoose");
  const http = require("http");
  const cors = require("cors");
  const { Server } = require("socket.io");
  const handleOrderSocket = require("./socket/orderSocket");
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

  mongoose.connect(process.env.MONGODB_URI);

  app.set("io", io);

  app.use("/api/auth", require("./routes/auth"));
  app.use("/api/restaurant", require("./routes/restaurant"));
  app.use("/api/admin", require("./routes/admin"));
  app.use(
    "/api/restaurant-applications",
    require("./routes/restaurantApplicationRoutes")
  );
  app.use("/api/orders", require("./routes/order"));
  // app.use('/api/public', require('./routes/public'));

  handleOrderSocket(io);

  const PORT = process.env.PORT || 8080;
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
