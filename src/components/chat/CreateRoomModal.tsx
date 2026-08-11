import React, { useState } from 'react';
import { X, Shield, Plus, UserPlus, Fingerprint } from 'lucide-react';
import { User, ChatContact } from '../../types';

interface CreateRoomModalProps {
  currentUser: User;
  contacts: ChatContact[];
  onClose: () => void;
  onCreated: (roomId: string) => void;
}

export default function CreateRoomModal({ currentUser, contacts, onClose, onCreated }: CreateRoomModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleMember = (userId: string) => {
    setSelectedMembers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: currentUser.id,
          name: name.trim(),
          description: description.trim() || undefined,
          memberIds: selectedMembers,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      onCreated(data.room.id);
    } catch (err: any) {
      setError(err.message || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 p-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Shield size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Confidential Room</h2>
              <p className="text-white/80 text-xs">Forensically fingerprinted messages</p>
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="mx-4 mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-start gap-2.5 shadow-sm">
          <Fingerprint size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-amber-800 leading-relaxed">
            Every message in this room is uniquely fingerprinted per recipient. If any content is leaked via screenshot or copy-paste, the source can be traced.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleCreate} className="p-4 pt-3 space-y-4">
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Room Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Board Meeting Q4"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 transition-all"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Description (Optional)</label>
            <input
              type="text"
              placeholder="What is this room for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 transition-all"
            />
          </div>

          {/* Member Selection */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">
              <UserPlus size={12} className="inline mr-1" />
              Add Members ({selectedMembers.length} selected)
            </label>
            <div className="max-h-40 overflow-y-auto space-y-1.5 bg-gray-50 border border-gray-200 rounded-xl p-2">
              {contacts.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-3">No contacts yet. Add contacts first.</p>
              ) : (
                contacts.map(c => (
                  <button
                    key={c.user.id}
                    type="button"
                    onClick={() => toggleMember(c.user.id)}
                    className={`w-full flex items-center gap-2.5 p-2 rounded-lg transition-all text-left ${
                      selectedMembers.includes(c.user.id)
                        ? 'bg-amber-100 border border-amber-300 shadow-sm'
                        : 'hover:bg-white border border-transparent'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                      selectedMembers.includes(c.user.id)
                        ? 'bg-gradient-to-tr from-amber-500 to-orange-500'
                        : 'bg-gradient-to-tr from-gray-400 to-gray-500'
                    }`}>
                      {c.user.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-gray-700">@{c.user.username}</span>
                    {selectedMembers.includes(c.user.id) && (
                      <div className="ml-auto w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                        <Plus size={12} className="text-white rotate-45" />
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {error && <p className="text-red-500 text-xs text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl py-3 font-semibold shadow-lg shadow-amber-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Shield size={18} />
                Create Confidential Room
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
