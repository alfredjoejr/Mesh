import express from 'express';
import dotenv from 'dotenv';
import authRouter from '../src/server/auth';
import messagesRouter from '../src/server/messages';
import contactsRouter from '../src/server/contacts';
import roomsRouter from '../src/server/rooms';

// Load environment variables
dotenv.config();

const app = express();

// Middleware for parsing JSON requests
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Vercel Express backend is running.' });
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/rooms', roomsRouter);

// Export the Express API for Vercel serverless functions
export default app;
