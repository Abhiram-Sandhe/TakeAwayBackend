const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/restaurant', require('./routes/restaurant'));
app.use('/api/admin', require('./routes/admin'));
// app.use('/api/public', require('./routes/public'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));