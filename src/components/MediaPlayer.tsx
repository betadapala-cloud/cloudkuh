import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  ListMusic,
  Maximize,
  Minimize2,
  X,
  Music,
  Film,
  Download,
  Check,
  Copy,
  ExternalLink,
  RefreshCw,
  Sliders,
  RotateCcw,
  RotateCw,
} from 'lucide-react';
import { NasItem } from '../types';
import { api } from '../services/api';
import { formatBytes, getFileCategory } from '../utils/format';
import { MediaThumbnail } from './MediaThumbnail';

interface MediaPlayerProps {
  currentTrack: NasItem;
  playlist: NasItem[]; // List of all audio and video items in the current folder
  onSelectTrack: (track: NasItem) => void;
  onClose: () => void;
  isShuffle: boolean;
  onToggleShuffle: () => void;
  repeatMode: 'off' | 'all' | 'one';
  onCycleRepeatMode: () => void;
  onDownload: (item: NasItem) => void;
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

export const MediaPlayer: React.FC<MediaPlayerProps> = ({
  currentTrack,
  playlist,
  onSelectTrack,
  onClose,
  isShuffle,
  onToggleShuffle,
  repeatMode,
  onCycleRepeatMode,
  onDownload,
}) => {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showPlaylist, setShowPlaylist] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [isBuffering, setIsBuffering] = useState<boolean>(true);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [playedHistory, setPlayedHistory] = useState<string[]>([currentTrack.path]);

  // Video enhancements for large files
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [useNativeControls, setUseNativeControls] = useState<boolean>(false);
  const [isDraggingSeek, setIsDraggingSeek] = useState<boolean>(false);
  const [dragSeekVal, setDragSeekVal] = useState<number>(0);

  const category = getFileCategory(currentTrack.extension, false);
  const isVideo = category === 'video';
  const mediaUrl = api.getRawFileUrl(currentTrack.path);

  const currentIndex = playlist.findIndex((t) => t.path === currentTrack.path);

  // Play next track (respecting shuffle and loop settings)
  const handleNext = () => {
    if (playlist.length <= 1) return;

    if (repeatMode === 'one') {
      if (mediaRef.current) {
        mediaRef.current.currentTime = 0;
        mediaRef.current.play().catch(() => {});
      }
      return;
    }

    if (isShuffle) {
      const availableIndices = playlist
        .map((_, i) => i)
        .filter((i) => i !== currentIndex);
      const randIdx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
      const nextTrack = playlist[randIdx];
      setPlayedHistory((prev) => [...prev, nextTrack.path]);
      onSelectTrack(nextTrack);
    } else {
      if (currentIndex < playlist.length - 1) {
        const nextTrack = playlist[currentIndex + 1];
        setPlayedHistory((prev) => [...prev, nextTrack.path]);
        onSelectTrack(nextTrack);
      } else if (repeatMode === 'all') {
        const nextTrack = playlist[0];
        setPlayedHistory((prev) => [...prev, nextTrack.path]);
        onSelectTrack(nextTrack);
      }
    }
  };

  // Play previous track
  const handlePrev = () => {
    if (mediaRef.current && mediaRef.current.currentTime > 3) {
      mediaRef.current.currentTime = 0;
      return;
    }

    if (playedHistory.length > 1) {
      const historyCopy = [...playedHistory];
      historyCopy.pop(); // remove current
      const prevPath = historyCopy[historyCopy.length - 1];
      const prevTrack = playlist.find((t) => t.path === prevPath);
      if (prevTrack) {
        setPlayedHistory(historyCopy);
        onSelectTrack(prevTrack);
        return;
      }
    }

    if (currentIndex > 0) {
      onSelectTrack(playlist[currentIndex - 1]);
    } else if (repeatMode === 'all') {
      onSelectTrack(playlist[playlist.length - 1]);
    }
  };

  // Quick skip backwards/forwards (useful for long lecture/concert videos)
  const handleSkipTime = (deltaSeconds: number) => {
    if (!mediaRef.current) return;
    const target = Math.max(0, Math.min(duration || 999999, mediaRef.current.currentTime + deltaSeconds));
    mediaRef.current.currentTime = target;
    setCurrentTime(target);
  };

