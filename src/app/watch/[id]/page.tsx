'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { VideoPlayer } from '@/components/video/VideoPlayer';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingCard, ProcessingSteps } from '@/components/ui/loading';
import { ErrorCard, handleApiError } from '@/components/ui/error';
import { ArrowLeft, ExternalLink } from 'lucide-react';
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
  const params = useParams();
  const videoId = params.id as string;
  
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [processingSteps, setProcessingSteps] = useState([
    { label: 'Loading video metadata', status: 'pending' as const, description: 'Fetching video information from YouTube' },
    { label: 'Downloading transcript', status: 'pending' as const, description: 'Getting video captions and preparing for chat' },
    { label: 'Processing content', status: 'pending' as const, description: 'Creating searchable chunks and embeddings' },
  ]);

  useEffect(() => {
    if (videoId) {
      loadVideo();
    }
  }, [videoId]);

  const updateProcessingStep = (stepIndex: number, status: 'pending' | 'active' | 'completed' | 'error') => {
    setProcessingSteps(prev => prev.map((step, index) => 
      index === stepIndex ? { ...step, status } : step
    ));
  };

  const loadVideo = async () => {
    try {
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

      // Step 2: Check and download transcript if needed
      if (!data.video.transcript_cached) {
        updateProcessingStep(1, 'active');
        setProcessingStep('Downloading transcript...');
        
        const transcriptResponse = await fetch('/api/video/transcript', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: data.video.youtube_id }),
        });

        if (!transcriptResponse.ok) {
          updateProcessingStep(1, 'error');
          throw new Error('Failed to download transcript');
        }

        updateProcessingStep(1, 'completed');
        
        // Step 3: Process content
        updateProcessingStep(2, 'active');
        setProcessingStep('Processing content for search...');
        
        // Simulate processing time for better UX
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        updateProcessingStep(2, 'completed');
        
        // Update video data to reflect cached transcript
        setVideoData(prev => prev ? { ...prev, transcript_cached: true } : null);
      } else {
        // Transcript already cached, mark remaining steps as completed
        updateProcessingStep(1, 'completed');
        updateProcessingStep(2, 'completed');
      }

    } catch (error) {
      console.error('Video loading error:', error);
      setError(handleApiError(error));
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
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
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="border-b p-2 sm:p-4 flex items-center justify-between">
        <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Back</span>
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="font-semibold text-sm sm:text-lg line-clamp-1 sm:line-clamp-2">{videoData.title}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Duration: {formatDuration(videoData.duration)}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild className="ml-2 flex-shrink-0">
          <a 
            href={`https://www.youtube.com/watch?v=${videoData.youtube_id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Open in YouTube</span>
          </a>
        </Button>
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
            
            {/* Banner - Hidden on mobile to save space */}
            <div className="hidden sm:block p-2 sm:p-4 bg-muted/50 border-b lg:border-r">
              <p className="text-xs sm:text-sm text-muted-foreground text-center">
                Multi-video search coming soon
              </p>
            </div>
          </div>

          {/* Chat Interface */}
          <div className="w-full lg:w-1/2 flex flex-col min-h-0 flex-1">
            {/* Mobile: Take remaining height, Desktop: Full height */}
            <div className="flex-1 min-h-0 lg:h-full">
              <ChatInterface
                videoId={videoData.id}
                onCitationClick={handleCitationClick}
                className="h-full"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}