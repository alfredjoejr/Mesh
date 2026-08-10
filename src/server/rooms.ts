/**
 * Confidential Rooms API
 * 
 * Handles room CRUD, fingerprinted message delivery, and leak verification.
 * Every message sent to a room is fingerprinted uniquely for each member.
 */

import { Router } from 'express';
import { db } from '../db';
import {
  confidentialRooms, roomMembers, roomMessages,
  fingerprintMaps, leakReports, users
} from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import crypto from 'crypto';
import {
  embedFingerprint, extractFingerprint, matchFingerprint,
  attributeLeak, generateFingerprintBits, calculateCapacity
} from '../lib/fingerprint';
import { generateLinguisticVariants, matchLinguisticVariant } from '../lib/fingerprint-ai';

const router = Router();

// ── Room CRUD ────────────────────────────────────────────────────────

/**
 * Create a new confidential room.
 * Body: { creatorId, name, description?, memberIds: string[] }
 */
router.post('/', async (req, res) => {
  try {
    const { creatorId, name, description, memberIds } = req.body;
    if (!creatorId || !name) {
      return res.status(400).json({ error: 'Missing required fields: creatorId, name' });
    }

    const roomId = crypto.randomUUID();

    // Create the room
    await db.insert(confidentialRooms).values({
      id: roomId,
      name,
      creatorId,
      description: description || null,
    });

    // Add creator as a member
    const allMemberIds = new Set([creatorId, ...(memberIds || [])]);

    for (const userId of allMemberIds) {
      await db.insert(roomMembers).values({
        id: crypto.randomUUID(),
        roomId,
        userId,
        fingerprintSeed: crypto.randomBytes(32).toString('hex'),
      });
    }

    res.json({
      success: true,
      room: { id: roomId, name, creatorId, description, memberCount: allMemberIds.size },
    });
  } catch (error: any) {
    console.error('Create room error:', error);
    res.status(500).json({ error: error.message || 'Failed to create room' });
  }
});

/**
 * List rooms for a user.
 * GET /api/rooms/:userId
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Find all room memberships for this user
    const memberships = await db.query.roomMembers.findMany({
      where: eq(roomMembers.userId, userId),
    });

    if (memberships.length === 0) {
      return res.json([]);
    }

    const rooms = await Promise.all(
      memberships.map(async (m) => {
        const room = await db.query.confidentialRooms.findFirst({
          where: eq(confidentialRooms.id, m.roomId),
        });
        if (!room) return null;

        // Count members
        const members = await db.query.roomMembers.findMany({
          where: eq(roomMembers.roomId, m.roomId),
        });

        // Get last message
        const lastMsg = await db.query.roomMessages.findFirst({
          where: eq(roomMessages.roomId, m.roomId),
          orderBy: [desc(roomMessages.timestamp)],
        });

        // Get fingerprinted text for this user's last message
        let lastMessageText = '';
        if (lastMsg) {
          const fp = await db.query.fingerprintMaps.findFirst({
            where: and(
              eq(fingerprintMaps.messageId, lastMsg.id),
              eq(fingerprintMaps.recipientId, userId)
            ),
          });
          lastMessageText = fp?.fingerprintedText || lastMsg.originalText;
        }

        // Get sender username for last message
        let lastSenderUsername = '';
        if (lastMsg) {
          const sender = await db.query.users.findFirst({
            where: eq(users.id, lastMsg.senderId),
          });
          lastSenderUsername = sender?.username || '';
        }

        return {
          id: room.id,
          name: room.name,
          creatorId: room.creatorId,
          description: room.description,
          memberCount: members.length,
          createdAt: room.createdAt.getTime(),
          lastMessage: lastMsg ? {
            text: lastMessageText,
            senderUsername: lastSenderUsername,
            timestamp: lastMsg.timestamp.getTime(),
          } : null,
        };
      })
    );

    const filtered = rooms.filter(Boolean);
    // Sort by last message timestamp descending
    filtered.sort((a, b) => {
      const tA = a!.lastMessage?.timestamp || a!.createdAt;
      const tB = b!.lastMessage?.timestamp || b!.createdAt;
      return tB - tA;
    });

    res.json(filtered);
  } catch (error: any) {
    console.error('List rooms error:', error);
    res.status(500).json({ error: error.message || 'Failed to list rooms' });
  }
});

/**
 * Get room details and members.
 * GET /api/rooms/:roomId/details
 */
router.get('/:roomId/details', async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await db.query.confidentialRooms.findFirst({
      where: eq(confidentialRooms.id, roomId),
    });
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const members = await db.query.roomMembers.findMany({
      where: eq(roomMembers.roomId, roomId),
    });

    const memberDetails = await Promise.all(
      members.map(async (m) => {
        const user = await db.query.users.findFirst({
          where: eq(users.id, m.userId),
        });
        return {
          id: m.userId,
          username: user?.username || 'Unknown',
          joinedAt: m.joinedAt.getTime(),
        };
      })
    );

    res.json({
      ...room,
      createdAt: room.createdAt.getTime(),
      members: memberDetails,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get room details' });
  }
});

