import React, { useState } from 'react';
import { Play, Image as ImageIcon, Film } from 'lucide-react';
import { api } from '../services/api';
import { FileIcon } from './FileIcon';

interface MediaThumbnailProps {
  filePath: string;
  category: 'image' | 'video' | 'audio' | 'folder' | 'document' | 'archive' | 'code' | 'other';
  extension: string;
  isDir: boolean;
  className?: string;
  mode?: 'card' | 'row' | 'preview';
}

export const MediaThumbnail: React.FC<MediaThumbnailProps> = ({
  filePath,
  category,
  extension,
  isDir,
  className = '',
  mode = 'card',
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // If item is an image: load lightweight low-resolution thumbnail
  if (category === 'image') {
    // Explicitly use 'thumb' (low resolution) so file cards & rows open ultra-fast with minimal memory
    const thumbUrl = api.getThumbnailUrl(filePath, 'thumb');

    if (imageError) {
      return (
        <div className={`flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-lg ${className}`}>
          <FileIcon extension={extension} isDir={isDir} className="w-8 h-8" />
        </div>
      );
    }

    return (
      <div className={`relative overflow-hidden bg-slate-100 dark:bg-slate-900 rounded-lg flex items-center justify-center ${className}`}>
        {/* Placeholder skeleton while loading */}
        {!imageLoaded && (
          <div className="absolute inset-0 bg-slate-200 dark:bg-slate-800 animate-pulse flex items-center justify-center">
            <ImageIcon className="w-6 h-6 text-slate-400" />
          </div>
        )}
        <img
          src={thumbUrl}
          alt={filePath}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
          className={`w-full h-full object-cover transition-opacity duration-200 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>
    );
  }

  // If item is a video: Fast, instantaneous static badge without heavy network frame extraction
  // This allows video playback to open and play immediately without buffering thumbnails
  if (category === 'video') {
    if (mode === 'row') {
      return (
        <div className={`flex items-center justify-center bg-purple-500/10 dark:bg-purple-950/40 border border-purple-500/20 rounded-md ${className}`}>
          <Film className="w-4 h-4 text-purple-400" />
        </div>
      );
    }

    return (
      <div className={`relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-950/30 to-slate-950 border border-purple-500/20 rounded-lg flex flex-col items-center justify-center group/video ${className}`}>
        <div className="w-10 h-10 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center mb-1 group-hover/video:scale-110 group-hover/video:bg-purple-500/30 transition-all shadow-md">
          <Play className="w-5 h-5 fill-purple-300 ml-0.5" />
        </div>
        <span className="text-[10px] font-mono tracking-wider font-semibold text-purple-300 uppercase">
          {extension?.replace('.', '') || 'VIDEO'}
        </span>
      </div>
    );
  }

  // Generic fallback to FileIcon
  return (
    <div className={`flex items-center justify-center bg-slate-50 dark:bg-slate-900/60 rounded-lg ${className}`}>
      <FileIcon extension={extension} isDir={isDir} className="w-8 h-8" />
    </div>
  );
};
