import { motion } from 'motion/react';
import { Phone, PhoneOff } from 'lucide-react';
import type { User } from '../../types';

interface IncomingCallModalProps {
  caller: User;
  onAccept: () => void;
  onReject: () => void;
}

export default function IncomingCallModal({ caller, onAccept, onReject }: IncomingCallModalProps) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[320px] bg-white/90 backdrop-blur-2xl rounded-[28px] shadow-[0_32px_80px_rgba(0,0,0,0.3)] border border-white/50 flex flex-col items-center p-8 relative overflow-hidden"
      >
        {/* Top glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[120px] rounded-full bg-green-400/20 blur-3xl pointer-events-none" />

        {/* Label */}
        <motion.p
          className="text-xs font-bold text-green-600 uppercase tracking-[0.25em] mb-6"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          Incoming Voice Call
        </motion.p>

        {/* Avatar with ring animation */}
        <div className="relative mb-5">
          {/* Pulsing rings */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute inset-0 rounded-full border-2 border-green-400/30"
              animate={{
                scale: [1, 2.2],
                opacity: [0.6, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.5,
                ease: 'easeOut',
              }}
            />
          ))}

          {/* Avatar */}
          {caller.avatar ? (
            <img
              src={caller.avatar}
              alt={caller.username}
              className="w-20 h-20 rounded-full object-cover border-3 border-white shadow-lg relative z-10"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-orange-400 to-pink-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg relative z-10 border-3 border-white">
              {caller.username.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Caller name */}
        <h2 className="text-lg font-bold text-gray-900 mb-1">@{caller.username}</h2>
        <p className="text-xs text-gray-500 mb-8">Mesh Voice Call</p>

        {/* Accept / Reject buttons */}
        <div className="flex items-center gap-8">
          {/* Reject */}
          <div className="flex flex-col items-center gap-1.5">
            <motion.button
              onClick={onReject}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="w-14 h-14 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white shadow-lg shadow-red-500/30 hover:shadow-red-500/50 transition-shadow"
            >
              <PhoneOff size={22} />
            </motion.button>
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Decline</span>
          </div>

          {/* Accept */}
          <div className="flex flex-col items-center gap-1.5">
            <motion.button
              onClick={onAccept}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              className="w-14 h-14 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white shadow-lg shadow-green-500/30 hover:shadow-green-500/50 transition-shadow"
            >
              <Phone size={22} />
            </motion.button>
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Accept</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
