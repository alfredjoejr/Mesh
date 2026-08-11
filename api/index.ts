import express from 'express';
import dotenv from 'dotenv';
import authRouter from '../src/server/auth.js';
import messagesRouter from '../src/server/messages.js';
import contactsRouter from '../src/server/contacts.js';
import roomsRouter from '../src/server/rooms.js';

// Load environment variables
dotenv.config();

const app = express();

// Middleware for parsing JSON requests
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Vercel Express backend is running.' });
});

// API routes (support both /api/xxx and /xxx in case Vercel rewrites strip /api)
app.use('/api/auth', authRouter);
app.use('/auth', authRouter);

app.use('/api/messages', messagesRouter);
app.use('/messages', messagesRouter);

app.use('/api/contacts', contactsRouter);
app.use('/contacts', contactsRouter);

app.use('/api/rooms', roomsRouter);
app.use('/rooms', roomsRouter);

// Catch-all 404 for API routes returning JSON
app.use((req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
});

// Global error handler returning JSON instead of HTML 500
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Vercel API Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Export the Express API for Vercel serverless functions
export default app;