  // Cycle playback speed
  const handleCycleSpeed = () => {
    const speeds = [1, 1.25, 1.5, 2, 0.75];
    const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackRate(nextSpeed);
    if (mediaRef.current) {
      mediaRef.current.playbackRate = nextSpeed;
    }
  };

  // Auto-play next track when current ends
  const handleEnded = () => {
    handleNext();
  };

  // Handle Play/Pause
  const togglePlay = () => {
    if (!mediaRef.current) return;
    if (isPlaying) {
      mediaRef.current.pause();
      setIsPlaying(false);
    } else {
      const p = mediaRef.current.play();
      if (p !== undefined) {
        p.then(() => setIsPlaying(true))
          .catch(() => setIsPlaying(false));
      }
    }
  };

  // Sync state and automatically play on track change
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setVideoError(null);
    setIsBuffering(true);
    setIsPlaying(true);

    if (mediaRef.current) {
      mediaRef.current.currentTime = 0;
      mediaRef.current.load();
      const p = mediaRef.current.play();
      if (p !== undefined) {
        p.then(() => {
          setIsPlaying(true);
          setIsBuffering(false);
        }).catch(() => {
          // If browser restricts unmuted autoplay, retry with muted
          if (mediaRef.current) {
            mediaRef.current.muted = true;
            setIsMuted(true);
            mediaRef.current
              .play()
              .then(() => {
                setIsPlaying(true);
                setIsBuffering(false);
              })
              .catch(() => {
                setIsPlaying(false);
                setIsBuffering(false);
              });
          }
        });
      }
    }
  }, [currentTrack.path]);

  const handleRetry = () => {
    setVideoError(null);
    setIsBuffering(true);
    if (mediaRef.current) {
      mediaRef.current.load();
      const p = mediaRef.current.play();
      if (p !== undefined) {
        p.then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      }
    }
  };

  // Handle Seek slider change
  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setDragSeekVal(val);
    if (!isDraggingSeek) {
      setCurrentTime(val);
      if (mediaRef.current) {
        mediaRef.current.currentTime = val;
      }
    }
  };

  const handleSeekCommit = (val: number) => {
    setIsDraggingSeek(false);
    setCurrentTime(val);
    if (mediaRef.current) {
      mediaRef.current.currentTime = val;
    }
  };

  // Handle Volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    if (mediaRef.current) {
      mediaRef.current.volume = val;
      mediaRef.current.muted = val === 0;
    }
  };

  const toggleMute = () => {
    if (!mediaRef.current) return;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    mediaRef.current.muted = newMuted;
  };

  const handleFullscreen = () => {
    if (mediaRef.current && isVideo) {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else {
        mediaRef.current.requestFullscreen().catch(() => {});
      }
    }
  };

  const handleCopyPath = () => {
    navigator.clipboard.writeText(currentTrack.path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Keyboard navigation shortcuts (Space, Arrow keys, M, F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleSkipTime(-10);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleSkipTime(10);
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        toggleMute();
      } else if (e.code === 'KeyF' && isVideo) {
        e.preventDefault();
        handleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isVideo, duration, togglePlay, handleSkipTime]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh] sm:max-h-[92vh]"
      >
        {/* Top Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-800/80 flex items-center justify-between gap-3 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
              {isVideo ? <Film className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" /> : <Music className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-wider text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                  {isVideo ? 'Pemutar Video' : 'Pemutar Musik'}
                </span>
                {isShuffle && (
                  <span className="text-[9px] sm:text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Acak Aktif
                  </span>
                )}
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-white truncate max-w-[200px] sm:max-w-md mt-0.5" title={currentTrack.name}>
                {currentTrack.name}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={handleCopyPath}
              title="Salin Path Berkas"
              className="p-1.5 sm:p-2 rounded-xl border border-slate-700/80 hover:bg-slate-800 text-slate-300 transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>

            <button
              onClick={() => onDownload(currentTrack)}
              title="Unduh Berkas Video / Audio Langsung"
              className="p-1.5 sm:p-2 rounded-xl border border-slate-700/80 hover:bg-slate-800 text-slate-300 transition-colors"
            >
              <Download className="w-4 h-4 text-emerald-400" />
            </button>

            <a
              href={mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Buka Stream di Tab Baru (Pemutar Asli Browser)"
              className="p-1.5 sm:p-2 rounded-xl border border-slate-700/80 hover:bg-slate-800 text-slate-300 transition-colors"
            >
              <ExternalLink className="w-4 h-4 text-blue-400" />
            </a>

            <button
              onClick={() => setShowPlaylist(!showPlaylist)}
              title={showPlaylist ? 'Sembunyikan Antrean' : 'Tampilkan Antrean Folder'}
              className={`p-1.5 sm:p-2 rounded-xl border transition-colors flex items-center gap-1.5 text-xs font-medium ${
                showPlaylist
                  ? 'border-blue-500 bg-blue-600/20 text-blue-400'
                  : 'border-slate-700/80 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <ListMusic className="w-4 h-4" />
              <span className="hidden sm:inline font-mono">{playlist.length} Berkas</span>
            </button>

            <button
              onClick={onClose}
              title="Tutup Pemutar"
              className="p-1.5 sm:p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewport: Video or Audio Visualizer */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[260px] sm:min-h-[400px] max-h-[66vh] sm:max-h-[74vh]">
          {isVideo ? (
            <div
              className="relative w-full h-full flex items-center justify-center cursor-pointer group select-none"
              onClick={togglePlay}
              onDoubleClick={handleFullscreen}
            >
              <video
                ref={mediaRef as React.RefObject<HTMLVideoElement>}
                src={mediaUrl}
                autoPlay
                playsInline
                preload="auto"
                controls={useNativeControls}
                controlsList="nodownload"
                onWaiting={() => setIsBuffering(true)}
                onPlaying={() => {
                  setIsBuffering(false);
                  setIsPlaying(true);
                }}
                onCanPlay={() => {
                  setIsBuffering(false);
                  if (mediaRef.current && mediaRef.current.paused) {
                    mediaRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
                  }
                }}
                onLoadedData={() => {
                  setIsBuffering(false);
                  if (mediaRef.current && mediaRef.current.paused) {
                    mediaRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
                  }
                }}
                onTimeUpdate={() => {
                  if (mediaRef.current && !isDraggingSeek) {
                    setCurrentTime(mediaRef.current.currentTime);
                  }
                }}
                onLoadedMetadata={() => {
                  if (mediaRef.current) {
                    setDuration(mediaRef.current.duration);
                    if (mediaRef.current.paused) {
                      mediaRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
                    }
                  }
                  setIsBuffering(false);
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={handleEnded}
                onError={() => {
                  const mediaErr = (mediaRef.current as HTMLVideoElement)?.error;
                  if (mediaErr && mediaErr.code === 1) {
                    return; // Aborted by user seek or track change
                  }
                  setIsBuffering(false);
                  setVideoError('Format video atau berkas besar membutuhkan pemutar sistem atau unduhan langsung.');
                }}
                className="w-full h-full object-contain max-h-[66vh] sm:max-h-[74vh]"
              />

              {/* Big Center Play Button Overlay only when explicitly paused by user */}
              {!isPlaying && !isBuffering && !videoError && !useNativeControls && currentTime > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/35 backdrop-blur-[1px] pointer-events-none transition-opacity">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-600/90 group-hover:bg-blue-500 text-white flex items-center justify-center shadow-2xl transition-transform group-hover:scale-110">
                    <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-white ml-1" />
                  </div>
                </div>
              )}

              {/* Buffering Indicator */}
              {isBuffering && !videoError && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs pointer-events-none">
                  <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
                  <span className="text-xs text-white font-medium">Memuat stream video ({formatBytes(currentTrack.size)})...</span>
                </div>
              )}

              {/* Video Playback Error Fallback */}
              {videoError && (
                <div
                  className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/95 p-6 text-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Film className="w-10 h-10 text-purple-400 mb-3" />
                  <h4 className="text-sm font-semibold text-white mb-1">Video Berkas Besar</h4>
                  <p className="text-xs text-slate-400 max-w-md mb-5 leading-relaxed">
                    Berkas ini berukuran <strong className="text-slate-200 font-mono">{formatBytes(currentTrack.size)}</strong>. Anda dapat langsung mengunduhnya dengan kecepatan penuh atau membukanya di tab baru.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={() => onDownload(currentTrack)}
                      className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg transition-transform hover:scale-105"
                    >
                      <Download className="w-4 h-4" />
                      <span>Unduh Berkas ({formatBytes(currentTrack.size)})</span>
                    </button>
                    <a
                      href={mediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-700 shadow-md transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 text-blue-400" />
                      <span>Buka di Tab Baru</span>
                    </a>
                    <button
                      onClick={handleRetry}
                      className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Coba Muat Ulang</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-6">
              <audio
                ref={mediaRef as React.RefObject<HTMLAudioElement>}
                src={mediaUrl}
                autoPlay
                onTimeUpdate={() => {
                  if (mediaRef.current) setCurrentTime(mediaRef.current.currentTime);
                }}
                onLoadedMetadata={() => {
                  if (mediaRef.current) setDuration(mediaRef.current.duration);
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={handleEnded}
              />

              {/* Animated Audio Vinyl Disc */}
              <div className="relative">
                <div
                  className={`w-40 h-40 rounded-full border-4 border-slate-700 bg-gradient-to-tr from-slate-900 via-slate-800 to-slate-950 flex items-center justify-center shadow-2xl ${
                    isPlaying ? 'animate-[spin_6s_linear_infinite]' : ''
                  }`}
                >
                  <div className="w-20 h-20 rounded-full bg-blue-600/30 border border-blue-400/40 flex items-center justify-center">
                    <Music className="w-8 h-8 text-blue-300" />
                  </div>
                </div>
                {/* Center spindle */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-4 h-4 rounded-full bg-slate-900 border border-slate-600" />
                </div>
              </div>

              <div>
                <h4 className="text-lg font-bold text-white max-w-lg truncate">{currentTrack.name}</h4>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  {formatBytes(currentTrack.size)} · Folder {playlist.length} trek
                </p>
              </div>
            </div>
          )}

          {/* Floating Playlist Drawer Overlay */}
          {showPlaylist && (
            <div className="absolute inset-y-0 right-0 w-80 bg-slate-900/95 backdrop-blur-md border-l border-slate-800 z-30 flex flex-col shadow-2xl">
              <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-white">Daftar Putar Folder</h4>
                  <p className="text-[10px] text-slate-400">
                    {playlist.length} berkas multimedia tersedia
                  </p>
                </div>
                <button
                  onClick={onToggleShuffle}
                  title="Acak Urutan Putar"
                  className={`px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors ${
                    isShuffle
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  <span>{isShuffle ? 'Acak ON' : 'Acak OFF'}</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2 space-y-1">
                {playlist.map((track, idx) => {
                  const isCurrent = track.path === currentTrack.path;
                  const trCat = getFileCategory(track.extension, false);
                  return (
                    <button
                      key={track.path}
                      onClick={() => onSelectTrack(track)}
                      className={`w-full p-2 rounded-xl text-left flex items-center gap-2.5 transition-colors ${
                        isCurrent
                          ? 'bg-blue-600/30 border border-blue-500/40 text-white'
                          : 'hover:bg-slate-800/60 text-slate-300'
                      }`}
                    >
                      <span className="text-[10px] font-mono text-slate-400 w-4 text-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-slate-800 flex items-center justify-center">
                        {trCat === 'video' ? (
                          <Film className="w-4 h-4 text-purple-400" />
                        ) : (
                          <Music className="w-4 h-4 text-blue-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate" title={track.name}>
                          {track.name}
                        </p>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {formatBytes(track.size)}
                        </span>
                      </div>
                      {isCurrent && (
                        <div className="flex items-center gap-0.5 text-blue-400 shrink-0">
                          <span className="w-1 h-3 bg-blue-400 animate-pulse rounded-full" />
                          <span className="w-1 h-4 bg-blue-400 animate-pulse delay-75 rounded-full" />
                          <span className="w-1 h-2 bg-blue-400 animate-pulse delay-150 rounded-full" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Custom Media Player Controls Bar */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col gap-3 shrink-0">
          {/* Progress Seek Bar */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-slate-400 tabular-nums w-12 text-right">
              {formatTime(isDraggingSeek ? dragSeekVal : currentTime)}
            </span>
            <div className="relative flex-1 flex items-center">
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={isDraggingSeek ? dragSeekVal : currentTime}
                onMouseDown={() => {
                  setIsDraggingSeek(true);
                  setDragSeekVal(currentTime);
                }}
                onTouchStart={() => {
                  setIsDraggingSeek(true);
                  setDragSeekVal(currentTime);
                }}
                onChange={handleSeekChange}
                onMouseUp={() => handleSeekCommit(dragSeekVal)}
                onTouchEnd={() => handleSeekCommit(dragSeekVal)}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 focus:outline-none"
              />
            </div>
            <span className="text-[11px] font-mono text-slate-400 tabular-nums w-12 text-left">
              {formatTime(duration)}
            </span>
          </div>

          {/* Buttons Controls Row */}
          <div className="flex items-center justify-between gap-4">
            {/* Left Controls: Shuffle & Repeat */}
            <div className="flex items-center gap-2">
              {/* SHUFFLE TOGGLE BUTTON */}
              <button
                onClick={onToggleShuffle}
                title={isShuffle ? 'Matikan Acak (Shuffle Aktif)' : 'Acak Pemutaran dalam Folder (Shuffle)'}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                  isShuffle
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-sm shadow-emerald-500/20'
                    : 'bg-slate-800/80 border-slate-700/80 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Shuffle className={`w-4 h-4 ${isShuffle ? 'animate-pulse' : ''}`} />
                <span className="hidden sm:inline">{isShuffle ? 'Acak Aktif' : 'Acak'}</span>
              </button>

              {/* REPEAT BUTTON */}
              <button
                onClick={onCycleRepeatMode}
                title={
                  repeatMode === 'all'
                    ? 'Ulangi Seluruh Folder'
                    : repeatMode === 'one'
                    ? 'Ulangi Lagu/Video Ini'
                    : 'Ulangi Nonaktif'
                }
                className={`p-2 rounded-xl border text-xs transition-colors ${
                  repeatMode !== 'off'
                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-400'
                    : 'bg-slate-800/80 border-slate-700/80 text-slate-400 hover:text-white'
                }`}
              >
                {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
              </button>

              {/* SPEED SELECTOR BUTTON */}
              <button
                onClick={handleCycleSpeed}
                title={`Kecepatan Putar: ${playbackRate}x (Klik untuk mengubah)`}
                className="px-2 py-1 rounded-lg border border-slate-700/80 hover:bg-slate-800 text-slate-300 font-mono text-[11px] font-semibold transition-colors"
              >
                {playbackRate}x
              </button>
            </div>

            {/* Center Controls: Prev, -10s, Play/Pause, +10s, Next */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={handlePrev}
                title="Sebelumnya"
                className="p-2 rounded-full hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
              >
                <SkipBack className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              </button>

              <button
                onClick={() => handleSkipTime(-10)}
                title="Mundur 10 Detik"
                className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors relative"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="text-[8px] font-bold absolute -bottom-0.5 right-1 font-mono">10</span>
              </button>

              <button
                onClick={togglePlay}
                title={isPlaying ? 'Jeda' : 'Putar'}
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg hover:shadow-blue-500/30 transition-all hover:scale-105"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
              </button>

              <button
                onClick={() => handleSkipTime(10)}
                title="Maju 10 Detik"
                className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors relative"
              >
                <RotateCw className="w-4 h-4" />
                <span className="text-[8px] font-bold absolute -bottom-0.5 right-1 font-mono">10</span>
              </button>

              <button
                onClick={handleNext}
                title="Selanjutnya (Acak jika Shuffle aktif)"
                className="p-2 rounded-full hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
              >
                <SkipForward className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              </button>
            </div>

            {/* Right Controls: Native Controls, Volume & Fullscreen */}
            <div className="flex items-center gap-2 sm:gap-3">
              {isVideo && (
                <button
                  onClick={() => setUseNativeControls(!useNativeControls)}
                  title={useNativeControls ? 'Beralih ke Kontrol Kustom' : 'Beralih ke Kontrol Bawaan Browser'}
                  className={`p-2 rounded-xl border text-xs transition-colors ${
                    useNativeControls
                      ? 'border-blue-500 bg-blue-600/20 text-blue-400'
                      : 'border-slate-700/80 hover:bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Sliders className="w-4 h-4" />
                </button>
              )}
              <div className="hidden sm:flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-16 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              {isVideo && (
                <button
                  onClick={handleFullscreen}
                  title="Layar Penuh"
                  className="p-2 rounded-xl border border-slate-700/80 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <Maximize className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