/**
 * Get fingerprinted messages for a specific user in a room.
 * GET /api/rooms/:roomId/messages/:userId
 */
router.get('/:roomId/messages/:userId', async (req, res) => {
  try {
    const { roomId, userId } = req.params;

    // Verify membership
    const membership = await db.query.roomMembers.findFirst({
      where: and(
        eq(roomMembers.roomId, roomId),
        eq(roomMembers.userId, userId)
      ),
    });
    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this room' });
    }

    // Get all messages in the room
    const msgs = await db.query.roomMessages.findMany({
      where: eq(roomMessages.roomId, roomId),
      orderBy: [sql`${roomMessages.timestamp} ASC`],
    });

    // For each message, get the fingerprinted variant for this user
    const result = await Promise.all(
      msgs.map(async (msg) => {
        // Get sender info
        const sender = await db.query.users.findFirst({
          where: eq(users.id, msg.senderId),
        });

        // If this user is the sender, show original text
        if (msg.senderId === userId) {
          return {
            id: msg.id,
            roomId: msg.roomId,
            senderId: msg.senderId,
            senderUsername: sender?.username || 'Unknown',
            text: msg.originalText,
            timestamp: msg.timestamp.getTime(),
          };
        }

        // Otherwise, show fingerprinted variant
        const fp = await db.query.fingerprintMaps.findFirst({
          where: and(
            eq(fingerprintMaps.messageId, msg.id),
            eq(fingerprintMaps.recipientId, userId)
          ),
        });

        return {
          id: msg.id,
          roomId: msg.roomId,
          senderId: msg.senderId,
          senderUsername: sender?.username || 'Unknown',
          text: fp?.fingerprintedText || msg.originalText,
          timestamp: msg.timestamp.getTime(),
        };
      })
    );

    res.json(result);
  } catch (error: any) {
    console.error('Get room messages error:', error);
    res.status(500).json({ error: error.message || 'Failed to get messages' });
  }
});

// ── Send Message (with fingerprinting) ───────────────────────────────

/**
 * Send a message to a room, generating fingerprinted variants for all members.
 * Body: { senderId, text }
 */
router.post('/:roomId/messages', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { senderId, text } = req.body;

    if (!senderId || !text) {
      return res.status(400).json({ error: 'Missing required fields: senderId, text' });
    }

    // Verify sender is a member
    const senderMembership = await db.query.roomMembers.findFirst({
      where: and(
        eq(roomMembers.roomId, roomId),
        eq(roomMembers.userId, senderId)
      ),
    });
    if (!senderMembership) {
      return res.status(403).json({ error: 'Not a member of this room' });
    }

    // Create the message record
    const messageId = crypto.randomUUID();
    await db.insert(roomMessages).values({
      id: messageId,
      roomId,
      senderId,
      originalText: text,
    });

    // Get all members (except sender — sender sees original)
    const members = await db.query.roomMembers.findMany({
      where: eq(roomMembers.roomId, roomId),
    });

    const recipients = members.filter(m => m.userId !== senderId);

    // Generate AI linguistic variants if there are enough recipients
    let aiVariants: string[] | null = null;
    if (recipients.length > 0 && text.length >= 15) {
      try {
        aiVariants = await generateLinguisticVariants(text, recipients.length);
      } catch (err) {
        console.error('AI variant generation failed, falling back to layers 1-4:', err);
      }
    }

    // Generate fingerprinted variants for each recipient
    for (let i = 0; i < recipients.length; i++) {
      const member = recipients[i];

      // Start with AI variant if available, otherwise original text
      const baseText = aiVariants && aiVariants[i] ? aiVariants[i] : text;

      // Apply layers 1-4 on top of the AI variant
      const result = embedFingerprint(baseText, member.fingerprintSeed, messageId);

      await db.insert(fingerprintMaps).values({
        id: crypto.randomUUID(),
        messageId,
        recipientId: member.userId,
        fingerprintedText: result.text,
        fingerprintBits: result.bits,
        layers: {
          ...result.layers,
          ...(aiVariants ? { aiVariant: `variant_${i}` } : {}),
        },
      });
    }

    res.json({
      success: true,
      messageId,
      recipientsFingerprinted: recipients.length,
    });
  } catch (error: any) {
    console.error('Send room message error:', error);
    res.status(500).json({ error: error.message || 'Failed to send message' });
  }
});

// ── Add Member ───────────────────────────────────────────────────────

/**
 * Add a member to a room.
 * Body: { userId, addedBy }
 */
router.post('/:roomId/members', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId, addedBy } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    // Check if already a member
    const existing = await db.query.roomMembers.findFirst({
      where: and(
        eq(roomMembers.roomId, roomId),
        eq(roomMembers.userId, userId)
      ),
    });
    if (existing) {
      return res.status(400).json({ error: 'User is already a member' });
    }

    // Verify the user exists
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await db.insert(roomMembers).values({
      id: crypto.randomUUID(),
      roomId,
      userId,
      fingerprintSeed: crypto.randomBytes(32).toString('hex'),
    });

    res.json({ success: true, username: user.username });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to add member' });
  }
});

