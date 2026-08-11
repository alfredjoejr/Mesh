import { useState, useCallback } from 'react';
import LoginScreen from './components/auth/LoginScreen';
import ChatLayout from './components/chat/ChatLayout';
import SplashScreen from './components/SplashScreen';
import { User } from './types';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [splashDone, setSplashDone] = useState(false);

  const handleSplashFinished = useCallback(() => {
    setSplashDone(true);
  }, []);

  return (
    <>
      {/* Splash Screen */}
      {!splashDone && <SplashScreen onFinished={handleSplashFinished} />}

      {/* Main App */}
      <div className="h-screen w-screen bg-gradient-to-br from-[#A2C2E1] via-[#E2BBE9] to-[#F9D1D1] font-sans flex flex-col p-2 sm:p-4 md:p-6 relative overflow-hidden select-none">
        {/* BACKGROUND DECORATION */}
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 pointer-events-none"></div>

        <div className="flex-1 flex relative z-10 w-full h-full min-h-0">
          {currentUser ? (
            <ChatLayout currentUser={currentUser} onLogout={() => setCurrentUser(null)} />
          ) : (
            <div className="m-auto w-full max-w-[400px]">
              <LoginScreen onLogin={(user) => setCurrentUser(user)} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
