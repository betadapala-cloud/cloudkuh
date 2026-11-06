import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Volume2,
  VolumeX,
  Maximize2,
  X,
  Music,
  Film,
} from 'lucide-react';
import { NasItem } from '../types';
import { getFileCategory } from '../utils/format';
import { formatTime } from './MediaPlayer';

interface MiniPlayerBarProps {
  currentTrack: NasItem;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  isShuffle: boolean;
  onToggleShuffle: () => void;
  onExpand: () => void;
  onStop: () => void;
  currentTime?: number;
  duration?: number;
}

export const MiniPlayerBar: React.FC<MiniPlayerBarProps> = ({
  currentTrack,
  isPlaying,
  onTogglePlay,
  onNext,
  onPrev,
  isShuffle,
  onToggleShuffle,
  onExpand,
  onStop,
  currentTime = 0,
  duration = 0,
}) => {
  const category = getFileCategory(currentTrack.extension, false);
  const isVideo = category === 'video';

  return (
    <div className="fixed bottom-14 md:bottom-0 inset-x-0 z-40 bg-slate-900/95 border-t border-slate-800 backdrop-blur-md px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-4 shadow-2xl animate-in slide-in-from-bottom-2">
      {/* Left: Track Info */}
      <div
        onClick={onExpand}
        className="flex items-center gap-3 min-w-0 max-w-sm cursor-pointer group"
      >
        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-blue-400 group-hover:border-blue-500 transition-colors">
          {isVideo ? <Film className="w-5 h-5 text-purple-400" /> : <Music className="w-5 h-5 text-blue-400" />}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold text-white truncate group-hover:text-blue-400 transition-colors" title={currentTrack.name}>
              {currentTrack.name}
            </h4>
            {isShuffle && (
              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 shrink-0">
                SHUFFLE
              </span>
            )}
          </div>
          <p className="text-[10px] font-mono text-slate-400">
            {formatTime(currentTime)} / {formatTime(duration)}
          </p>
        </div>
      </div>

      {/* Center: Playback Controls */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Shuffle Button */}
        <button
          onClick={onToggleShuffle}
          title={isShuffle ? 'Matikan Acak' : 'Acak Pemutaran dalam Folder (Shuffle)'}
          className={`p-2 rounded-xl transition-colors ${
            isShuffle
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Shuffle className="w-4 h-4" />
        </button>

        {/* Previous */}
        <button
          onClick={onPrev}
          title="Sebelumnya"
          className="p-2 rounded-full text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <SkipBack className="w-4 h-4 fill-current" />
        </button>

        {/* Play/Pause */}
        <button
          onClick={onTogglePlay}
          title={isPlaying ? 'Jeda' : 'Putar'}
          className="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-md transition-transform hover:scale-105"
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
        </button>

        {/* Next */}
        <button
          onClick={onNext}
          title="Selanjutnya (Acak jika Shuffle aktif)"
          className="p-2 rounded-full text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <SkipForward className="w-4 h-4 fill-current" />
        </button>
      </div>

      {/* Right: Expand & Close */}
      <div className="flex items-center gap-2">
        <button
          onClick={onExpand}
          title="Buka Pemutar Penuh"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Perbesar</span>
        </button>

        <button
          onClick={onStop}
          title="Hentikan & Tutup"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
