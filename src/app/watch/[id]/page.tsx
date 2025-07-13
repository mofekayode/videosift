'use client';

import { useEffect, useState, useRef } from 'react';
import { useBanner } from '@/contexts/BannerContext';
import { useParams, useSearchParams } from 'next/navigation';
import { VideoPlayer } from '@/components/video/VideoPlayer';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingCard, ProcessingSteps } from '@/components/ui/loading';
import { ErrorCard, handleApiError } from '@/components/ui/error';
import { ArrowLeft, ExternalLink, X } from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';

interface VideoData {
  id: string;
  youtube_id: string;
  title: string;
  duration: number;
  thumbnail_url: string;
  transcript_cached: boolean;
}

export default function WatchPage() {
  const { isSignedIn } = useUser();
  const params = useParams();
  const searchParams = useSearchParams();
  const videoId = params.id as string;
  const initialQuestion = searchParams.get('q');
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const loadVideoCalledRef = useRef(false);
  
  // Debug logging
  useEffect(() => {
    console.log('Watch page loaded with initialQuestion:', initialQuestion);
  }, [initialQuestion]);
  
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [citationTimestamps, setCitationTimestamps] = useState<string[]>([]);
  const [selectedTimestamp, setSelectedTimestamp] = useState<string | null>(null);
  const { bannerVisible, setBannerVisible, showBanner } = useBanner();
  const [processingSteps, setProcessingSteps] = useState<{
    label: string;
    status: 'pending' | 'active' | 'completed' | 'error';
    description: string;
  }[]>([
    { label: 'Loading video metadata', status: 'pending', description: 'Fetching video information from YouTube' },
    { label: 'Downloading transcript', status: 'pending', description: 'Getting video captions and preparing for chat' },
    { label: 'Processing content', status: 'pending', description: 'Creating searchable chunks and embeddings' },
  ]);

  useEffect(() => {
    if (videoId && !loadVideoCalledRef.current) {
      loadVideoCalledRef.current = true;
      loadVideo();
    }
  }, [videoId]);

  const updateProcessingStep = (stepIndex: number, status: 'pending' | 'active' | 'completed' | 'error') => {
    setProcessingSteps(prev => prev.map((step, index) => 
      index === stepIndex ? { ...step, status } : step
    ));
  };

  const loadVideo = async () => {
    // Prevent duplicate calls
    if (isLoadingVideo) {
      console.log('Already loading video, skipping duplicate call');
      return;
    }
    
    try {
      setIsLoadingVideo(true);
      setIsProcessing(true);
      setError(null);
      
      // Reset all steps to pending
      setProcessingSteps(prev => prev.map(step => ({ ...step, status: 'pending' as const })));
      
      // Step 1: Load video metadata
      updateProcessingStep(0, 'active');
      setProcessingStep('Loading video metadata...');
      
      const metadataResponse = await fetch('/api/video/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoId}` }),
      });

      if (!metadataResponse.ok) {
        updateProcessingStep(0, 'error');
        throw new Error('Failed to load video metadata');
      }

      const { data } = await metadataResponse.json();
      setVideoData(data.video);
      updateProcessingStep(0, 'completed');

      // Step 2: Process transcript
      updateProcessingStep(1, 'active');
      setProcessingStep('Processing transcript...');
      
      const transcriptResponse = await fetch('/api/video/transcript-quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: data.video.youtube_id }),
      });

      if (!transcriptResponse.ok) {
        const errorData = await transcriptResponse.json().catch(() => ({}));
        // Only treat 409 (already processing) as non-error
        if (transcriptResponse.status === 409) {
          console.log('Video already being processed, continuing...');
          updateProcessingStep(1, 'completed');
        } else {
          updateProcessingStep(1, 'error');
          throw new Error(errorData.error || 'Failed to process transcript');
        }
      } else {
        const transcriptData = await transcriptResponse.json();
        console.log('Transcript response:', transcriptData);
        updateProcessingStep(1, 'completed');
      }

      
      // Step 3: Process content
      updateProcessingStep(2, 'active');
      setProcessingStep('Processing content for search...');
      
      // Simulate processing time for better UX
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      updateProcessingStep(2, 'completed');
      
      // Update video data to reflect cached transcript
      setVideoData(prev => prev ? { ...prev, transcript_cached: true } : null);

    } catch (error) {
      console.error('Video loading error:', error);
      setError(handleApiError(error));
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
      setIsLoadingVideo(false);
    }
  };

  const handleCitationClick = (timestamp: string) => {
    // Parse timestamp and seek to that time
    const parts = timestamp.split(':').map(Number);
    let seconds = 0;
    
    if (parts.length === 2) {
      seconds = parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    
    setCurrentTime(seconds);
    setSelectedTimestamp(timestamp);
  };

  const handleTimestampClick = (timestamp: string) => {
    // If it's a range like "12:34 - 15:67", extract the first timestamp
    const firstTimestamp = timestamp.includes(' - ') ? timestamp.split(' - ')[0] : timestamp;
    handleCitationClick(firstTimestamp);
  };

  const parseTimestampToSeconds = (timestamp: string): number => {
    const parts = timestamp.split(':').map(Number);
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <ErrorCard
          title="Failed to Load Video"
          message={error}
          onRetry={loadVideo}
        />
      </div>
    );
  }

  if (isProcessing || !videoData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Processing Video</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <ProcessingSteps steps={processingSteps} />
            {processingStep && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">{processingStep}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      {/* Top Banner - Fade in after 2 seconds */}
      {bannerVisible && (
        <div className={`fixed top-0 left-0 right-0 w-full bg-background/80 backdrop-blur-sm border-b px-4 py-2 z-[10000] transition-opacity duration-500 ${
          showBanner ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}>
          <div className="flex items-center justify-between max-w-6xl mx-auto">
            <div className="flex-1" />
            <p className="text-sm font-semibold text-purple-600" style={{ letterSpacing: '0.25px' }}>
              Multi-channel search coming soon
            </p>
            <div className="flex-1 flex items-center justify-end">
              <button
                onClick={() => setBannerVisible(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className={`h-screen flex flex-col transition-all duration-300 ${
        bannerVisible && showBanner ? 'pt-14' : 'pt-2'
      }`}>{/* Dynamic padding based on banner visibility */}
      
      {/* Header */}
      <header className="border-b p-2 sm:p-4 flex items-center ml-8 sm:ml-12">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">
            <ArrowLeft className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Back</span>
          </Link>
        </Button>
        <div className="min-w-0 flex-1 ml-2 sm:ml-4">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-semibold text-sm sm:text-lg line-clamp-1">{videoData.title}</h1>
            <Button variant="ghost" size="sm" asChild className="flex-shrink-0 h-6 px-2">
              <a 
                href={`https://www.youtube.com/watch?v=${videoData.youtube_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="w-3 h-3" />
                <span className="text-xs">YouTube</span>
              </a>
            </Button>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Duration: {formatDuration(videoData.duration)}
          </p>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Mobile/Tablet: Stacked vertically, Desktop: Side by side */}
        <div className="flex flex-col lg:flex-row w-full">
          {/* Video Player */}
          <div className="w-full lg:w-1/2 flex flex-col">
            {/* Mobile: Fixed aspect ratio container */}
            <div className="p-2 sm:p-4 border-b lg:border-b-0 lg:border-r">
              <VideoPlayer 
                videoId={videoData.youtube_id}
                currentTime={currentTime}
                onTimeUpdate={setCurrentTime}
                className="w-full"
              />
            </div>
            
            {/* Thumbnail Carousel - Only show when there are citations */}
            {citationTimestamps.length > 0 && (
              <div className="p-2 sm:p-4 border-b lg:border-r">
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {citationTimestamps.map((timestamp) => (
                    <div
                      key={timestamp}
                      className={`flex-shrink-0 ${timestamp.includes(' - ') ? 'w-32' : 'w-20'} h-12 bg-muted rounded cursor-pointer border-2 ${
                        selectedTimestamp === timestamp ? 'border-purple-500' : 'border-transparent'
                      } hover:border-purple-300 transition-colors`}
                      onClick={() => handleTimestampClick(timestamp)}
                    >
                      <div className="w-full h-full rounded bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center">
                        <span className={`${timestamp.includes(' - ') ? 'text-[10px]' : 'text-xs'} text-muted-foreground text-center px-1`}>{timestamp}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Channel Search Login Message */}
            {!isSignedIn && (
              <div className="p-2 sm:p-4 bg-muted/50 border-b lg:border-r">
                <p className="text-xs sm:text-sm text-muted-foreground text-center">
                  Login to search across all videos in this channel
                </p>
              </div>
            )}
          </div>

          {/* Chat Interface */}
          <div className="w-full lg:w-1/2 flex flex-col min-h-0 flex-1">
            {/* Mobile: Take remaining height, Desktop: Full height */}
            <div className="flex-1 min-h-0 lg:h-full">
              <ChatInterface
                videoId={videoData.youtube_id}
                onCitationClick={handleCitationClick}
                className="h-full"
                initialQuestion={initialQuestion || undefined}
                onCitationsUpdate={setCitationTimestamps}
              />
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}