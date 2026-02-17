import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ThreadImage } from '../types';

interface ImageViewerProps {
  images: ThreadImage[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function ImageViewer({ images, currentIndex, onClose, onNavigate }: ImageViewerProps) {
  const current = images[currentIndex];
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for out-of-bounds index
  if (!current) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft' && currentIndex > 0) onNavigate(currentIndex - 1);
    if (e.key === 'ArrowRight' && currentIndex < images.length - 1) onNavigate(currentIndex + 1);
  };

  return (
    <div 
      className="image-viewer-overlay" 
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="dialog"
      aria-label="Image viewer"
    >
      <button className="image-viewer-close" onClick={onClose}>
        <X size={24} />
      </button>
      
      {images.length > 1 && currentIndex > 0 && (
        <button 
          className="image-viewer-nav prev"
          onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex - 1); }}
        >
          <ChevronLeft size={32} />
        </button>
      )}
      
      <div className="image-viewer-content" onClick={e => e.stopPropagation()}>
        <img 
          src={`data:${current.mediaType};base64,${current.data}`}
          alt={current.sourcePath || `Image ${currentIndex + 1}`}
        />
        {current.sourcePath && (
          <div className="image-viewer-caption">{current.sourcePath}</div>
        )}
      </div>
      
      {images.length > 1 && currentIndex < images.length - 1 && (
        <button 
          className="image-viewer-nav next"
          onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex + 1); }}
        >
          <ChevronRight size={32} />
        </button>
      )}
      
      {images.length > 1 && (
        <div className="image-viewer-counter">
          {currentIndex + 1} / {images.length}
        </div>
      )}
    </div>
  );
}
