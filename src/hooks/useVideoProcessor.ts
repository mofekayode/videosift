'use client';

import { useState } from 'react';
import { extractVideoId } from '@/lib/youtube';

interface VideoMetadata {
  id: string;
  youtube_id: string;
  title: string;
  duration: number;
  thumbnail_url: string;
}

interface ProcessingState {
  isProcessing: boolean;
  currentStep: string;
  progress: number;
  error: string | null;
  videoData: VideoMetadata | null;
}

export function useVideoProcessor() {
  const [state, setState] = useState<ProcessingState>({
    isProcessing: false,
    currentStep: '',
    progress: 0,
    error: null,
    videoData: null,
  });

  const processVideoUrl = async (url: string) => {
    setState(prev => ({
      ...prev,
      isProcessing: true,
      currentStep: 'Validating URL...',
      progress: 10,
      error: null,
    }));

    try {
      // Extract video ID
      const videoId = extractVideoId(url);
      if (!videoId) {
        throw new Error('Invalid YouTube URL');
      }

      setState(prev => ({
        ...prev,
        currentStep: 'Fetching video metadata...',
        progress: 30,
      }));

      // Fetch metadata
      const response = await fetch('/api/video/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch video metadata');
      }

      const { data } = await response.json();

      setState(prev => ({
        ...prev,
        currentStep: 'Checking transcript availability...',
        progress: 60,
      }));

      // Check if transcript is cached
      if (!data.video.transcript_cached) {
        setState(prev => ({
          ...prev,
          currentStep: 'Downloading transcript...',
          progress: 80,
        }));

        // TODO: Implement transcript download
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate
      }

      setState(prev => ({
        ...prev,
        currentStep: 'Ready to chat!',
        progress: 100,
        isProcessing: false,
        videoData: data.video,
      }));

      return data.video;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: error instanceof Error ? error.message : 'An error occurred',
        progress: 0,
      }));
      return null;
    }
  };

  const reset = () => {
    setState({
      isProcessing: false,
      currentStep: '',
      progress: 0,
      error: null,
      videoData: null,
    });
  };

  return {
    ...state,
    processVideoUrl,
    reset,
  };
}