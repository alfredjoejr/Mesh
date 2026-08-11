import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { PhoneOff, Mic, MicOff } from 'lucide-react';
import type { User } from '../../types';

interface ActiveCallOverlayProps {
  remoteUser: User;
  callStartTime: number | null;
  isMuted: boolean;
  isConnecting?: boolean;
  onToggleMute: () => void;
  onEndCall: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function ActiveCallOverlay({
  remoteUser,
  callStartTime,
  isMuted,
  isConnecting,
  onToggleMute,
  onEndCall,
}: ActiveCallOverlayProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!callStartTime) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - callStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [callStartTime]);

  return (
    <motion.div
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -60, opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="absolute top-0 left-0 right-0 z-30 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2.5 flex items-center justify-between shadow-lg shadow-green-600/20"
    >
      {/* Left: user info */}
      <div className="flex items-center gap-3 min-w-0">
        {remoteUser.avatar ? (
          <img
            src={remoteUser.avatar}
            alt={remoteUser.username}
            className="w-8 h-8 rounded-full object-cover border-2 border-white/40 flex-shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {remoteUser.username.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">@{remoteUser.username}</div>
          <div className="text-[10px] font-medium text-white/80 uppercase tracking-wider flex items-center gap-1.5">
            {isConnecting ? (
              <>
                <motion.span
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  Connecting...
                </motion.span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                {formatDuration(elapsed)}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-2">
        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={onToggleMute}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
            isMuted ? 'bg-white/30' : 'bg-white/15 hover:bg-white/25'
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.85 }}
          onClick={onEndCall}
          className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors shadow-sm"
          title="End Call"
        >
          <PhoneOff size={14} />
        </motion.button>
      </div>
    </motion.div>
  );
}
