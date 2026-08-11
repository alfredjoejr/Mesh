import { Router } from 'express';
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { db } from '../db';
import { users, passkeys } from '../db/schema';
import { eq, or } from 'drizzle-orm';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { uploadAvatar } from './cloudinary';

const router = Router();
const rpName = 'iGlass Chat';
const rpID = process.env.VITE_APP_URL ? new URL(process.env.VITE_APP_URL).hostname : 'localhost';
const origin = process.env.VITE_APP_URL || `http://localhost:3000`;

// Standard Registration with username, email, and password
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email) return res.status(400).json({ error: 'Missing fields' });
  
  let userRecord = await db.query.users.findFirst({ where: eq(users.username, username) });
  if (userRecord) {
    // If we're registering with password but user exists, check if password matches (in case it's a passkey upgrade flow)
    // For simplicity, let's just error if username exists.
    return res.status(400).json({ error: 'Username already taken' });
  }

  const id = crypto.randomUUID();
  const passwordHash = password ? await bcrypt.hash(password, 10) : null;
  const chatKey = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit chat key
  
  await db.insert(users).values({ id, username, email, passwordHash, chatKey });
  
  userRecord = await db.query.users.findFirst({ where: eq(users.id, id) });
  res.json({ user: { id: userRecord!.id, username: userRecord!.username, email: userRecord!.email, chatKey: userRecord!.chatKey, avatar: userRecord!.avatar } });
});

// Standard Login with username and password
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

  const userRecord = await db.query.users.findFirst({ where: eq(users.username, username) });
  if (!userRecord || !userRecord.passwordHash) {
    return res.status(400).json({ error: 'Invalid credentials or user only has passkey setup' });
  }

  const match = await bcrypt.compare(password, userRecord.passwordHash);
  if (!match) {
    return res.status(400).json({ error: 'Invalid credentials' });
  }
  
  let chatKey = userRecord.chatKey;
  if (!chatKey) {
    chatKey = Math.floor(100000 + Math.random() * 900000).toString();
    await db.update(users).set({ chatKey }).where(eq(users.id, userRecord.id));
  }

  res.json({ user: { id: userRecord.id, username: userRecord.username, email: userRecord.email, chatKey, avatar: userRecord.avatar } });
});

// Utility to create a user for passkey flow if they don't exist
router.post('/register-passkey-user', async (req, res) => {
  const { username, email } = req.body;
  if (!username || !email) return res.status(400).json({ error: 'Missing fields' });
  
  let userRecord = await db.query.users.findFirst({ where: eq(users.username, username) });
  if (!userRecord) {
    const id = crypto.randomUUID();
    const chatKey = Math.floor(100000 + Math.random() * 900000).toString();
    await db.insert(users).values({ id, username, email, chatKey });
    userRecord = { id, username, email, currentChallenge: null, chatKey, avatar: null } as any;
  } else if (!userRecord.chatKey) {
    const chatKey = Math.floor(100000 + Math.random() * 900000).toString();
    await db.update(users).set({ chatKey }).where(eq(users.id, userRecord.id));
    userRecord.chatKey = chatKey;
  }
  res.json({ user: { id: userRecord!.id, username: userRecord!.username, email: userRecord!.email, chatKey: userRecord!.chatKey, avatar: userRecord!.avatar } });
});

