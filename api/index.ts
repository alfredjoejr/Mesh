import express from 'express';
import dotenv from 'dotenv';
// Load environment variables
dotenv.config();

const app = express();
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Vercel Express backend is running.' });
});

// Dynamically load the rest of the application so that if a module crashes on import 
// (e.g. pg, drizzle, or bcrypt), we can catch it and return the EXACT error message to the browser!
let bootError: any = null;

const bootApp = async () => {
  try {
    const authRouter = (await import('../src/server/auth')).default;
    const messagesRouter = (await import('../src/server/messages')).default;
    const contactsRouter = (await import('../src/server/contacts')).default;
    const roomsRouter = (await import('../src/server/rooms')).default;

    app.use('/api/auth', authRouter);
    app.use('/auth', authRouter);
    app.use('/api/messages', messagesRouter);
    app.use('/messages', messagesRouter);
    app.use('/api/contacts', contactsRouter);
    app.use('/contacts', contactsRouter);
    app.use('/api/rooms', roomsRouter);
    app.use('/rooms', roomsRouter);
  } catch (err) {
    console.error("BOOT ERROR:", err);
    bootError = err;
  }
};

bootApp();

// Catch-all to expose boot errors
app.use((req, res, next) => {
  if (bootError) {
    return res.status(500).json({ error: `CRASH ON BOOT: ${bootError.message}\n${bootError.stack}` });
  }
  next();
});

// Catch-all 404 for API routes returning JSON
app.use((req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
});

// Global error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Vercel API Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

export default app;
