'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { VideoPlayer, VideoPlayerRef } from '@/components/video/VideoPlayer';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingCard, ProcessingSteps } from '@/components/ui/loading';
import { ErrorCard, handleApiError } from '@/components/ui/error';
import { ArrowLeft, ExternalLink, MessageSquare } from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { RecentChatsSheet } from '@/components/chat/RecentChatsSheet';
import { toast } from 'sonner';

interface VideoData {
  id: string;
  youtube_id: string;
  title: string;
  duration: number;
  thumbnail_url: string;
  transcript_cached: boolean;
}

function WatchPageContent() {
  const { isSignedIn } = useUser();
  const params = useParams();
  const searchParams = useSearchParams();
  const videoId = params.id as string;
  const initialQuestion = searchParams.get('q');
  const sessionId = searchParams.get('session');
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const loadVideoCalledRef = useRef(false);
  const [activeTab, setActiveTab] = useState<'video' | 'chat'>(
    typeof window !== 'undefined' && window.innerWidth < 1024 ? 'chat' : 'video'
  );
  
  // Set default tab based on screen size
  useEffect(() => {
    const handleResize = () => {
      // Only change tab on initial mobile detection, not on every resize
      if (window.innerWidth < 1024 && activeTab === 'video' && !videoData) {
        setActiveTab('chat');
      }
    };

    // Set initial tab on mount
    if (window.innerWidth < 1024) {
      setActiveTab('chat');
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Debug logging
  useEffect(() => {
    console.log('Watch page loaded with initialQuestion:', initialQuestion);
  }, [initialQuestion]);
  
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const videoPlayerRef = useRef<VideoPlayerRef>(null);
  const [citationTimestamps, setCitationTimestamps] = useState<string[]>([]);
  const [selectedTimestamp, setSelectedTimestamp] = useState<string | null>(null);
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
    
    const performanceStart = performance.now();
    const timings: Record<string, number> = {};
    
    try {
      setIsLoadingVideo(true);
      setIsProcessing(true);
      setError(null);
      
      // Reset all steps to pending
      setProcessingSteps(prev => prev.map(step => ({ ...step, status: 'pending' as const })));
      
      // Step 1: Load video metadata
      const metadataStart = performance.now();
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
      timings.metadata = performance.now() - metadataStart;

      // Step 2: Process transcript - Start immediately after we have video ID
      const transcriptStart = performance.now();
      updateProcessingStep(1, 'active');
      setProcessingStep('Processing transcript...');
      
      // Start transcript processing in parallel (non-blocking)
      const transcriptPromise = fetch('/api/video/transcript-quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: data.video.youtube_id }),
      });
      
      // Wait for transcript to complete
      const transcriptResponse = await transcriptPromise;

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
      timings.transcript = performance.now() - transcriptStart;

      
      // Step 3: Process content
      const processingStart = performance.now();
      updateProcessingStep(2, 'active');
      setProcessingStep('Processing content for search...');
      
      // Small delay for UI feedback
      await new Promise(resolve => setTimeout(resolve, 100));
      
      updateProcessingStep(2, 'completed');
      timings.processing = performance.now() - processingStart;
      
      // Update video data to reflect cached transcript
      setVideoData(prev => prev ? { ...prev, transcript_cached: true } : null);
      
      // Log total time and breakdown
      const totalTime = performance.now() - performanceStart;
      console.log('=== WATCH PAGE PERFORMANCE BREAKDOWN ===');
      console.log(`Total time: ${totalTime.toFixed(0)}ms`);
      console.log(`- Metadata API: ${timings.metadata.toFixed(0)}ms (${((timings.metadata/totalTime) * 100).toFixed(1)}%)`);
      console.log(`- Transcript API: ${timings.transcript.toFixed(0)}ms (${((timings.transcript/totalTime) * 100).toFixed(1)}%)`);
      console.log(`- Processing: ${timings.processing.toFixed(0)}ms (${((timings.processing/totalTime) * 100).toFixed(1)}%)`);
      console.log('========================================');

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
    // On mobile, switch to video tab when citation is clicked
    if (window.innerWidth < 1024 && activeTab === 'chat') {
      setActiveTab('video');
      toast.success(`Jumping to ${timestamp}`, {
        duration: 2000,
        position: 'top-center',
      });
      // Small delay to ensure tab switch completes before seeking
      setTimeout(() => {
        performSeek(timestamp);
      }, 150);
    } else {
      performSeek(timestamp);
    }
  };

  const performSeek = (timestamp: string) => {
    // Parse timestamp and seek to that time
    const parts = timestamp.split(':').map(Number);
    let seconds = 0;
    
    if (parts.length === 2) {
      seconds = parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    
    // Use ref to seek instead of setting state
    videoPlayerRef.current?.seekTo(seconds);
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
      <div className="h-screen flex flex-col">
      
      {/* Header */}
      <header className="border-b p-2 sm:p-4 flex items-center">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">
            <ArrowLeft className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Back</span>
          </Link>
        </Button>
        <div className="min-w-0 flex-1 ml-2 sm:ml-4">
          <h1 className="font-semibold text-sm sm:text-lg line-clamp-1">{videoData.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-muted-foreground hidden sm:inline">
              Duration: {formatDuration(videoData.duration)}
            </p>
            <Button variant="ghost" size="sm" asChild className="flex-shrink-0 h-5 px-1.5 -ml-1">
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
        </div>
        
        {/* Recent Chats Button */}
        {isSignedIn && (
          <div className="ml-auto mr-2">
            <RecentChatsSheet 
              currentVideoId={videoData.youtube_id}
              trigger={
                <Button variant="outline" size="sm" className="gap-1 sm:gap-2">
                  <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline text-xs">Chat history</span>
                </Button>
              }
            />
          </div>
        )}
      </header>

      {/* Mobile Tabs */}
      <div className="lg:hidden border-b bg-background sticky top-0 z-10">
        <div className="flex">
          <button
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors relative ${
              activeTab === 'video' 
                ? 'text-foreground' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('video')}
          >
            Video
            {activeTab === 'video' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors relative ${
              activeTab === 'chat' 
                ? 'text-foreground' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('chat')}
          >
            Chat
            {activeTab === 'chat' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop: Side by side, Mobile: Tab-based */}
        <div className="flex flex-col lg:flex-row w-full">
          {/* Video Player */}
          <div className={`w-full lg:w-1/2 flex flex-col ${
            activeTab === 'chat' ? 'hidden lg:flex' : ''
          }`}>
            {/* Mobile: Fixed aspect ratio container */}
            <div className="p-2 sm:p-4 border-b lg:border-b-0 lg:border-r">
              <VideoPlayer 
                ref={videoPlayerRef}
                videoId={videoData.youtube_id}
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
          <div className={`w-full lg:w-1/2 flex flex-col min-h-0 flex-1 ${
            activeTab === 'video' ? 'hidden lg:flex' : ''
          }`}>
            {/* Mobile: Take remaining height, Desktop: Full height */}
            <div className="flex-1 min-h-0 lg:h-full">
              <ChatInterface
                videoId={videoData.youtube_id}
                sessionId={sessionId || undefined}
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

export default function WatchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>}>
      <WatchPageContent />
    </Suspense>
  );
}