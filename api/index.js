require('dotenv').config();
const express = require('express');

const app = express();

// Middleware
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'PixelPulse API is running' });
});

// Export for Vercel serverless
module.exports = app;
