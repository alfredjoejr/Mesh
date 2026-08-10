import { Router } from 'express';
import { db } from '../db';
import { users, contactRequests, messages } from '../db/schema';
import { eq, or, and, ne } from 'drizzle-orm';
import crypto from 'crypto';

const router = Router();

// Get contacts (only those with accepted requests or existing messages)
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  
  // 1. Get all accepted contact requests
  const acceptedReqs = await db.query.contactRequests.findMany({
    where: and(
      or(eq(contactRequests.senderId, userId), eq(contactRequests.receiverId, userId)),
      eq(contactRequests.status, 'accepted')
    )
  });

  // 2. Get all distinct user IDs from messages
  const userMsgs = await db.query.messages.findMany({
    where: or(eq(messages.senderId, userId), eq(messages.receiverId, userId))
  });

  const contactIds = new Set<string>();
  acceptedReqs.forEach(r => {
    contactIds.add(r.senderId === userId ? r.receiverId : r.senderId);
  });
  userMsgs.forEach(m => {
    contactIds.add(m.senderId === userId ? m.receiverId : m.senderId);
  });

  if (contactIds.size === 0) {
    return res.json([]);
  }

  // Fetch user details for contacts
  const allUsers = await db.query.users.findMany();
  const contactUsers = allUsers.filter(u => contactIds.has(u.id));

  // For each user, get the last message between them and current user
  const contacts = await Promise.all(contactUsers.map(async (u) => {
    // We could optimize this by looking at `userMsgs` but lets just filter the array since it's already in memory
    const userSpecificMsgs = userMsgs.filter(m => 
      (m.senderId === userId && m.receiverId === u.id) || 
      (m.senderId === u.id && m.receiverId === userId)
    );
    
    // Sort descending by timestamp
    userSpecificMsgs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const lastMessage = userSpecificMsgs.length > 0 ? userSpecificMsgs[0] : null;

    return {
      user: { id: u.id, username: u.username, email: u.email, chatKey: u.chatKey, publicKey: u.publicKey },
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

// Get pending requests received by user
router.get('/requests/:userId', async (req, res) => {
  const { userId } = req.params;
  const requests = await db.query.contactRequests.findMany({
    where: and(eq(contactRequests.receiverId, userId), eq(contactRequests.status, 'pending'))
  });
  
  const senders = await Promise.all(requests.map(async r => {
    const user = await db.query.users.findFirst({ where: eq(users.id, r.senderId) });
    return { id: r.id, user: { id: user?.id, username: user?.username }, createdAt: r.createdAt };
  }));

  res.json(senders);
});

// Send request or direct connect via chat key
router.post('/request', async (req, res) => {
  const { senderId, username, chatKey } = req.body;
  if (!senderId || !username) return res.status(400).json({ error: 'Missing fields' });

  const targetUser = await db.query.users.findFirst({ where: eq(users.username, username) });
  if (!targetUser) return res.status(404).json({ error: 'User not found' });
  if (targetUser.id === senderId) return res.status(400).json({ error: 'Cannot add yourself' });

  // Check if request already exists
  const existing = await db.query.contactRequests.findFirst({
    where: or(
      and(eq(contactRequests.senderId, senderId), eq(contactRequests.receiverId, targetUser.id)),
      and(eq(contactRequests.senderId, targetUser.id), eq(contactRequests.receiverId, senderId))
    )
  });

  const isChatKeyMatch = chatKey && chatKey.trim() !== '' && targetUser.chatKey === chatKey.trim();

  if (existing) {
    if (existing.status === 'accepted') return res.json({ success: true, message: 'Already connected', user: targetUser });
    if (isChatKeyMatch) {
      await db.update(contactRequests).set({ status: 'accepted' }).where(eq(contactRequests.id, existing.id));
      return res.json({ success: true, message: 'Connected instantly via Chat Key!', user: targetUser });
    }
    return res.status(400).json({ error: 'Request already pending' });
  }

  const status = isChatKeyMatch ? 'accepted' : 'pending';
  await db.insert(contactRequests).values({
    id: crypto.randomUUID(),
    senderId,
    receiverId: targetUser.id,
    status
  });

  res.json({ 
    success: true, 
    message: isChatKeyMatch ? 'Connected instantly via Chat Key!' : 'Request sent!',
    user: isChatKeyMatch ? targetUser : null
  });
});

// Respond to request
router.post('/respond', async (req, res) => {
  const { requestId, action } = req.body; // action: 'accept', 'reject'
  if (!requestId || !['accept', 'reject'].includes(action)) return res.status(400).json({ error: 'Invalid data' });
  
  if (action === 'reject') {
    await db.update(contactRequests).set({ status: 'rejected' }).where(eq(contactRequests.id, requestId));
  } else {
    await db.update(contactRequests).set({ status: 'accepted' }).where(eq(contactRequests.id, requestId));
  }
  res.json({ success: true });
});

export default router;
