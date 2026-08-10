import React, { useState, useRef, useEffect } from 'react';
import { Send, ChevronLeft, Shield, Users, AlertTriangle, Fingerprint } from 'lucide-react';
import { User, RoomMessage, RoomMember } from '../../types';
import LeakVerifier from './LeakVerifier';

interface ConfidentialRoomChatProps {
  currentUser: User;
  roomId: string;
  roomName: string;
  onBack: () => void;
}

export default function ConfidentialRoomChat({ currentUser, roomId, roomName, onBack }: ConfidentialRoomChatProps) {
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [inputText, setInputText] = useState('');
  const [showLeakVerifier, setShowLeakVerifier] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch messages
  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [roomId]);

  // Fetch room details
  useEffect(() => {
    fetchRoomDetails();
  }, [roomId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/messages/${currentUser.id}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setMessages(data);
      }
    } catch (err) {
      console.error('Failed to fetch room messages', err);
    }
  };

  const fetchRoomDetails = async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/details`);
      const data = await res.json();
      if (data.members) {
        setMembers(data.members);
      }
    } catch (err) {
      console.error('Failed to fetch room details', err);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;

    const text = inputText.trim();
    setInputText('');
    setSending(true);

    // Optimistic UI
    const tempMsg: RoomMessage = {
      id: crypto.randomUUID(),
      roomId,
      senderId: currentUser.id,
      senderUsername: currentUser.username,
      text,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const res = await fetch(`/api/rooms/${roomId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId: currentUser.id, text }),
      });
      const data = await res.json();
      if (!data.success) throw new Error('Failed to send');
      fetchMessages();
    } catch (err) {
      console.error('Failed to send room message', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Header — amber-themed for confidential rooms */}
      <div className="h-[70px] border-b border-amber-200/50 bg-gradient-to-r from-amber-50/80 to-orange-50/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="md:hidden p-2 -ml-2 rounded-full hover:bg-amber-100 text-amber-700">
            <ChevronLeft size={24} />
          </button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-md shadow-amber-500/25">
            <Shield size={20} />
          </div>
          <div>
            <div className="font-bold text-gray-800">{roomName}</div>
            <div className="text-[10px] text-amber-600 font-bold uppercase tracking-widest flex items-center gap-1">
              <Fingerprint size={10} />
              Fingerprinted • {members.length} members
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowMembers(!showMembers)}
            className="p-2 rounded-full hover:bg-amber-100 text-amber-700 transition-colors"
            title="View members"
          >
            <Users size={20} strokeWidth={2} />
          </button>
          <button
            onClick={() => setShowLeakVerifier(true)}
            className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition-colors flex items-center gap-1.5 text-xs font-semibold border border-red-200"
            title="Report & verify a leak"
          >
            <AlertTriangle size={14} strokeWidth={2.5} />
            <span className="hidden sm:inline">Verify Leak</span>
          </button>
        </div>
      </div>

      {/* Fingerprint Notice Banner */}
      <div className="bg-amber-50/80 border-b border-amber-200/40 px-4 py-2 flex items-center gap-2">
        <Shield size={14} className="text-amber-500 flex-shrink-0" />
        <p className="text-[10px] text-amber-700 font-medium">
          All messages are forensically fingerprinted. Leaked screenshots or text can be traced to the recipient.
        </p>
      </div>

      {/* Members Dropdown */}
      {showMembers && (
        <div className="absolute top-[70px] right-4 z-30 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200 p-3 w-56">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Room Members</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-50">
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold">
                  {m.username.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-gray-700 font-medium">
                  @{m.username}
                  {m.id === currentUser.id && <span className="text-gray-400 text-xs ml-1">(you)</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 p-4 sm:p-6 space-y-4 overflow-y-auto" onClick={() => setShowMembers(false)}>
        <div className="flex justify-center">
          <span className="bg-amber-100/60 px-3 py-1 rounded-full text-[10px] font-medium text-amber-700 uppercase tracking-widest shadow-sm border border-amber-200/50">
            Confidential Room
          </span>
        </div>

        {messages.map((msg, idx) => {
          const isMine = msg.senderId === currentUser.id;
          const showTime = idx === 0 || (msg.timestamp - messages[idx - 1].timestamp > 300000);

          return (
            <div key={msg.id} className="flex flex-col">
              {showTime && idx !== 0 && (
                <div className="text-center my-4">
                  <span className="text-xs font-medium text-gray-400">
                    {new Date(msg.timestamp).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              {/* Show sender name for group chat */}
              {!isMine && (idx === 0 || messages[idx - 1].senderId !== msg.senderId) && (
                <div className="text-[10px] font-bold text-amber-600 mb-1 ml-1">
                  @{msg.senderUsername}
                </div>
              )}
              <div className={`flex w-full ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] sm:max-w-[70%] p-3 text-[15px] leading-relaxed shadow-sm ${
                  isMine
                    ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white rounded-2xl rounded-tr-none shadow-md shadow-amber-500/20'
                    : 'bg-white text-gray-800 rounded-2xl rounded-tl-none border border-gray-100'
                }`}>
                  {msg.text}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 sm:p-6 pt-0">
        <form onSubmit={handleSend} className="bg-white/40 backdrop-blur-xl rounded-2xl p-1.5 flex items-center gap-2 border border-amber-200/50 shadow-sm focus-within:ring-2 focus-within:ring-amber-500/20 transition-all">
          <div className="w-10 h-10 flex items-center justify-center text-amber-500 flex-shrink-0">
            <Fingerprint size={18} strokeWidth={2} />
          </div>

          <input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a confidential message..."
            className="flex-1 h-10 bg-transparent border-none outline-none px-2 text-sm text-gray-800 placeholder:text-gray-500"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
              inputText.trim() && !sending
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30'
                : 'bg-black/5 text-gray-400'
            }`}
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send size={18} strokeWidth={2.5} className="ml-1" />
            )}
          </button>
        </form>
      </div>

      {/* Leak Verifier Modal */}
      {showLeakVerifier && (
        <LeakVerifier
          currentUser={currentUser}
          roomId={roomId}
          roomName={roomName}
          onClose={() => setShowLeakVerifier(false)}
        />
      )}
    </div>
  );
}
