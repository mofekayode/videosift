'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { VideoPlayer } from '@/components/video/VideoPlayer';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

  useEffect(() => {
    if (videoId) {
      loadVideo();
    }
  }, [videoId]);

  const loadVideo = async () => {
    try {
      setIsProcessing(true);
      setProcessingStep('Loading video...');
      
      // First, get video metadata (this will create the video record if it doesn't exist)
      const metadataResponse = await fetch('/api/video/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoId}` }),
      });

      if (!metadataResponse.ok) {
        throw new Error('Failed to load video metadata');
      }

      const { data } = await metadataResponse.json();
      setVideoData(data.video);

      // If transcript is not cached, process it
      if (!data.video.transcript_cached) {
        setProcessingStep('Downloading transcript...');
        
        const transcriptResponse = await fetch('/api/video/transcript', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: data.video.youtube_id }),
        });

        if (transcriptResponse.ok) {
          // Update video data to reflect cached transcript
          setVideoData(prev => prev ? { ...prev, transcript_cached: true } : null);
        }
      }

    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
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
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>{error}</p>
            <div className="flex space-x-2">
              <Button onClick={loadVideo} variant="outline">
                Try Again
              </Button>
              <Button asChild>
                <Link href="/">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Go Back
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isProcessing || !videoData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground">
                {processingStep || 'Loading...'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="font-semibold text-lg line-clamp-1">{videoData.title}</h1>
            <p className="text-sm text-muted-foreground">
              Duration: {formatDuration(videoData.duration)}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a 
            href={`https://www.youtube.com/watch?v=${videoData.youtube_id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open in YouTube
          </a>
        </Button>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop: Side by side, Mobile: Stacked */}
        <div className="flex flex-col lg:flex-row w-full">
          {/* Video Player */}
          <div className="lg:w-1/2 flex flex-col">
            <div className="p-4 border-b lg:border-b-0 lg:border-r">
              <VideoPlayer 
                videoId={videoData.youtube_id}
                currentTime={currentTime}
                onTimeUpdate={setCurrentTime}
                className="w-full"
              />
            </div>
            
            {/* Banner */}
            <div className="p-4 bg-muted/50 border-b lg:border-r">
              <p className="text-sm text-muted-foreground text-center">
                Multi-video search coming soon
              </p>
            </div>
          </div>

          {/* Chat Interface */}
          <div className="lg:w-1/2 flex flex-col min-h-0">
            <ChatInterface
              videoId={videoData.id}
              onCitationClick={handleCitationClick}
              className="h-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}