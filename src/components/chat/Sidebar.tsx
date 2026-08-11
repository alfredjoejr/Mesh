import React, { useState, useEffect } from 'react';
import { Search, Edit, LogOut, Plus, X, Key, Check, Shield, Fingerprint } from 'lucide-react';
import { ChatContact, User, ConfidentialRoom } from '../../types';

interface SidebarProps {
  contacts: ChatContact[];
  activeChatId?: string;
  onSelectChat: (id: string) => void;
  currentUser: User;
  onLogout?: () => void;
  rooms: ConfidentialRoom[];
  activeRoomId?: string;
  onSelectRoom: (id: string) => void;
  onCreateRoom: () => void;
  onOpenProfile?: () => void;
}

export default function Sidebar({
  contacts, activeChatId, onSelectChat, currentUser, onLogout,
  rooms, activeRoomId, onSelectRoom, onCreateRoom, onOpenProfile
}: SidebarProps) {
  const [showNewChat, setShowNewChat] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newChatKey, setNewChatKey] = useState('');
  const [newChatError, setNewChatError] = useState('');
  const [newChatSuccess, setNewChatSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSection, setActiveSection] = useState<'chats' | 'rooms'>('chats');
  
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUser.id) return;
    const fetchReqs = async () => {
      try {
        const res = await fetch(`/api/contacts/requests/${currentUser.id}`);
        const data = await res.json();
        setPendingRequests(data);
      } catch(e) {}
    };
    fetchReqs();
    const interval = setInterval(fetchReqs, 5000);
    return () => clearInterval(interval);
  }, [currentUser.id]);

  const handleRespond = async (requestId: string, action: 'accept' | 'reject') => {
    try {
      await fetch('/api/contacts/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action })
      });
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (e) {}
  };
  
  const formatTime = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewChatError('');
    setNewChatSuccess('');
    
    if (!currentUser.id) return;

    try {
      const res = await fetch('/api/contacts/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUser.id,
          username: newUsername,
          chatKey: newChatKey,
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setNewChatSuccess(data.message);
      setTimeout(() => {
        setShowNewChat(false);
        setNewUsername('');
        setNewChatKey('');
        setNewChatSuccess('');
      }, 2000);
    } catch (err: any) {
      setNewChatError(err.message || 'Failed to send request');
    }
  };

  const filteredContacts = contacts.filter(c => 
    c.user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRooms = rooms.filter(r =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="p-6 pb-2 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Messages</h2>
        <div className="flex items-center gap-2">
          <div 
            onClick={onCreateRoom}
            className="w-8 h-8 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:from-amber-600 hover:to-orange-600 transition-all"
            title="Create Confidential Room"
          >
            <Shield size={14} className="text-white" strokeWidth={2.5} />
          </div>
          <div 
            onClick={() => setShowNewChat(true)}
            className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:bg-blue-600 transition-colors"
            title="New Chat"
          >
            <Edit size={16} className="text-white" strokeWidth={2.5} />
          </div>
        </div>
      </div>

      {/* Section Toggle */}
      <div className="px-6 py-1 flex gap-1">
        <button
          onClick={() => setActiveSection('chats')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
            activeSection === 'chats'
              ? 'bg-blue-500 text-white shadow-sm'
              : 'bg-white/20 text-gray-500 hover:bg-white/40'
          }`}
        >
          Chats
        </button>
        <button
          onClick={() => setActiveSection('rooms')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${
            activeSection === 'rooms'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm'
              : 'bg-white/20 text-gray-500 hover:bg-white/40'
          }`}
        >
          <Shield size={12} />
          Rooms
          {rooms.length > 0 && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
              activeSection === 'rooms' ? 'bg-white/20' : 'bg-amber-100 text-amber-600'
            }`}>
              {rooms.length}
            </span>
          )}
        </button>
      </div>

      {/* New Chat Modal/Overlay */}
      {showNewChat && (
        <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-md flex flex-col p-6 shadow-xl border-r border-white/20">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-800">New Connection</h3>
            <button onClick={() => setShowNewChat(false)} className="text-gray-500 hover:text-gray-800 transition-colors">
              <X size={20} />
            </button>
          </div>
          <form onSubmit={handleAddContact} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1 block">Username</label>
              <input 
                type="text"
                required
                placeholder="e.g. johndoe"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full bg-white/50 border border-white shadow-sm rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1 block">Chat Key (Optional)</label>
              <input 
                type="text"
                placeholder="6-digit key to connect instantly"
                value={newChatKey}
                onChange={(e) => setNewChatKey(e.target.value)}
                className="w-full bg-white/50 border border-white shadow-sm rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            
            {newChatError && <p className="text-red-500 text-xs text-center">{newChatError}</p>}
            {newChatSuccess && <p className="text-green-500 text-xs text-center font-semibold">{newChatSuccess}</p>}
            
            <button type="submit" className="mt-2 w-full bg-blue-600 text-white rounded-xl py-3 font-semibold shadow-md hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
              <Plus size={18} /> Connect
            </button>
          </form>
        </div>
      )}

      {/* Search Bar */}
      <div className="px-6 py-2">
        <div className="bg-white/30 backdrop-blur-sm rounded-xl px-3 py-2 flex items-center gap-2 border border-white/20 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/30 transition-all">
          <Search size={16} className="text-gray-500" strokeWidth={2} />
          <input 
            type="text"
            placeholder={activeSection === 'chats' ? 'Search contacts...' : 'Search rooms...'} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none outline-none text-sm text-gray-700 placeholder:text-gray-500 w-full"
          />
        </div>
      </div>

      {/* Pending Requests (only in chats section) */}
      {activeSection === 'chats' && pendingRequests.length > 0 && !searchTerm && (
        <div className="px-4 py-2 border-b border-white/20 bg-blue-500/10">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2 px-2">Pending Requests</p>
          <div className="space-y-2">
            {pendingRequests.map(req => (
              <div key={req.id} className="flex items-center justify-between bg-white/50 backdrop-blur-sm rounded-xl p-2 px-3 border border-white/40 shadow-sm">
                <span className="text-sm font-semibold text-gray-800">@{req.user.username}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleRespond(req.id, 'accept')} className="w-6 h-6 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center transition-colors shadow-sm">
                    <Check size={14} strokeWidth={3} />
                  </button>
                  <button onClick={() => handleRespond(req.id, 'reject')} className="w-6 h-6 rounded-full bg-red-400 hover:bg-red-500 text-white flex items-center justify-center transition-colors shadow-sm">
                    <X size={14} strokeWidth={3} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat / Room Rows */}
      <div className="flex-1 py-4 overflow-y-auto px-4 space-y-2">
        {activeSection === 'chats' ? (
          // ── Chats Section ──
          filteredContacts.map((contact) => (
            <div
              key={contact.user.id}
              onClick={() => onSelectChat(contact.user.id)}
              className={`rounded-2xl p-3 flex items-center gap-3 cursor-pointer transition-all ${
                activeChatId === contact.user.id && !activeRoomId
                  ? 'bg-white/50 backdrop-blur-md border border-white/30 shadow-sm' 
                  : 'hover:bg-white/20 border border-transparent'
              }`}
            >
              {contact.user.avatar ? (
                <img
                  src={contact.user.avatar}
                  alt={contact.user.username}
                  className={`w-12 h-12 rounded-full flex-shrink-0 object-cover border-2 ${
                    activeChatId === contact.user.id && !activeRoomId ? 'border-white/50 shadow-sm' : 'border-transparent'
                  }`}
                />
              ) : (
                <div className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-white text-lg font-bold border-2 ${
                  activeChatId === contact.user.id && !activeRoomId ? 'border-white/50 shadow-sm' : 'border-transparent'
                } bg-gradient-to-tr from-orange-400 to-pink-500`}>
                  {contact.user.username.charAt(0).toUpperCase()}
                </div>
              )}
              
              <div className="flex-1 overflow-hidden">
                <div className="flex justify-between items-baseline mb-0.5">
                  <span className="font-semibold text-gray-900 truncate">@{contact.user.username}</span>
                  {contact.lastMessage && (
                    <span className={`text-[10px] whitespace-nowrap ml-2 ${activeChatId === contact.user.id && !activeRoomId ? 'text-gray-600 font-medium' : 'text-gray-500'}`}>
                      {formatTime(contact.lastMessage.timestamp)}
                    </span>
                  )}
                </div>
                <p className={`text-xs truncate ${activeChatId === contact.user.id && !activeRoomId ? 'text-gray-600' : 'text-gray-500'}`}>
                  {contact.lastMessage?.text || "New encrypted chat..."}
                </p>
              </div>
              
              {contact.unreadCount > 0 && activeChatId !== contact.user.id && (
                <div className="w-5 h-5 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                  {contact.unreadCount}
                </div>
              )}
            </div>
          ))
        ) : (
          // ── Rooms Section ──
          <>
            {filteredRooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mb-4">
                  <Shield size={28} className="text-amber-500" />
                </div>
                <p className="text-sm font-semibold text-gray-700 mb-1">No Confidential Rooms</p>
                <p className="text-xs text-gray-500 max-w-[200px]">Create a room to start sending forensically fingerprinted messages.</p>
                <button
                  onClick={onCreateRoom}
                  className="mt-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-md hover:from-amber-600 hover:to-orange-600 transition-all flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  Create Room
                </button>
              </div>
            ) : (
              filteredRooms.map(room => (
                <div
                  key={room.id}
                  onClick={() => onSelectRoom(room.id)}
                  className={`rounded-2xl p-3 flex items-center gap-3 cursor-pointer transition-all ${
                    activeRoomId === room.id
                      ? 'bg-amber-50/80 backdrop-blur-md border border-amber-200/50 shadow-sm'
                      : 'hover:bg-white/20 border border-transparent'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center text-white shadow-md ${
                    activeRoomId === room.id
                      ? 'bg-gradient-to-tr from-amber-500 to-orange-500'
                      : 'bg-gradient-to-tr from-amber-400 to-orange-400'
                  }`}>
                    <Shield size={20} />
                  </div>
                  
                  <div className="flex-1 overflow-hidden">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className="font-semibold text-gray-900 truncate">{room.name}</span>
                      {room.lastMessage && (
                        <span className="text-[10px] whitespace-nowrap ml-2 text-gray-500">
                          {formatTime(room.lastMessage.timestamp)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Fingerprint size={10} className="text-amber-500 flex-shrink-0" />
                      <p className="text-xs text-gray-500 truncate">
                        {room.lastMessage
                          ? `${room.lastMessage.senderUsername}: ${room.lastMessage.text}`
                          : `${room.memberCount} members • Fingerprinted`
                        }
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
      
      {/* Current User Status */}
      <div className="p-4 border-t border-white/20">
        <div className="flex items-center justify-between">
           <div
             onClick={onOpenProfile}
             className="flex items-center gap-2.5 cursor-pointer hover:bg-white/30 p-1.5 -ml-1.5 rounded-xl transition-all flex-1 mr-2"
             title="Click to view & edit profile"
           >
             {currentUser.avatar ? (
               <img
                 src={currentUser.avatar}
                 alt={currentUser.username}
                 className="w-9 h-9 rounded-full object-cover shadow-sm border border-white/60"
               />
             ) : (
               <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                 {currentUser.username.charAt(0).toUpperCase()}
               </div>
             )}
             <div className="overflow-hidden">
               <p className="text-sm font-semibold text-gray-800 leading-tight truncate">@{currentUser.username}</p>
               <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-500">
                 <Key size={10} />
                 <span className="truncate">{currentUser.chatKey || 'No Key'}</span>
               </div>
             </div>
           </div>
           
           {onLogout && (
             <button 
               onClick={onLogout}
               className="p-2 rounded-xl bg-white/40 hover:bg-white/60 text-gray-700 transition-colors shadow-sm border border-white/50 flex-shrink-0"
               title="Logout"
             >
               <LogOut size={16} strokeWidth={2.5} />
             </button>
           )}
        </div>
      </div>
    </div>
  );
}