// ── Leak Verification ────────────────────────────────────────────────

/**
 * Verify a leak by uploading the leaked text.
 * The system extracts fingerprints and matches against known maps.
 * 
 * Body: { reporterId, leakedText }
 */
router.post('/:roomId/verify-leak', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { reporterId, leakedText } = req.body;

    if (!reporterId || !leakedText) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get all messages in this room
    const msgs = await db.query.roomMessages.findMany({
      where: eq(roomMessages.roomId, roomId),
    });

    if (msgs.length === 0) {
      return res.status(404).json({ error: 'No messages in this room to verify against' });
    }

    // For each message, get all fingerprint maps
    let bestOverallMatch: {
      recipientId: string;
      recipientUsername?: string;
      confidence: number;
      bitsMatched: number;
      bitsTotal: number;
      layersDetected: string[];
      matchedMessageId: string;
    } | null = null;

    for (const msg of msgs) {
      const maps = await db.query.fingerprintMaps.findMany({
        where: eq(fingerprintMaps.messageId, msg.id),
      });

      if (maps.length === 0) continue;

      // Get usernames for the maps
      const mapsWithUsernames = await Promise.all(
        maps.map(async (m) => {
          const user = await db.query.users.findFirst({
            where: eq(users.id, m.recipientId),
          });
          return {
            recipientId: m.recipientId,
            recipientUsername: user?.username,
            fingerprintBits: m.fingerprintBits,
            fingerprintedText: m.fingerprintedText,
          };
        })
      );

      // Try attribution using layers 1-4
      const attribution = attributeLeak(leakedText, mapsWithUsernames);

      if (attribution && (!bestOverallMatch || attribution.confidence > bestOverallMatch.confidence)) {
        bestOverallMatch = {
          ...attribution,
          matchedMessageId: msg.id,
        };
      }

      // Also try AI linguistic variant matching
      const aiMatch = matchLinguisticVariant(
        leakedText,
        mapsWithUsernames.map(m => ({
          recipientId: m.recipientId,
          recipientUsername: m.recipientUsername,
          text: m.fingerprintedText,
        }))
      );

      if (aiMatch && (!bestOverallMatch || aiMatch.confidence > bestOverallMatch.confidence)) {
        bestOverallMatch = {
          recipientId: aiMatch.recipientId,
          recipientUsername: aiMatch.recipientUsername,
          confidence: aiMatch.confidence,
          bitsMatched: Math.round(aiMatch.confidence),
          bitsTotal: 100,
          layersDetected: ['aiLinguistic'],
          matchedMessageId: msg.id,
        };
      }
    }

    // Save the leak report
    const reportId = crypto.randomUUID();
    await db.insert(leakReports).values({
      id: reportId,
      roomId,
      reporterId,
      leakedText,
      matchedUserId: bestOverallMatch?.recipientId || null,
      confidence: bestOverallMatch ? `${bestOverallMatch.confidence}%` : null,
      matchDetails: bestOverallMatch ? {
        bitsMatched: bestOverallMatch.bitsMatched,
        bitsTotal: bestOverallMatch.bitsTotal,
        layersDetected: bestOverallMatch.layersDetected,
        matchedMessageId: bestOverallMatch.matchedMessageId,
      } : null,
    });

    if (bestOverallMatch) {
      res.json({
        success: true,
        reportId,
        attribution: {
          userId: bestOverallMatch.recipientId,
          username: bestOverallMatch.recipientUsername,
          confidence: `${bestOverallMatch.confidence}%`,
          bitsMatched: bestOverallMatch.bitsMatched,
          bitsTotal: bestOverallMatch.bitsTotal,
          layersDetected: bestOverallMatch.layersDetected,
        },
      });
    } else {
      res.json({
        success: true,
        reportId,
        attribution: null,
        message: 'Could not attribute the leak with sufficient confidence.',
      });
    }
  } catch (error: any) {
    console.error('Verify leak error:', error);
    res.status(500).json({ error: error.message || 'Failed to verify leak' });
  }
});

/**
 * Get leak reports for a room.
 * GET /api/rooms/:roomId/leak-reports
 */
router.get('/:roomId/leak-reports', async (req, res) => {
  try {
    const { roomId } = req.params;

    const reports = await db.query.leakReports.findMany({
      where: eq(leakReports.roomId, roomId),
      orderBy: [desc(leakReports.createdAt)],
    });

    const result = await Promise.all(
      reports.map(async (r) => {
        const reporter = await db.query.users.findFirst({
          where: eq(users.id, r.reporterId),
        });
        const matched = r.matchedUserId
          ? await db.query.users.findFirst({ where: eq(users.id, r.matchedUserId) })
          : null;

        return {
          id: r.id,
          roomId: r.roomId,
          reporter: { id: r.reporterId, username: reporter?.username },
          leakedText: r.leakedText,
          matchedUser: matched ? { id: matched.id, username: matched.username } : null,
          confidence: r.confidence,
          matchDetails: r.matchDetails,
          createdAt: r.createdAt.getTime(),
        };
      })
    );

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get leak reports' });
  }
});

export default router;
