'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { X, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface ImageModalProps {
  images: string[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

export function ImageModal({ images, currentIndex, isOpen, onClose, onIndexChange }: ImageModalProps) {
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLDivElement>(null);

  // Reset zoom and position when image changes
  useEffect(() => {
    setZoom(1);
    setImagePosition({ x: 0, y: 0 });
    setLoading(true);
  }, [currentIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (currentIndex > 0) {
            onIndexChange(currentIndex - 1);
          }
          break;
        case 'ArrowRight':
          if (currentIndex < images.length - 1) {
            onIndexChange(currentIndex + 1);
          }
          break;
        case '+':
        case '=':
          e.preventDefault();
          handleZoomIn();
          break;
        case '-':
          e.preventDefault();
          handleZoomOut();
          break;
        case '0':
          e.preventDefault();
          handleResetZoom();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, images.length, onClose, onIndexChange]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 5));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.1));
  };

  const handleResetZoom = () => {
    setZoom(1);
    setImagePosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - imagePosition.x,
        y: e.clientY - imagePosition.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setImagePosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = images[currentIndex];
    link.download = `voucher-image-${currentIndex + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen || images.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-95">
      {/* Top Controls Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-black bg-opacity-50 p-4">
        <div className="flex items-center justify-between">
          {/* Left side - Image counter */}
          {images.length > 1 && (
            <div className="px-3 py-1 bg-black bg-opacity-50 text-white rounded-full text-sm">
              {currentIndex + 1} / {images.length}
            </div>
          )}

          {/* Center - Zoom controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleZoomOut}
              className="p-2 text-white hover:text-gray-300 transition-colors bg-black bg-opacity-50 rounded-full"
              title="Zoom Out (-)"
            >
              <ZoomOut className="h-5 w-5" />
            </button>

            <span className="text-white text-sm px-3 py-1 bg-black bg-opacity-50 rounded-full min-w-[80px] text-center">
              {Math.round(zoom * 100)}%
            </span>

            <button
              onClick={handleZoomIn}
              className="p-2 text-white hover:text-gray-300 transition-colors bg-black bg-opacity-50 rounded-full"
              title="Zoom In (+)"
            >
              <ZoomIn className="h-5 w-5" />
            </button>

            <button
              onClick={handleResetZoom}
              className="p-2 text-white hover:text-gray-300 transition-colors bg-black bg-opacity-50 rounded-full"
              title="Reset Zoom (0)"
            >
              <RotateCcw className="h-5 w-5" />
            </button>
          </div>

          {/* Right side - Download and Close */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownload}
              className="p-2 text-white hover:text-gray-300 transition-colors bg-black bg-opacity-50 rounded-full"
              title="Download Image"
            >
              <Download className="h-5 w-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-white hover:text-gray-300 transition-colors bg-black bg-opacity-50 rounded-full"
              title="Close (Esc)"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation buttons */}
      {images.length > 1 && (
        <>
          <button
            onClick={() => currentIndex > 0 && onIndexChange(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 p-3 text-white hover:text-gray-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-black bg-opacity-50 rounded-full"
            title="Previous Image (←)"
          >
            <ChevronLeft className="h-8 w-8" />
          </button>

          <button
            onClick={() => currentIndex < images.length - 1 && onIndexChange(currentIndex + 1)}
            disabled={currentIndex === images.length - 1}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 p-3 text-white hover:text-gray-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed bg-black bg-opacity-50 rounded-full"
            title="Next Image (→)"
          >
            <ChevronRight className="h-8 w-8" />
          </button>
        </>
      )}

      {/* Main image container */}
      <div
        className="relative w-full h-full flex items-center justify-center overflow-hidden"
        onWheel={handleWheel}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          ref={imageRef}
          className={`relative transition-transform duration-200 ${
            zoom > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
          }`}
          style={{
            transform: `translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${zoom})`,
            transformOrigin: 'center center'
          }}
          onMouseDown={handleMouseDown}
        >
          <Image
            src={images[currentIndex]}
            alt={`Voucher image ${currentIndex + 1}`}
            width={1200}
            height={800}
            className="max-w-[90vw] max-h-[90vh] object-contain select-none"
            onLoad={() => setLoading(false)}
            onLoadStart={() => setLoading(true)}
            draggable={false}
            priority
          />
        </div>

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        )}
      </div>

      {/* Bottom help text */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 px-4 py-2 bg-black bg-opacity-50 text-white rounded-lg text-sm">
        <div className="text-center">
          <div className="mb-1">Use mouse wheel or +/- keys to zoom • Drag to pan when zoomed</div>
          <div>← → arrow keys to navigate • ESC to close • 0 to reset zoom</div>
        </div>
      </div>

      {/* Click outside to close (only when not zoomed or dragging) */}
      <div
        className="absolute inset-0 -z-10"
        onClick={(e) => {
          if (zoom === 1 && !isDragging) {
            onClose();
          }
        }}
      />
    </div>
  );
}
