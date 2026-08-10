import { Router } from 'express';
import { db } from '../db';
import { messages, users } from '../db/schema';
import { eq, or, and, desc, sql } from 'drizzle-orm';
import crypto from 'crypto';

const router = Router();

// Get all contacts (users) with their latest message and unread count
// We'll mock unread count for now, and fetch users.
router.get('/contacts/:userId', async (req, res) => {
  const { userId } = req.params;
  
  // Get all users except current
  const allUsers = await db.select().from(users).where(sql`${users.id} != ${userId}`);
  
  // For each user, get the last message between them and current user
  const contacts = await Promise.all(allUsers.map(async (u) => {
    const lastMessage = await db.query.messages.findFirst({
      where: or(
        and(eq(messages.senderId, userId), eq(messages.receiverId, u.id)),
        and(eq(messages.senderId, u.id), eq(messages.receiverId, userId))
      ),
      orderBy: [desc(messages.timestamp)],
    });
    
    return {
      user: { id: u.id, username: u.username, email: u.email },
      lastMessage: lastMessage ? {
        id: lastMessage.id,
        senderId: lastMessage.senderId,
        receiverId: lastMessage.receiverId,
        text: lastMessage.text,
        timestamp: lastMessage.timestamp.getTime()
      } : undefined,
      unreadCount: 0 // Mock for now
    };
  }));

  // Sort by latest message
  contacts.sort((a, b) => {
    if (!a.lastMessage) return 1;
    if (!b.lastMessage) return -1;
    return b.lastMessage.timestamp - a.lastMessage.timestamp;
  });

  res.json(contacts);
});

// Get messages between two users
router.get('/:userId/:otherUserId', async (req, res) => {
  const { userId, otherUserId } = req.params;
  
  const msgs = await db.query.messages.findMany({
    where: or(
      and(eq(messages.senderId, userId), eq(messages.receiverId, otherUserId)),
      and(eq(messages.senderId, otherUserId), eq(messages.receiverId, userId))
    ),
    orderBy: [sql`${messages.timestamp} ASC`],
  });
  
  res.json(msgs.map(m => ({
    id: m.id,
    senderId: m.senderId,
    receiverId: m.receiverId,
    text: m.text,
    timestamp: m.timestamp.getTime()
  })));
});

// Send a message
router.post('/', async (req, res) => {
  const { senderId, receiverId, text } = req.body;
  if (!senderId || !receiverId || !text) return res.status(400).json({ error: 'Missing fields' });
  
  const id = crypto.randomUUID();
  await db.insert(messages).values({
    id,
    senderId,
    receiverId,
    text,
  });
  
  res.json({ success: true, id });
});

export default router;
