import { useState, useRef, useCallback, useEffect } from 'react';
import type { CallState, CallSignal, User } from '../types';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export function useWebRTC(currentUser: User | null) {
  const [callState, setCallState] = useState<CallState>({
    status: 'idle',
    remoteUser: null,
    isMuted: false,
    callStartTime: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Pending offer from incoming call (stored until user accepts)
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  // Store the remote user info from incoming ring
  const incomingCallerRef = useRef<{ id: string; username: string; avatar?: string } | null>(null);

  // ── Connect WebSocket ──────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/signaling`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Register this user with the signaling server
      ws.send(JSON.stringify({
        type: 'register',
        fromUserId: currentUser.id,
        fromUsername: currentUser.username,
        toUserId: '',
      }));
    };

    ws.onmessage = (event) => {
      const msg: CallSignal = JSON.parse(event.data);
      handleSignal(msg);
    };

    ws.onclose = () => {
      console.log('[WebRTC] Signaling WebSocket closed');
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // ── Handle incoming signals ────────────────────────────────────────
  const handleSignal = useCallback((msg: CallSignal) => {
    switch (msg.type) {
      case 'call-ring':
        // Someone is calling us
        incomingCallerRef.current = {
          id: msg.fromUserId,
          username: msg.fromUsername,
          avatar: msg.fromAvatar,
        };
        setCallState({
          status: 'ringing',
          remoteUser: {
            id: msg.fromUserId,
            username: msg.fromUsername,
            avatar: msg.fromAvatar,
            email: '',
          },
          isMuted: false,
          callStartTime: null,
        });
        break;

      case 'call-offer':
        // Store the offer — we'll use it when user accepts
        pendingOfferRef.current = msg.payload;
        break;

      case 'call-answer':
        handleAnswer(msg.payload);
        break;

      case 'ice-candidate':
        handleRemoteICE(msg.payload);
        break;

      case 'call-reject':
        cleanup();
        setCallState({ status: 'idle', remoteUser: null, isMuted: false, callStartTime: null });
        break;

      case 'call-end':
        cleanup();
        setCallState({ status: 'idle', remoteUser: null, isMuted: false, callStartTime: null });
        break;
    }
  }, []);

  // ── Create peer connection ─────────────────────────────────────────
  const createPeerConnection = useCallback((remoteUserId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    // Send ICE candidates to the other peer
    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          fromUserId: currentUser?.id || '',
          fromUsername: currentUser?.username || '',
          toUserId: remoteUserId,
          payload: event.candidate.toJSON(),
        }));
      }
    };

    // Receive remote audio
    pc.ontrack = (event) => {
      if (!remoteAudioRef.current) {
        remoteAudioRef.current = new Audio();
        remoteAudioRef.current.autoplay = true;
      }
      remoteAudioRef.current.srcObject = event.streams[0];
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallState((prev) => ({
          ...prev,
          status: 'active',
          callStartTime: Date.now(),
        }));
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        endCall();
      }
    };

    return pc;
  }, [currentUser]);

  // ── Start a call (caller side) ────────────────────────────────────
  const startCall = useCallback(async (targetUser: User) => {
    if (!currentUser || !wsRef.current) return;

    setCallState({
      status: 'outgoing',
      remoteUser: targetUser,
      isMuted: false,
      callStartTime: null,
    });

    // Notify target user of incoming call
    wsRef.current.send(JSON.stringify({
      type: 'call-ring',
      fromUserId: currentUser.id,
      fromUsername: currentUser.username,
      fromAvatar: currentUser.avatar,
      toUserId: targetUser.id,
    }));

    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      // Create peer connection and add audio tracks
      const pc = createPeerConnection(targetUser.id);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      wsRef.current.send(JSON.stringify({
        type: 'call-offer',
        fromUserId: currentUser.id,
        fromUsername: currentUser.username,
        toUserId: targetUser.id,
        payload: offer,
      }));

      setCallState((prev) => ({ ...prev, status: 'connecting' }));
    } catch (err) {
      console.error('[WebRTC] Failed to start call:', err);
      cleanup();
      setCallState({ status: 'idle', remoteUser: null, isMuted: false, callStartTime: null });
    }
  }, [currentUser, createPeerConnection]);

  // ── Accept an incoming call (callee side) ──────────────────────────
  const acceptCall = useCallback(async () => {
    if (!currentUser || !wsRef.current || !incomingCallerRef.current) return;

    const caller = incomingCallerRef.current;

    setCallState((prev) => ({ ...prev, status: 'connecting' }));

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const pc = createPeerConnection(caller.id);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Apply the pending offer
      if (pendingOfferRef.current) {
        await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
        pendingOfferRef.current = null;
      }

      // Apply any buffered ICE candidates
      for (const candidate of pendingCandidatesRef.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current = [];

      // Create and send answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      wsRef.current.send(JSON.stringify({
        type: 'call-answer',
        fromUserId: currentUser.id,
        fromUsername: currentUser.username,
        toUserId: caller.id,
        payload: answer,
      }));
    } catch (err) {
      console.error('[WebRTC] Failed to accept call:', err);
      cleanup();
      setCallState({ status: 'idle', remoteUser: null, isMuted: false, callStartTime: null });
    }
  }, [currentUser, createPeerConnection]);

  // ── Reject an incoming call ────────────────────────────────────────
  const rejectCall = useCallback(() => {
    if (!currentUser || !wsRef.current || !incomingCallerRef.current) return;

    wsRef.current.send(JSON.stringify({
      type: 'call-reject',
      fromUserId: currentUser.id,
      fromUsername: currentUser.username,
      toUserId: incomingCallerRef.current.id,
    }));

    pendingOfferRef.current = null;
    pendingCandidatesRef.current = [];
    incomingCallerRef.current = null;
    setCallState({ status: 'idle', remoteUser: null, isMuted: false, callStartTime: null });
  }, [currentUser]);

  // ── End an active call ─────────────────────────────────────────────
  const endCall = useCallback(() => {
    if (wsRef.current && callState.remoteUser) {
      wsRef.current.send(JSON.stringify({
        type: 'call-end',
        fromUserId: currentUser?.id || '',
        fromUsername: currentUser?.username || '',
        toUserId: callState.remoteUser.id,
      }));
    }

    cleanup();
    setCallState({ status: 'idle', remoteUser: null, isMuted: false, callStartTime: null });
  }, [currentUser, callState.remoteUser]);

  // ── Toggle mute ────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setCallState((prev) => ({ ...prev, isMuted: !track.enabled }));
      }
    }
  }, []);

  // ── Handle SDP answer ──────────────────────────────────────────────
  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    if (pcRef.current) {
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      // Apply any buffered ICE candidates
      for (const candidate of pendingCandidatesRef.current) {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current = [];
    }
  };

  // ── Handle remote ICE candidate ────────────────────────────────────
  const handleRemoteICE = async (candidate: RTCIceCandidateInit) => {
    if (pcRef.current && pcRef.current.remoteDescription) {
      await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      // Buffer if remote description isn't set yet
      pendingCandidatesRef.current.push(candidate);
    }
  };

  // ── Cleanup resources ──────────────────────────────────────────────
  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    pendingOfferRef.current = null;
    pendingCandidatesRef.current = [];
    incomingCallerRef.current = null;
  };

  return {
    callState,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
  };
}