// Update Profile (email, avatar, regenerate chatKey)
router.post('/profile', async (req, res) => {
  const { userId, username, email, avatar, regenerateChatKey } = req.body;
  if (!userId && !username) return res.status(400).json({ error: 'Missing userId or username' });

  let userRecord = await db.query.users.findFirst({
    where: or(
      userId ? eq(users.id, userId) : undefined,
      username ? eq(users.username, username) : undefined
    )
  });
  if (!userRecord) return res.status(404).json({ error: 'User not found in database' });

  const updates: Record<string, any> = {};

  if (email !== undefined && email.trim() !== '') {
    updates.email = email.trim();
  }

  if (avatar !== undefined && avatar !== null) {
    // If avatar is a base64 data URL, upload to Cloudinary server-side (signed)
    // This uses a deterministic public_id so old avatars are automatically replaced
    if (avatar.startsWith('data:')) {
      try {
        const cloudinaryUrl = await uploadAvatar(userRecord.id as string, avatar);
        updates.avatar = cloudinaryUrl;
      } catch (err: any) {
        console.error('Cloudinary server upload failed:', err.message);
        // Still save the base64 as fallback
        updates.avatar = avatar;
      }
    } else {
      updates.avatar = avatar;
    }
  }

  if (regenerateChatKey) {
    updates.chatKey = Math.floor(100000 + Math.random() * 900000).toString();
  }

  if (Object.keys(updates).length > 0) {
    await db.update(users).set(updates).where(eq(users.id, userRecord.id));
  }

  const updatedUser = await db.query.users.findFirst({ where: eq(users.id, userRecord.id) });
  res.json({
    success: true,
    user: {
      id: updatedUser!.id,
      username: updatedUser!.username,
      email: updatedUser!.email,
      chatKey: updatedUser!.chatKey,
      avatar: updatedUser!.avatar,
      publicKey: updatedUser!.publicKey
    }
  });
});


// Registration (Passkey)
router.post('/generate-registration-options', async (req, res) => {
  const { username } = req.body;
  const user = await db.query.users.findFirst({ where: eq(users.username, username) });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const userPasskeys = await db.query.passkeys.findMany({ where: eq(passkeys.userId, user.id) });

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new Uint8Array(Buffer.from(user.id)),
    userName: user.username,
    excludeCredentials: userPasskeys.map(pk => ({
      id: pk.credentialId,
      transports: pk.transports as any,
    })),
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'preferred',
    },
  });

  await db.update(users).set({ currentChallenge: options.challenge }).where(eq(users.id, user.id));

  res.json(options);
});

router.post('/verify-registration', async (req, res) => {
  const { username, response } = req.body;
  const user = await db.query.users.findFirst({ where: eq(users.username, username) });
  if (!user || !user.currentChallenge) return res.status(400).json({ error: 'No active challenge' });

  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: user.currentChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (verification.verified && verification.registrationInfo) {
      const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
      const { id: credentialID, publicKey: credentialPublicKey, counter } = credential;

      await db.insert(passkeys).values({
        id: crypto.randomUUID(),
        userId: user.id,
        credentialId: credentialID,
        credentialPublicKey: Buffer.from(credentialPublicKey).toString('base64url'),
        counter,
        credentialDeviceType,
        credentialBackedUp,
        transports: response.response.transports || [],
      });

      await db.update(users).set({ currentChallenge: null }).where(eq(users.id, user.id));

      res.json({ verified: true });
    } else {
      res.status(400).json({ error: 'Verification failed' });
    }
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Authentication (Passkey)
router.post('/generate-authentication-options', async (req, res) => {
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
  });

  // Store globally for now since we don't have sessions, or we could pass it in the response and verify it if we use JWT.
  // We'll use a hack to pass challenge back to client and verify it on verify, since we are not using a session DB table yet.
  res.json(options);
});

router.post('/verify-authentication', async (req, res) => {
  const { response, challenge } = req.body;
  
  const pk = await db.query.passkeys.findFirst({ where: eq(passkeys.credentialId, response.id) });
  if (!pk) return res.status(400).json({ error: 'Authenticator not found' });

  const user = await db.query.users.findFirst({ where: eq(users.id, pk.userId) });
  if (!user) return res.status(400).json({ error: 'User not found' });

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: pk.credentialId,
        publicKey: new Uint8Array(Buffer.from(pk.credentialPublicKey, 'base64url')),
        counter: pk.counter,
        transports: pk.transports as any,
      }
    });

    if (verification.verified) {
      await db.update(passkeys).set({ counter: verification.authenticationInfo.newCounter }).where(eq(passkeys.id, pk.id));
      res.json({ verified: true, user });
    } else {
      res.status(400).json({ error: 'Verification failed' });
    }
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update public key
router.post('/keys', async (req, res) => {
  const { userId, publicKey } = req.body;
  if (!userId || !publicKey) return res.status(400).json({ error: 'Missing fields' });
  await db.update(users).set({ publicKey }).where(eq(users.id, userId));
  res.json({ success: true });
});

export default router;
