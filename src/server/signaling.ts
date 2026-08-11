import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';

interface SignalMessage {
  type: string;
  fromUserId: string;
  fromUsername: string;
  fromAvatar?: string;
  toUserId: string;
  payload?: any;
}

// Map of userId -> WebSocket connection
const clients = new Map<string, WebSocket>();

export function setupSignaling(server: HttpServer) {
  const wss = new WebSocketServer({ server, path: '/ws/signaling' });

  wss.on('connection', (ws: WebSocket) => {
    let registeredUserId: string | null = null;

    ws.on('message', (raw: Buffer) => {
      let msg: SignalMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      // Register this WebSocket with the user's ID
      if (msg.type === 'register') {
        registeredUserId = msg.fromUserId;
        clients.set(msg.fromUserId, ws);
        console.log(`[Signaling] User registered: ${msg.fromUserId} (${msg.fromUsername})`);
        return;
      }

      // Relay signaling messages to the target user
      const targetWs = clients.get(msg.toUserId);
      if (targetWs && targetWs.readyState === WebSocket.OPEN) {
        targetWs.send(JSON.stringify(msg));
      } else {
        // Target user is offline — notify caller
        if (msg.type === 'call-ring' || msg.type === 'call-offer') {
          ws.send(JSON.stringify({
            type: 'call-end',
            fromUserId: 'system',
            fromUsername: 'System',
            toUserId: msg.fromUserId,
            payload: { reason: 'User is offline' },
          }));
        }
      }
    });

    ws.on('close', () => {
      if (registeredUserId) {
        clients.delete(registeredUserId);
        console.log(`[Signaling] User disconnected: ${registeredUserId}`);
      }
    });

    ws.on('error', (err) => {
      console.error('[Signaling] WebSocket error:', err.message);
    });
  });

  console.log('[Signaling] WebSocket signaling server ready on /ws/signaling');
}
