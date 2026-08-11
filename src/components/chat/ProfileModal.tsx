import React, { useState, useRef } from 'react';
import { X, Camera, Copy, Check, RefreshCw, Key, Mail, User as UserIcon, Save, Shield } from 'lucide-react';
import { User } from '../../types';
import ImageCropperModal from './ImageCropperModal';

interface ProfileModalProps {
  currentUser: User;
  onClose: () => void;
  onUpdateUser: (updatedUser: User) => void;
}

export default function ProfileModal({ currentUser, onClose, onUpdateUser }: ProfileModalProps) {
  const [email, setEmail] = useState(currentUser.email || '');
  const [avatar, setAvatar] = useState<string | undefined>(currentUser.avatar);
  const [chatKey, setChatKey] = useState(currentUser.chatKey || '');
  
  const [copiedKey, setCopiedKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Image cropping state
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCopyKey = () => {
    if (chatKey) {
      navigator.clipboard.writeText(chatKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImageSrc(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = (croppedDataUrl: string) => {
    setSelectedImageSrc(null);
    // Store the cropped base64 locally — server will upload to Cloudinary on save
    setAvatar(croppedDataUrl);
  };

  const handleSaveProfile = async (regenerateKey = false) => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          username: currentUser.username,
          email: email.trim(),
          avatar: avatar,
          regenerateChatKey: regenerateKey,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        throw new Error(data?.error || `Failed to update profile (Server error ${res.status})`);
      }

      if (data.user) {
        setChatKey(data.user.chatKey);
        onUpdateUser(data.user);
        setSuccess('Profile updated successfully!');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-6 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-3">
            <UserIcon size={24} className="text-white/90" />
            <div>
              <h2 className="text-xl font-bold">Profile Details</h2>
              <p className="text-white/80 text-xs">Manage your account & identity</p>
            </div>
          </div>
        </div>

        {/* Profile Details Container */}
        <div className="p-6 space-y-5">
          {/* Avatar Picture with Hover Overlay */}
          <div className="flex flex-col items-center">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              {avatar ? (
                <img
                  src={avatar}
                  alt={currentUser.username}
                  className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg group-hover:opacity-80 transition-opacity"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-orange-400 to-pink-500 flex items-center justify-center text-white text-3xl font-bold border-4 border-white shadow-lg">
                  {currentUser.username.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white">
                <Camera size={24} />
              </div>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1"
            >
              <Camera size={14} /> Change Avatar
            </button>
          </div>

          {/* Username (Read-Only) */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Username</label>
            <div className="flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 font-semibold">
              <UserIcon size={16} className="text-gray-400" />
              <span>@{currentUser.username}</span>
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Email Address</label>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus-within:ring-2 focus-within:ring-blue-500/30 transition-all">
              <Mail size={16} className="text-gray-400 ml-1" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full bg-transparent border-none outline-none text-sm text-gray-800"
              />
            </div>
          </div>

          {/* 6-Digit Chat Key */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Direct Chat Key</label>
            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
              <div className="flex items-center gap-2">
                <Key size={16} className="text-amber-600" />
                <span className="font-mono font-bold text-amber-900 tracking-widest text-base">{chatKey || '------'}</span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="p-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 transition-colors"
                  title="Copy Chat Key"
                >
                  {copiedKey ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveProfile(true)}
                  disabled={saving}
                  className="p-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 transition-colors"
                  title="Generate New Key"
                >
                  <RefreshCw size={16} className={saving ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Share this 6-digit key with contacts to connect instantly.</p>
          </div>

          {error && <p className="text-red-500 text-xs text-center">{error}</p>}
          {success && <p className="text-green-600 text-xs text-center font-semibold">{success}</p>}

          {/* Submit Button */}
          <button
            type="button"
            onClick={() => handleSaveProfile(false)}
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 font-semibold shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save size={18} /> Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Image Cropper Modal */}
      {selectedImageSrc && (
        <ImageCropperModal
          imageSrc={selectedImageSrc}
          onCrop={handleCropComplete}
          onClose={() => setSelectedImageSrc(null)}
        />
      )}
    </div>
  );
}
