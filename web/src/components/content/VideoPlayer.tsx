/**
 * Adaptive Video Player Component
 *
 * Comprehensive video player with adaptive streaming, access control,
 * offline capabilities, and analytics tracking.
 *
 * Features:
 * - HLS/DASH adaptive streaming support
 * - Content access control based on user permissions
 * - Progressive loading and caching
 * - Offline content access
 * - Usage analytics and tracking
 * - Responsive design and accessibility
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useStreamingUrl } from '@/hooks/useContent';
import { usePermissions } from '@/lib/auth/authHooks';
import { ContentAccessControl } from './ContentAccessControl';
import { ProgressiveLoader } from './ProgressiveLoader';
import { OfflineContentManager } from './OfflineContentManager';
import { ContentAnalytics } from './ContentAnalytics';

interface VideoPlayerProps {
  lessonId: string;
  courseId: string;
  title: string;
  duration?: number;
  thumbnail?: string;
  autoPlay?: boolean;
  controls?: boolean;
  muted?: boolean;
  className?: string;
  onProgress?: (progress: VideoProgress) => void;
  onComplete?: () => void;
  onError?: (error: VideoError) => void;
}

interface VideoProgress {
  currentTime: number;
  duration: number;
  percentage: number;
  buffered: TimeRanges;
}

interface VideoError {
  code: string;
  message: string;
  recoverable: boolean;
}

interface StreamingQuality {
  resolution: string;
  bitrate: number;
  label: string;
}

export function VideoPlayer({
  lessonId,
  courseId,
  title,
  duration,
  thumbnail,
  autoPlay = false,
  controls = true,
  muted = false,
  className = '',
  onProgress,
  onComplete,
  onError,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(duration || 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(muted);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState<string>('auto');
  const [availableQualities, setAvailableQualities] = useState<StreamingQuality[]>([]);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState<VideoError | null>(null);

  // Hooks for content access and streaming
  const { hasPermission } = usePermissions();
  const {
    data: streamingUrl,
    loading: urlLoading,
    error: urlError,
  } = useStreamingUrl(lessonId, selectedQuality === 'auto' ? undefined : selectedQuality);

  // Check content access permissions
  const hasContentAccess = hasPermission('course:view' as const);

  // Initialize video player
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamingUrl?.streamingUrl) return;

    // Set up video source
    video.src = streamingUrl.streamingUrl;

    // Configure video for adaptive streaming
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = streamingUrl.streamingUrl;
    } else {
      // Use HLS.js for other browsers
      let cleanup: (() => void) | undefined;
      
      import('hls.js').then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90,
          });

          hls.loadSource(streamingUrl.streamingUrl);
          hls.attachMedia(video);

          // Handle quality levels
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            const qualities: StreamingQuality[] = hls.levels.map((level: { height: number; bitrate: number }) => ({
              resolution: `${level.height}p`,
              bitrate: level.bitrate,
              label: `${level.height}p (${Math.round(level.bitrate / 1000)}k)`,
            }));
            setAvailableQualities(qualities);
          });

          // Handle errors
          hls.on(Hls.Events.ERROR, (_event: unknown, data: { fatal?: boolean; type?: string; details?: string; recoverable?: boolean }) => {
            if (data.fatal) {
              const videoError: VideoError = {
                code: data.type || 'UNKNOWN',
                message: data.details || 'Video playback error',
                recoverable: data.recoverable || false,
              };
              setError(videoError);
              onError?.(videoError);
            }
          });

          cleanup = () => hls.destroy();
        }
      }).catch(error => {
        console.error('Failed to load HLS.js:', error);
      });

      return cleanup;
    }

    return undefined;
  }, [streamingUrl, onError]);

  // Video event handlers
  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    ContentAnalytics.trackVideoEvent('play', {
      lessonId,
      courseId,
      currentTime,
      quality: selectedQuality,
    });
  }, [lessonId, courseId, currentTime, selectedQuality]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    ContentAnalytics.trackVideoEvent('pause', {
      lessonId,
      courseId,
      currentTime,
      quality: selectedQuality,
    });
  }, [lessonId, courseId, currentTime, selectedQuality]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const newCurrentTime = video.currentTime;
    const newDuration = video.duration || videoDuration;

    setCurrentTime(newCurrentTime);
    setVideoDuration(newDuration);

    const progress: VideoProgress = {
      currentTime: newCurrentTime,
      duration: newDuration,
      percentage: (newCurrentTime / newDuration) * 100,
      buffered: video.buffered,
    };

    onProgress?.(progress);

    // Track progress milestones
    const progressPercentage = progress.percentage;
    if (progressPercentage >= 25 && progressPercentage < 26) {
      ContentAnalytics.trackVideoEvent('progress_25', {
        lessonId,
        courseId,
        currentTime: newCurrentTime,
      });
    } else if (progressPercentage >= 50 && progressPercentage < 51) {
      ContentAnalytics.trackVideoEvent('progress_50', {
        lessonId,
        courseId,
        currentTime: newCurrentTime,
      });
    } else if (progressPercentage >= 75 && progressPercentage < 76) {
      ContentAnalytics.trackVideoEvent('progress_75', {
        lessonId,
        courseId,
        currentTime: newCurrentTime,
      });
    }
  }, [lessonId, courseId, videoDuration, onProgress]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    ContentAnalytics.trackVideoEvent('complete', {
      lessonId,
      courseId,
      currentTime: videoDuration,
      totalWatchTime: videoDuration,
    });
    onComplete?.();
  }, [lessonId, courseId, videoDuration, onComplete]);

  const handleLoadStart = useCallback(() => {
    setIsBuffering(true);
  }, []);

  const handleCanPlay = useCallback(() => {
    setIsBuffering(false);
  }, []);

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const video = e.currentTarget;
      const videoError: VideoError = {
        code: `ERROR_${video.error?.code || 'UNKNOWN'}`,
        message: video.error?.message || 'Video playback failed',
        recoverable: true,
      };
      setError(videoError);
      onError?.(videoError);
    },
    [onError]
  );

  // Playback controls
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  }, [isPlaying]);

  const seek = useCallback(
    (time: number) => {
      const video = videoRef.current;
      if (!video) return;

      video.currentTime = time;
      ContentAnalytics.trackVideoEvent('seek', {
        lessonId,
        courseId,
        fromTime: currentTime,
        toTime: time,
      });
    },
    [lessonId, courseId, currentTime]
  );

  const changeVolume = useCallback((newVolume: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const newMuted = !isMuted;
    video.muted = newMuted;
    setIsMuted(newMuted);
  }, [isMuted]);

  const toggleFullscreen = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!isFullscreen) {
      if (video.requestFullscreen) {
        video.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }, [isFullscreen]);

  const changeQuality = useCallback(
    (quality: string) => {
      setSelectedQuality(quality);
      ContentAnalytics.trackVideoEvent('quality_change', {
        lessonId,
        courseId,
        fromQuality: selectedQuality,
        toQuality: quality,
        currentTime,
      });
    },
    [lessonId, courseId, selectedQuality, currentTime]
  );

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Format time display
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Show access denied if no permission
  if (!hasContentAccess) {
    return (
      <ContentAccessControl
        courseId={courseId}
        lessonId={lessonId}
        title={title}
        thumbnail={thumbnail || ''}
      />
    );
  }

  // Show loading state
  if (urlLoading) {
    return <ProgressiveLoader title={title} thumbnail={thumbnail || ''} className={className} />;
  }

  // Show error state
  if (urlError || error) {
    return (
      <div className={`video-player-error ${className}`}>
        <div className='error-content'>
          <h3>Video Unavailable</h3>
          <p>{error?.message || urlError?.message || 'Failed to load video'}</p>
          {error?.recoverable && (
            <button onClick={() => window.location.reload()} className='retry-button'>
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`video-player ${className} ${isFullscreen ? 'fullscreen' : ''}`}>
      <div className='video-container'>
        <video
          ref={videoRef}
          className='video-element'
          poster={thumbnail}
          autoPlay={autoPlay}
          muted={muted}
          playsInline
          onPlay={handlePlay}
          onPause={handlePause}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onLoadStart={handleLoadStart}
          onCanPlay={handleCanPlay}
          onError={handleError}
        />

        {/* Loading overlay */}
        {isBuffering && (
          <div className='loading-overlay'>
            <div className='spinner' />
            <span>Loading...</span>
          </div>
        )}

        {/* Custom controls */}
        {controls && (
          <div className='video-controls'>
            <div className='progress-bar'>
              <input
                type='range'
                min={0}
                max={videoDuration}
                value={currentTime}
                onChange={e => seek(Number(e.target.value))}
                className='progress-slider'
              />
            </div>

            <div className='control-buttons'>
              <button onClick={togglePlay} className='play-pause-btn'>
                {isPlaying ? '⏸️' : '▶️'}
              </button>

              <div className='volume-control'>
                <button onClick={toggleMute} className='mute-btn'>
                  {isMuted ? '🔇' : '🔊'}
                </button>
                <input
                  type='range'
                  min={0}
                  max={1}
                  step={0.1}
                  value={isMuted ? 0 : volume}
                  onChange={e => changeVolume(Number(e.target.value))}
                  className='volume-slider'
                />
              </div>

              <div className='time-display'>
                {formatTime(currentTime)} / {formatTime(videoDuration)}
              </div>

              {/* Quality selector */}
              {availableQualities.length > 0 && (
                <select
                  value={selectedQuality}
                  onChange={e => changeQuality(e.target.value)}
                  className='quality-selector'
                >
                  <option value='auto'>Auto</option>
                  {availableQualities.map(quality => (
                    <option key={quality.resolution} value={quality.resolution}>
                      {quality.label}
                    </option>
                  ))}
                </select>
              )}

              <button onClick={toggleFullscreen} className='fullscreen-btn'>
                {isFullscreen ? '⛶' : '⛶'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Offline content manager */}
      <OfflineContentManager
        lessonId={lessonId}
        courseId={courseId}
        streamingUrl={streamingUrl?.streamingUrl || ''}
      />
    </div>
  );
}

export default VideoPlayer;
