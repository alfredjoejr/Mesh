import { useState, useEffect } from 'react';
import { X, Upload, Search, AlertTriangle, Shield, CheckCircle, XCircle, Fingerprint, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { User, LeakReport } from '../../types';

interface LeakVerifierProps {
  currentUser: User;
  roomId: string;
  roomName: string;
  onClose: () => void;
}

interface VerificationResult {
  reportId: string;
  attribution: {
    userId: string;
    username: string;
    confidence: string;
    bitsMatched: number;
    bitsTotal: number;
    layersDetected: string[];
  } | null;
  message?: string;
}

const LAYER_LABELS: Record<string, { label: string; icon: string; desc: string }> = {
  zeroWidth: { label: 'Zero-Width Chars', icon: '🔤', desc: 'Invisible Unicode characters embedded between words' },
  homoglyphs: { label: 'Homoglyphs', icon: '🔠', desc: 'Visually identical character substitutions (e.g. Latin "e" → Cyrillic "е")' },
  punctuation: { label: 'Punctuation', icon: '✏️', desc: 'Semantically equivalent punctuation variants' },
  whitespace: { label: 'Whitespace', icon: '⬜', desc: 'Micro-variations in spacing characters' },
  aiLinguistic: { label: 'AI Linguistic', icon: '🧠', desc: 'AI-generated paraphrasing with preserved meaning' },
  textSimilarity: { label: 'Text Match', icon: '📝', desc: 'Direct text comparison against known variants' },
};

export default function LeakVerifier({ currentUser, roomId, roomName, onClose }: LeakVerifierProps) {
  const [leakedText, setLeakedText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [pastReports, setPastReports] = useState<LeakReport[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<'verify' | 'history'>('verify');

  useEffect(() => {
    fetchPastReports();
  }, [roomId]);

  const fetchPastReports = async () => {
    try {
      const res = await fetch(`/api/rooms/${roomId}/leak-reports`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setPastReports(data);
      }
    } catch (err) {
      console.error('Failed to fetch leak reports', err);
    }
  };

  const handleVerify = async () => {
    if (!leakedText.trim()) return;

    setAnalyzing(true);
    setResult(null);

    try {
      const res = await fetch(`/api/rooms/${roomId}/verify-leak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporterId: currentUser.id,
          leakedText: leakedText.trim(),
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setResult(data);
      fetchPastReports(); // refresh history
    } catch (err: any) {
      console.error('Verification failed', err);
      setResult({
        reportId: '',
        attribution: null,
        message: err.message || 'Verification failed',
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const getConfidenceColor = (confidence: string) => {
    const val = parseFloat(confidence);
    if (val >= 95) return 'text-red-600';
    if (val >= 80) return 'text-orange-600';
    if (val >= 60) return 'text-yellow-600';
    return 'text-gray-500';
  };

  const getConfidenceBg = (confidence: string) => {
    const val = parseFloat(confidence);
    if (val >= 95) return 'from-red-500 to-red-600';
    if (val >= 80) return 'from-orange-500 to-orange-600';
    if (val >= 60) return 'from-yellow-500 to-yellow-600';
    return 'from-gray-400 to-gray-500';
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-red-500 via-red-600 to-red-700 p-6 pb-5 flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <AlertTriangle size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Leak Verification</h2>
              <p className="text-white/80 text-xs">{roomName}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 flex-shrink-0">
          <button
            onClick={() => setActiveTab('verify')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              activeTab === 'verify'
                ? 'text-red-600 border-b-2 border-red-500'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Search size={14} className="inline mr-1.5" />
            Verify Leak
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${
              activeTab === 'history'
                ? 'text-red-600 border-b-2 border-red-500'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText size={14} className="inline mr-1.5" />
            History
            {pastReports.length > 0 && (
              <span className="ml-1.5 bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {pastReports.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'verify' ? (
            <div className="p-5 space-y-4">
              {/* Input */}
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                  Paste Leaked Text
                </label>
                <textarea
                  value={leakedText}
                  onChange={(e) => setLeakedText(e.target.value)}
                  placeholder="Paste the leaked message text here... (from a screenshot OCR or copy-paste)"
                  rows={4}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 transition-all resize-none font-mono"
                />
              </div>

              <button
                onClick={handleVerify}
                disabled={!leakedText.trim() || analyzing}
                className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl py-3 font-semibold shadow-lg shadow-red-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {analyzing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Analyzing fingerprint layers...
                  </>
                ) : (
                  <>
                    <Search size={18} />
                    Verify & Attribute
                  </>
                )}
              </button>

              {/* Analysis Progress */}
              {analyzing && (
                <div className="space-y-2 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  {Object.entries(LAYER_LABELS).slice(0, 5).map(([key, layer], idx) => (
                    <div key={key} className="flex items-center gap-2" style={{ animationDelay: `${idx * 300}ms` }}>
                      <div className="w-5 h-5 flex items-center justify-center text-xs">{layer.icon}</div>
                      <span className="text-xs text-gray-600 flex-1">{layer.label}</span>
                      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-full animate-pulse"
                          style={{ width: '100%', animationDelay: `${idx * 200}ms` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Result */}
              {result && (
                <div className={`rounded-2xl overflow-hidden border ${
                  result.attribution
                    ? 'border-red-200 bg-gradient-to-br from-red-50 to-orange-50'
                    : 'border-gray-200 bg-gray-50'
                }`}>
                  {result.attribution ? (
                    <>
                      {/* Match Found Header */}
                      <div className="bg-gradient-to-r from-red-500 to-red-600 p-4 text-white">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle size={20} />
                          <span className="font-bold">Leak Source Identified</span>
                        </div>
                        <p className="text-red-100 text-xs">Forensic analysis complete</p>
                      </div>

                      <div className="p-4 space-y-4">
                        {/* Attributed User */}
                        <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-red-100 shadow-sm">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-red-500 to-orange-500 flex items-center justify-center text-white text-lg font-bold shadow-md">
                            {result.attribution.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-gray-800 text-lg">@{result.attribution.username}</p>
                            <p className="text-xs text-gray-500">Leak originated from this recipient</p>
                          </div>
                        </div>

                        {/* Confidence Meter */}
                        <div className="p-3 bg-white rounded-xl border border-red-100">
                          <div className="flex justify-between items-baseline mb-2">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Confidence</span>
                            <span className={`text-2xl font-black ${getConfidenceColor(result.attribution.confidence)}`}>
                              {result.attribution.confidence}
                            </span>
                          </div>
                          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${getConfidenceBg(result.attribution.confidence)} rounded-full transition-all duration-1000`}
                              style={{ width: result.attribution.confidence }}
                            />
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1.5">
                            {result.attribution.bitsMatched} of {result.attribution.bitsTotal} fingerprint bits matched
                          </p>
                        </div>

                        {/* Detected Layers */}
                        <div>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Detection Layers</p>
                          <div className="space-y-1.5">
                            {result.attribution.layersDetected.map(layer => {
                              const info = LAYER_LABELS[layer] || { label: layer, icon: '🔍', desc: '' };
                              return (
                                <div key={layer} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-green-100">
                                  <span className="text-sm">{info.icon}</span>
                                  <div className="flex-1">
                                    <span className="text-xs font-semibold text-gray-700">{info.label}</span>
                                    <p className="text-[10px] text-gray-400">{info.desc}</p>
                                  </div>
                                  <CheckCircle size={14} className="text-green-500" />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="p-6 text-center">
                      <XCircle size={40} className="mx-auto text-gray-400 mb-3" />
                      <p className="font-semibold text-gray-700">No Match Found</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {result.message || 'The leaked text could not be attributed with sufficient confidence. The text may have been heavily modified.'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* History Tab */
            <div className="p-4 space-y-3">
              {pastReports.length === 0 ? (
                <div className="text-center py-8">
                  <FileText size={32} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500">No leak reports yet</p>
                </div>
              ) : (
                pastReports.map(report => (
                  <div key={report.id} className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-gray-400 font-medium">
                        {new Date(report.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {report.matchedUser ? (
                        <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">
                          {report.confidence} match
                        </span>
                      ) : (
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">
                          No match
                        </span>
                      )}
                    </div>
                    
                    <p className="text-xs text-gray-600 line-clamp-2 mb-2 font-mono bg-gray-50 p-2 rounded-lg">
                      {report.leakedText}
                    </p>

                    {report.matchedUser && (
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-red-500 to-orange-500 flex items-center justify-center text-white text-[8px] font-bold">
                          {report.matchedUser.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-semibold text-gray-700">
                          Attributed to @{report.matchedUser.username}
                        </span>
                      </div>
                    )}

                    <p className="text-[10px] text-gray-400 mt-1">
                      Reported by @{report.reporter.username}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
