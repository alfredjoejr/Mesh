import React, { useState, useRef, useEffect } from 'react';
import { Send, ChevronLeft, Info, Phone, Video, Paperclip } from 'lucide-react';
import { User, Message, CallState } from '../../types';
import ActiveCallOverlay from './ActiveCallOverlay';

interface MessageAreaProps {
  currentUser: User;
  chatUser: User;
  messages: Message[];
  onBack: () => void;
  onSendMessage: (text: string) => void;
  callState: CallState;
  onStartCall: (user: User) => void;
  onEndCall: () => void;
  onToggleMute: () => void;
}

export default function MessageArea({ currentUser, chatUser, messages, onBack, onSendMessage, callState, onStartCall, onEndCall, onToggleMute }: MessageAreaProps) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Active Call Overlay */}
      {(callState.status === 'active' || callState.status === 'connecting' || callState.status === 'outgoing') &&
        callState.remoteUser?.id === chatUser.id && (
          <ActiveCallOverlay
            remoteUser={chatUser}
            callStartTime={callState.callStartTime}
            isMuted={callState.isMuted}
            isConnecting={callState.status === 'connecting' || callState.status === 'outgoing'}
            onToggleMute={onToggleMute}
            onEndCall={onEndCall}
          />
        )}
      {/* Header */}
      <div className="h-[70px] border-b border-white/20 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="md:hidden p-2 -ml-2 rounded-full hover:bg-white/20 text-blue-600">
            <ChevronLeft size={24} />
          </button>
          {chatUser.avatar ? (
            <img
              src={chatUser.avatar}
              alt={chatUser.username}
              className="w-10 h-10 rounded-full object-cover shadow-sm border border-white/60"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold shadow-sm">
              {chatUser.username.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="font-bold text-gray-800">@{chatUser.username}</div>
            <div className="text-[10px] text-green-600 font-bold uppercase tracking-widest flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_4px_rgba(34,197,89,0.5)]"></span>
              Encrypted
            </div>
          </div>
        </div>
        
        <div className="flex gap-2 sm:gap-4">
          <button
            onClick={() => onStartCall(chatUser)}
            disabled={callState.status !== 'idle'}
            className={`p-2 rounded-full transition-colors ${
              callState.status !== 'idle'
                ? 'text-gray-400 cursor-not-allowed'
                : 'hover:bg-white/20 text-blue-600'
            }`}
          >
            <Phone size={20} strokeWidth={2} />
          </button>
          <button className="p-2 rounded-full hover:bg-white/20 text-blue-600 transition-colors hidden sm:block">
            <Video size={20} strokeWidth={2} />
          </button>
          <button className="p-2 rounded-full hover:bg-white/20 text-blue-600 transition-colors">
            <Info size={20} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 sm:p-6 space-y-4 overflow-y-auto">
        <div className="flex justify-center">
          <span className="bg-black/5 px-3 py-1 rounded-full text-[10px] font-medium text-gray-500 uppercase tracking-widest shadow-sm border border-black/5">
            Today
          </span>
        </div>
        
        {messages.map((msg, idx) => {
          const isMine = msg.senderId === currentUser.id;
          const showTime = idx === 0 || (msg.timestamp - messages[idx - 1].timestamp > 300000); // 5 mins

          return (
            <div key={msg.id} className="flex flex-col">
              {showTime && idx !== 0 && (
                <div className="text-center my-4">
                  <span className="text-xs font-medium text-gray-400">
                    {new Date(msg.timestamp).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              <div className={`flex w-full ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] sm:max-w-[70%] p-3 text-[15px] leading-relaxed shadow-sm ${
                  isMine 
                    ? 'bg-blue-600 text-white rounded-2xl rounded-tr-none shadow-md shadow-blue-600/20' 
                    : 'bg-white text-gray-800 rounded-2xl rounded-tl-none border border-white/50'
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
        <form onSubmit={handleSend} className="bg-white/40 backdrop-blur-xl rounded-2xl p-1.5 flex items-center gap-2 border border-white/50 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
          <button type="button" className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-blue-500 transition-colors flex-shrink-0">
            <Paperclip size={20} strokeWidth={2} />
          </button>
          
          <input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a secure message..."
            className="flex-1 h-10 bg-transparent border-none outline-none px-2 text-sm text-gray-800 placeholder:text-gray-500"
          />
          
          <button 
            type="submit" 
            disabled={!inputText.trim()}
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
              inputText.trim() 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                : 'bg-black/5 text-gray-400'
            }`}
          >
            <Send size={18} strokeWidth={2.5} className="ml-1" />
          </button>
        </form>
      </div>
    </div>
  );
}
