'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Eye, ZoomIn } from 'lucide-react';
import { ImageModal } from './ImageModal';

interface ImageContainerProps {
  images: string[];
  initialIndex?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showOverlay?: boolean;
  rounded?: boolean;
}

const sizeClasses = {
  sm: 'w-16 h-16', // 4rem x 4rem
  md: 'w-24 h-24', // 6rem x 6rem
  lg: 'w-32 h-32', // 8rem x 8rem
  xl: 'w-48 h-48'  // 12rem x 12rem
};

export function ImageContainer({
  images,
  initialIndex = 0,
  size = 'md',
  className = '',
  showOverlay = true,
  rounded = true
}: ImageContainerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const openModal = (index: number = initialIndex) => {
    setCurrentIndex(index);
    setIsModalOpen(true);
  };

  if (!images || images.length === 0) {
    return (
      <div className={`${sizeClasses[size]} bg-gray-100 flex items-center justify-center ${rounded ? 'rounded-lg' : ''} border-2 border-gray-200 ${className}`}>
        <span className="text-gray-400 text-xs">No Image</span>
      </div>
    );
  }

  const displayImage = images[initialIndex] || images[0];

  return (
    <>
      <div className={`relative group ${sizeClasses[size]} ${className}`}>
        <div className={`w-full h-full overflow-hidden ${rounded ? 'rounded-lg' : ''} border-2 border-gray-200 hover:border-blue-300 transition-all duration-200 cursor-pointer bg-gray-100`} onClick={() => openModal()}>
          <Image
            src={displayImage}
            alt={`Image ${initialIndex + 1} of ${images.length}`}
            width={200}
            height={200}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />

          {/* Overlay with zoom icon */}
          {showOverlay && (
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openModal();
                  }}
                  className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
                  title="View full size"
                >
                  <ZoomIn className="h-4 w-4 text-gray-700" />
                </button>
              </div>
            </div>
          )}

          {/* Multiple images indicator */}
          {images.length > 1 && (
            <div className="absolute top-1 right-1 px-2 py-1 bg-black bg-opacity-60 text-white text-xs rounded-full">
              {images.length}
            </div>
          )}
        </div>
      </div>

      {/* Image Modal */}
      <ImageModal
        images={images}
        currentIndex={currentIndex}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onIndexChange={setCurrentIndex}
      />
    </>
  );
}
