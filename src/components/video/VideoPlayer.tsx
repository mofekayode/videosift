'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { LoadingSpinner } from '@/components/ui/loading';

interface VideoPlayerProps {
  videoId: string;
  onTimeUpdate?: (time: number) => void;
  onReady?: () => void;
  className?: string;
}

export interface VideoPlayerRef {
  seekTo: (time: number) => void;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(({ 
  videoId, 
  onTimeUpdate,
  onReady, 
  className = ''
}, ref) => {
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  

  useEffect(() => {
    // Load YouTube IFrame API
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    // Set up the API ready callback
    window.onYouTubeIframeAPIReady = () => {
      if (containerRef.current) {
        playerRef.current = new window.YT.Player(containerRef.current, {
          videoId: videoId,
          playerVars: {
            autoplay: 0,
            controls: 1,
            disablekb: 0,
            enablejsapi: 1,
            fs: 1,
            iv_load_policy: 3,
            modestbranding: 1,
            origin: window.location.origin,
            rel: 0,
            showinfo: 0,
          },
          events: {
            onReady: () => {
              console.log('YouTube player ready');
              setIsReady(true);
              onReady?.();
            },
            onStateChange: (event: any) => {
              // Handle state changes for time tracking
              if (onTimeUpdate) {
                if (event.data === window.YT.PlayerState.PLAYING) {
                  // Clear any existing interval
                  if (timeUpdateIntervalRef.current) {
                    clearInterval(timeUpdateIntervalRef.current);
                  }
                  
                  // Start time tracking
                  timeUpdateIntervalRef.current = setInterval(() => {
                    if (playerRef.current && playerRef.current.getCurrentTime) {
                      const time = Math.floor(playerRef.current.getCurrentTime());
                      onTimeUpdate(time);
                    }
                  }, 1000);
                } else {
                  // Clear interval when video pauses/ends
                  if (timeUpdateIntervalRef.current) {
                    clearInterval(timeUpdateIntervalRef.current);
                    timeUpdateIntervalRef.current = null;
                  }
                }
              }
            },
          },
        });
      }
    };

    // If YT is already loaded, initialize immediately
    if (window.YT && window.YT.Player) {
      window.onYouTubeIframeAPIReady();
    }

    return () => {
      // Clean up interval
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
        timeUpdateIntervalRef.current = null;
      }
      
      // Clean up player
      if (playerRef.current && playerRef.current.destroy) {
        playerRef.current.destroy();
      }
    };
  }, [videoId, onTimeUpdate, onReady]);

  const seekTo = (time: number) => {
    console.log('seekTo called with time:', time);
    if (playerRef.current && playerRef.current.seekTo) {
      console.log('Seeking to:', time);
      playerRef.current.seekTo(time, true);
      
      // Auto-play after seeking
      if (playerRef.current.playVideo) {
        playerRef.current.playVideo();
      }
    } else {
      console.warn('Cannot seek: player not ready');
    }
  };
  
  // Expose seekTo method to parent component
  useImperativeHandle(ref, () => ({
    seekTo
  }), []);

  const play = () => {
    if (isReady && playerRef.current) {
      playerRef.current.playVideo();
    }
  };

  const pause = () => {
    if (isReady && playerRef.current) {
      playerRef.current.pauseVideo();
    }
  };

  return (
    <div className={`relative w-full ${className}`}>
      <div 
        ref={containerRef}
        className="w-full aspect-video"
        style={{ minHeight: '200px' }}
      />
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <div className="flex flex-col items-center space-y-3">
            <LoadingSpinner size="lg" />
            <div className="text-sm sm:text-base text-muted-foreground">Loading video...</div>
          </div>
        </div>
      )}
    </div>
  );
});

VideoPlayer.displayName = 'VideoPlayer';

// Export utilities for external control
export const useVideoPlayer = () => {
  const playerRef = useRef<{
    seekTo: (time: number) => void;
    play: () => void;
    pause: () => void;
  } | null>(null);

  return {
    playerRef,
    seekTo: (time: number) => playerRef.current?.seekTo(time),
    play: () => playerRef.current?.play(),
    pause: () => playerRef.current?.pause(),
  };
};