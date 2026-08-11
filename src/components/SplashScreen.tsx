import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const STATUS_MESSAGES = [
  { text: 'Initializing secure channels...', delay: 1200 },
  { text: 'Connecting to database...', delay: 2400 },
  { text: 'Loading encryption keys...', delay: 3600 },
  { text: 'Ready', delay: 4600 },
];

export default function SplashScreen({ onFinished }: { onFinished: () => void }) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter');
  const [statusIndex, setStatusIndex] = useState(-1);

  useEffect(() => {
    const holdTimer = setTimeout(() => setPhase('hold'), 800);
    const exitTimer = setTimeout(() => setPhase('exit'), 5000);
    const doneTimer = setTimeout(() => onFinished(), 5800);

    // Schedule status messages
    const statusTimers = STATUS_MESSAGES.map((msg, i) =>
      setTimeout(() => setStatusIndex(i), msg.delay)
    );

    return () => {
      clearTimeout(holdTimer);
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
      statusTimers.forEach(clearTimeout);
    };
  }, [onFinished]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-6"
        style={{ background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 40%, #16213e 100%)' }}
        initial={{ opacity: 1 }}
        animate={{ opacity: phase === 'exit' ? 0 : 1 }}
        transition={{ duration: 0.8, ease: 'easeInOut' }}
      >
        {/* Subtle ambient glow */}
        <div
          className="absolute w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] md:w-[600px] md:h-[600px] rounded-full opacity-20 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(99,102,241,0.4) 0%, rgba(139,92,246,0.15) 40%, transparent 70%)',
          }}
        />

        {/* Logo area */}
        <motion.div
          className="relative z-10 flex flex-col items-center gap-4 sm:gap-5"
          initial={{ opacity: 0, y: 30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* MESH wordmark */}
          <div className="relative">
            <h1
              className="text-5xl xs:text-6xl sm:text-7xl md:text-8xl font-black tracking-[0.2em] sm:tracking-[0.25em] text-transparent bg-clip-text"
              style={{
                backgroundImage: 'linear-gradient(135deg, #e0e7ff 0%, #a5b4fc 30%, #818cf8 60%, #c4b5fd 100%)',
                fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif",
              }}
            >
              MESH
            </h1>
            {/* Glow reflection */}
            <div
              className="absolute inset-0 text-5xl xs:text-6xl sm:text-7xl md:text-8xl font-black tracking-[0.2em] sm:tracking-[0.25em] text-transparent bg-clip-text blur-2xl opacity-40 pointer-events-none"
              style={{
                backgroundImage: 'linear-gradient(135deg, #818cf8 0%, #a78bfa 50%, #c4b5fd 100%)',
                fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif",
              }}
              aria-hidden="true"
            >
              MESH
            </div>
          </div>

          {/* Thin separator line */}
          <motion.div
            className="h-[1px] bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent"
            initial={{ width: 0 }}
            animate={{ width: 120 }}
            transition={{ duration: 1, delay: 0.4, ease: 'easeOut' }}
          />

          {/* from Joash Technologies */}
          <motion.p
            className="text-[10px] sm:text-[11px] md:text-xs font-medium tracking-[0.3em] sm:tracking-[0.35em] uppercase text-center"
            style={{ color: 'rgba(165, 180, 252, 0.6)' }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6, ease: 'easeOut' }}
          >
            from <span style={{ color: 'rgba(199, 210, 254, 0.8)' }}>Joash Technologies</span>
          </motion.p>
        </motion.div>

        {/* Bottom loader + status messages */}
        <motion.div
          className="absolute bottom-10 sm:bottom-14 md:bottom-18 flex flex-col items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
        >
          {/* Rotating spinner */}
          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-indigo-400/20 border-t-indigo-400/70 animate-spin" />

          {/* Status text */}
          <div className="h-5 flex items-center justify-center">
            <AnimatePresence mode="wait">
              {statusIndex >= 0 && (
                <motion.p
                  key={statusIndex}
                  className="text-[10px] sm:text-[11px] font-medium tracking-wider text-center"
                  style={{ color: 'rgba(165, 180, 252, 0.5)' }}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                >
                  {STATUS_MESSAGES[statusIndex].text}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
