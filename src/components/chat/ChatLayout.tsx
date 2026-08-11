import { useState, useEffect } from 'react';
import { User, ChatContact, Message, ConfidentialRoom } from '../../types';
import Sidebar from './Sidebar';
import MessageArea from './MessageArea';
import ConfidentialRoomChat from './ConfidentialRoomChat';
import CreateRoomModal from './CreateRoomModal';
import ProfileModal from './ProfileModal';
import { generateKeyPair, exportKey, encryptMessage, decryptMessage } from '../../lib/e2ee';

interface ChatLayoutProps {
  currentUser: User;
  onLogout: () => void;
}

export default function ChatLayout({ currentUser: initialUser, onLogout }: ChatLayoutProps) {
  const [currentUser, setCurrentUser] = useState<User>(initialUser);
  const [activeChatId, setActiveChatId] = useState<string | undefined>();
  const [activeRoomId, setActiveRoomId] = useState<string | undefined>();
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [rooms, setRooms] = useState<ConfidentialRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    const initKeys = async () => {
      let privKey = localStorage.getItem(`e2ee_priv_${currentUser.id}`);
      let pubKey = localStorage.getItem(`e2ee_pub_${currentUser.id}`);
      
      if (!privKey || !pubKey) {
        try {
           const keyPair = await generateKeyPair();
           privKey = await exportKey(keyPair.privateKey);
           pubKey = await exportKey(keyPair.publicKey);
           localStorage.setItem(`e2ee_priv_${currentUser.id}`, privKey);
           localStorage.setItem(`e2ee_pub_${currentUser.id}`, pubKey);
           
           await fetch('/api/auth/keys', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ userId: currentUser.id, publicKey: pubKey })
           });
        } catch (e) {
           console.error("Failed to init keys", e);
        }
      } else {
        // Just ensure server has our current pubKey
        await fetch('/api/auth/keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser.id, publicKey: pubKey })
        });
      }
    };
    initKeys();
  }, [currentUser.id]);

  useEffect(() => {
    fetchContacts();
    fetchRooms();
    // Poll for new contacts/messages/rooms periodically
    const interval = setInterval(() => {
      fetchContacts();
      fetchRooms();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchContacts = async () => {
    try {
      const res = await fetch(`/api/contacts/${currentUser.id}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        const privKey = localStorage.getItem(`e2ee_priv_${currentUser.id}`);
        if (privKey) {
          const decryptedContacts = await Promise.all(data.map(async (c: ChatContact) => {
             if (c.lastMessage) {
               const isReceiver = c.lastMessage.receiverId === currentUser.id;
               c.lastMessage.text = await decryptMessage(c.lastMessage.text, privKey, isReceiver);
             }
             return c;
          }));
          setContacts(decryptedContacts);
        } else {
          setContacts(data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch contacts', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRooms = async () => {
    try {
      const res = await fetch(`/api/rooms/${currentUser.id}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setRooms(data);
      }
    } catch (err) {
      console.error('Failed to fetch rooms', err);
    }
  };

  useEffect(() => {
    if (activeChatId) {
      fetchMessages(activeChatId);
      const interval = setInterval(() => fetchMessages(activeChatId), 3000);
      return () => clearInterval(interval);
    }
  }, [activeChatId]);

  const fetchMessages = async (otherUserId: string) => {
    try {
      const res = await fetch(`/api/messages/${currentUser.id}/${otherUserId}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        const privKey = localStorage.getItem(`e2ee_priv_${currentUser.id}`);
        if (privKey) {
           const decryptedMessages = await Promise.all(data.map(async (msg: Message) => {
             const isReceiver = msg.receiverId === currentUser.id;
             const text = await decryptMessage(msg.text, privKey, isReceiver);
             return { ...msg, text };
           }));
           setMessages(prev => ({ ...prev, [otherUserId]: decryptedMessages }));
        } else {
           setMessages(prev => ({ ...prev, [otherUserId]: data }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch messages', err);
    }
  };

  const activeContact = contacts.find(c => c.user.id === activeChatId);
  const activeRoom = rooms.find(r => r.id === activeRoomId);

  const handleSendMessage = async (text: string) => {
    if (!activeChatId) return;

    const privKey = localStorage.getItem(`e2ee_priv_${currentUser.id}`);
    const pubKey = localStorage.getItem(`e2ee_pub_${currentUser.id}`);
    const receiverPubKey = activeContact?.user.publicKey;

    let payload = text;
    if (privKey && pubKey && receiverPubKey) {
      try {
        payload = await encryptMessage(text, receiverPubKey, pubKey);
      } catch (e) {
        console.error("Encryption failed", e);
        alert("Failed to encrypt message.");
        return;
      }
    } else if (!receiverPubKey) {
      alert("Cannot send encrypted message: Contact has not set up E2EE keys yet. They need to login first.");
      return;
    }

    // Optimistic UI update
    const tempId = crypto.randomUUID();
    const newMessage: Message = {
      id: tempId,
      senderId: currentUser.id,
      receiverId: activeChatId,
      text, // store plaintext locally for immediate render
      timestamp: Date.now(),
    };

    setMessages(prev => ({
      ...prev,
      [activeChatId]: [...(prev[activeChatId] || []), newMessage]
    }));

    setContacts(prev => prev.map(c => 
      c.user.id === activeChatId 
        ? { ...c, lastMessage: newMessage, unreadCount: 0 }
        : c
    ));

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId: currentUser.id, receiverId: activeChatId, text: payload })
      });
      const data = await res.json();
      if (!data.success) throw new Error('Failed to send');
      // Fetch latest to get real ID
      fetchMessages(activeChatId);
      fetchContacts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectChat = (id: string) => {
    setActiveChatId(id);
    setActiveRoomId(undefined); // deselect room
    setContacts(prev => prev.map(c => 
      c.user.id === id ? { ...c, unreadCount: 0 } : c
    ));
  };

  const handleSelectRoom = (id: string) => {
    setActiveRoomId(id);
    setActiveChatId(undefined); // deselect chat
  };

  const handleRoomCreated = (roomId: string) => {
    setShowCreateRoom(false);
    fetchRooms();
    setActiveRoomId(roomId);
    setActiveChatId(undefined);
  };

  // Determine what to show in the main area
  const showChat = activeChatId && activeContact;
  const showRoom = activeRoomId && activeRoom;

  return (
    <div className="w-full h-full glass-panel flex overflow-hidden relative ring-0 shadow-2xl rounded-2xl md:rounded-3xl">
      
      {/* Sidebar - hides on mobile if chat/room is active */}
      <div className={`w-full md:w-[320px] glass-sidebar flex-col h-full transition-all duration-300 ${(activeChatId || activeRoomId) ? 'hidden md:flex' : 'flex'}`}>
        <Sidebar 
          contacts={contacts} 
          activeChatId={activeChatId} 
          onSelectChat={handleSelectChat}
          currentUser={currentUser}
          onLogout={onLogout}
          rooms={rooms}
          activeRoomId={activeRoomId}
          onSelectRoom={handleSelectRoom}
          onCreateRoom={() => setShowCreateRoom(true)}
          onOpenProfile={() => setShowProfile(true)}
        />
      </div>
      
      {/* Main Chat / Room Area */}
      <div className={`flex-1 h-full flex-col relative bg-white/10 transition-all duration-300 ${(activeChatId || activeRoomId) ? 'flex' : 'hidden md:flex'}`}>
        {showRoom ? (
          <ConfidentialRoomChat
            currentUser={currentUser}
            roomId={activeRoom.id}
            roomName={activeRoom.name}
            onBack={() => setActiveRoomId(undefined)}
          />
        ) : showChat ? (
          <MessageArea 
            currentUser={currentUser} 
            chatUser={activeContact.user} 
            messages={messages[activeChatId] || []} 
            onBack={() => setActiveChatId(undefined)}
            onSendMessage={handleSendMessage}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-transparent">
            <div className="w-24 h-24 bg-white/40 rounded-full flex items-center justify-center mb-6 shadow-sm backdrop-blur-md border border-white/50">
              <svg className="w-10 h-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">No Chat Selected</h2>
            <p className="text-gray-500 max-w-sm">Choose a contact or confidential room from the sidebar to start a conversation.</p>
          </div>
        )}
      </div>

      {/* Create Room Modal */}
      {showCreateRoom && (
        <CreateRoomModal
          currentUser={currentUser}
          contacts={contacts}
          onClose={() => setShowCreateRoom(false)}
          onCreated={handleRoomCreated}
        />
      )}

      {/* Profile Modal */}
      {showProfile && (
        <ProfileModal
          currentUser={currentUser}
          onClose={() => setShowProfile(false)}
          onUpdateUser={(updated) => {
            setCurrentUser(updated);
            fetchContacts();
          }}
        />
      )}
    </div>
  );
}
