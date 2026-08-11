import React, { useState, useRef, useEffect } from 'react';
import { X, Check, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

interface ImageCropperModalProps {
  imageSrc: string;
  onCrop: (croppedDataUrl: string) => void;
  onClose: () => void;
}

export default function ImageCropperModal({ imageSrc, onCrop, onClose }: ImageCropperModalProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    img.onload = () => {
      imageRef.current = img;
      drawCanvas();
    };
  }, [imageSrc]);

  useEffect(() => {
    drawCanvas();
  }, [zoom, rotation, pan]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 300;
    canvas.width = size;
    canvas.height = size;

    ctx.clearRect(0, 0, size, size);

    // Save context state
    ctx.save();

    // Translate to center of canvas
    ctx.translate(size / 2 + pan.x, size / 2 + pan.y);

    // Rotate
    ctx.rotate((rotation * Math.PI) / 180);

    // Scale
    ctx.scale(zoom, zoom);

    // Draw image centered
    const aspect = img.width / img.height;
    let drawW = size;
    let drawH = size;
    if (aspect > 1) {
      drawH = size / aspect;
    } else {
      drawW = size * aspect;
    }

    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);

    // Restore context
    ctx.restore();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleConfirmCrop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const croppedUrl = canvas.toDataURL('image/jpeg', 0.9);
    onCrop(croppedUrl);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/40 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 px-6 border-b border-gray-200/60 flex items-center justify-between">
          <h3 className="font-bold text-gray-800 text-lg">Crop Profile Picture</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Crop Viewport Area */}
        <div className="p-6 flex flex-col items-center justify-center bg-gray-900/90 relative">
          <div
            className="w-[260px] h-[260px] rounded-full overflow-hidden border-4 border-amber-400/80 shadow-2xl relative cursor-grab active:cursor-grabbing select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <canvas ref={canvasRef} className="w-full h-full object-cover" />
          </div>
          <p className="text-[11px] text-gray-400 mt-3 font-medium">Drag to pan image inside circle</p>
        </div>

        {/* Controls */}
        <div className="p-6 space-y-4 bg-white">
          {/* Zoom slider */}
          <div className="flex items-center gap-3">
            <ZoomOut size={16} className="text-gray-400" />
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 accent-amber-500 cursor-pointer h-1.5 bg-gray-200 rounded-lg"
            />
            <ZoomIn size={16} className="text-gray-400" />

            <button
              onClick={() => setRotation((prev) => (prev + 90) % 360)}
              className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors ml-2"
              title="Rotate 90 deg"
            >
              <RotateCw size={16} />
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmCrop}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2 text-sm"
            >
              <Check size={16} /> Apply Crop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
