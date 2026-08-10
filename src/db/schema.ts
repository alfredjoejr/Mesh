import { pgTable, text, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'), // Nullable because passkey-only users might not have one
  currentChallenge: text('current_challenge'), // for WebAuthn
  chatKey: text('chat_key'), // 6-digit secure key for direct connection
  publicKey: text('public_key'), // RSA-OAEP public key for E2EE
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true, mode: 'date' }),
});

export const contactRequests = pgTable('contact_requests', {
  id: text('id').primaryKey(),
  senderId: text('sender_id').notNull().references(() => users.id),
  receiverId: text('receiver_id').notNull().references(() => users.id),
  status: text('status').notNull().default('pending'), // 'pending', 'accepted', 'rejected'
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export const passkeys = pgTable('passkeys', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  credentialId: text('credential_id').notNull().unique(), // base64url encoded
  credentialPublicKey: text('credential_public_key').notNull(), // base64url encoded
  counter: integer('counter').notNull(),
  credentialDeviceType: text('credential_device_type').notNull(),
  credentialBackedUp: boolean('credential_backed_up').notNull(),
  transports: jsonb('transports').$type<string[]>(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export const messages = pgTable('messages', {
  id: text('id').primaryKey(),
  senderId: text('sender_id').notNull().references(() => users.id),
  receiverId: text('receiver_id').notNull().references(() => users.id),
  text: text('text').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  timestamp: timestamp('timestamp', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

// ── Confidential Rooms (Forensic Fingerprinting) ──────────────────────

export const confidentialRooms = pgTable('confidential_rooms', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  creatorId: text('creator_id').notNull().references(() => users.id),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export const roomMembers = pgTable('room_members', {
  id: text('id').primaryKey(),
  roomId: text('room_id').notNull().references(() => confidentialRooms.id),
  userId: text('user_id').notNull().references(() => users.id),
  fingerprintSeed: text('fingerprint_seed').notNull(), // HMAC seed unique per member
  joinedAt: timestamp('joined_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export const roomMessages = pgTable('room_messages', {
  id: text('id').primaryKey(),
  roomId: text('room_id').notNull().references(() => confidentialRooms.id),
  senderId: text('sender_id').notNull().references(() => users.id),
  originalText: text('original_text').notNull(), // sender's original message
  timestamp: timestamp('timestamp', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export const fingerprintMaps = pgTable('fingerprint_maps', {
  id: text('id').primaryKey(),
  messageId: text('message_id').notNull().references(() => roomMessages.id),
  recipientId: text('recipient_id').notNull().references(() => users.id),
  fingerprintedText: text('fingerprinted_text').notNull(), // the unique variant
  fingerprintBits: text('fingerprint_bits').notNull(), // binary string e.g. "10110010"
  layers: jsonb('layers').$type<Record<string, string>>(), // details of each layer applied
});

export const leakReports = pgTable('leak_reports', {
  id: text('id').primaryKey(),
  roomId: text('room_id').notNull().references(() => confidentialRooms.id),
  reporterId: text('reporter_id').notNull().references(() => users.id),
  leakedText: text('leaked_text').notNull(), // OCR'd or pasted leaked text
  matchedUserId: text('matched_user_id').references(() => users.id), // attributed leaker
  confidence: text('confidence'), // e.g. "99.2%"
  matchDetails: jsonb('match_details').$type<object>(), // detailed forensic analysis
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
