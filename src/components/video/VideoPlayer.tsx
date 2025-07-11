'use client';

import { useEffect, useRef, useState } from 'react';
import { LoadingSpinner } from '@/components/ui/loading';

interface VideoPlayerProps {
  videoId: string;
  currentTime?: number;
  onTimeUpdate?: (time: number) => void;
  className?: string;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export function VideoPlayer({ 
  videoId, 
  currentTime = 0, 
  onTimeUpdate, 
  className = '' 
}: VideoPlayerProps) {
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
              setIsReady(true);
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
  }, [videoId, onTimeUpdate]);

  // Seek to specific time and auto-play
  useEffect(() => {
    if (isReady && playerRef.current && currentTime > 0) {
      // Only seek if the time difference is significant (more than 2 seconds)
      const currentVideoTime = playerRef.current.getCurrentTime ? Math.floor(playerRef.current.getCurrentTime()) : 0;
      if (Math.abs(currentTime - currentVideoTime) > 2) {
        playerRef.current.seekTo(currentTime, true);
        // Auto-play the video after seeking
        setTimeout(() => {
          if (playerRef.current && playerRef.current.playVideo) {
            playerRef.current.playVideo();
          }
        }, 100); // Small delay to ensure seeking is complete
      }
    }
  }, [currentTime, isReady]);

  const seekTo = (time: number) => {
    if (isReady && playerRef.current) {
      playerRef.current.seekTo(time, true);
    }
  };

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
}

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