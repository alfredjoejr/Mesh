export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  chatKey?: string;
  publicKey?: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: number;
}

export interface ChatContact {
  user: User;
  lastMessage?: Message;
  unreadCount: number;
}

// ── Confidential Rooms (Forensic Fingerprinting) ──────────────────────

export interface ConfidentialRoom {
  id: string;
  name: string;
  creatorId: string;
  description?: string;
  memberCount: number;
  createdAt: number;
  lastMessage?: {
    text: string;
    senderUsername: string;
    timestamp: number;
  };
}

export interface RoomMember {
  id: string;
  username: string;
  joinedAt: number;
}

export interface RoomMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderUsername: string;
  text: string; // fingerprinted variant for this user
  timestamp: number;
}

export interface LeakAttribution {
  userId: string;
  username: string;
  confidence: string;
  bitsMatched: number;
  bitsTotal: number;
  layersDetected: string[];
}

export interface LeakReport {
  id: string;
  roomId: string;
  reporter: { id: string; username: string };
  leakedText: string;
  matchedUser: { id: string; username: string } | null;
  confidence: string | null;
  matchDetails: {
    bitsMatched: number;
    bitsTotal: number;
    layersDetected: string[];
  } | null;
  createdAt: number;
}

// ── Voice Calling (WebRTC) ────────────────────────────────────────────

export type CallStatus = 'idle' | 'outgoing' | 'ringing' | 'connecting' | 'active' | 'ended';

export interface CallState {
  status: CallStatus;
  remoteUser: User | null;
  isMuted: boolean;
  callStartTime: number | null;
}

export type SignalType =
  | 'register'
  | 'call-ring'
  | 'call-offer'
  | 'call-answer'
  | 'ice-candidate'
  | 'call-reject'
  | 'call-end';

export interface CallSignal {
  type: SignalType;
  fromUserId: string;
  fromUsername: string;
  fromAvatar?: string;
  toUserId: string;
  payload?: any;
}
