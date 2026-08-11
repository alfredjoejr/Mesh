import express from "express";
import path from "path";
import http from "http";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import authRouter from "./src/server/auth";
import messagesRouter from "./src/server/messages";
import contactsRouter from "./src/server/contacts";
import roomsRouter from "./src/server/rooms";
import { setupSignaling } from "./src/server/signaling";

// Load environment variables
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Create HTTP server from Express app (needed for WebSocket upgrade)
  const server = http.createServer(app);

  // Middleware for parsing JSON requests (with 10mb limit for avatar uploads)
  app.use(express.json({ limit: '10mb' }));

  // API routes go here FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Node.js Express backend is running." });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/messages', messagesRouter);
  app.use('/api/contacts', contactsRouter);
  app.use('/api/rooms', roomsRouter);

  // Attach WebSocket signaling server for voice calls
  setupSignaling(server);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Listen on the HTTP server (not Express directly)
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
