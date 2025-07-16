'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useUser, useAuth } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, Video, PlayCircle } from 'lucide-react';
import Link from 'next/link';
import { LoadingSpinner } from '@/components/ui/loading';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { VideoPlayer, VideoPlayerRef } from '@/components/video/VideoPlayer';
import { ReferencedVideosList } from '@/components/chat/ReferencedVideosList';
import { toast } from 'sonner';

interface Channel {
  id: string;
  title: string;
  youtube_channel_id: string;
  video_count: number;
  status: string;
}

interface ReferencedVideo {
  videoId: string;
  title: string;
  citations: Array<{
    timestamp: string;
    text?: string;
  }>;
  thumbnail?: string;
}

export default function ChannelChatPage() {
  const params = useParams();
  const { user } = useUser();
  const { isLoaded: authLoaded } = useAuth();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [referencedVideos, setReferencedVideos] = useState<ReferencedVideo[]>([]);
  const [currentVideo, setCurrentVideo] = useState<{ videoId: string; timestamp: number; _key?: number } | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [channelVideos, setChannelVideos] = useState<any[]>([]);
  const videoPlayerRef = useRef<VideoPlayerRef>(null);
  const [activeTab, setActiveTab] = useState<'videos' | 'chat'>('chat');
  const [hasNewVideos, setHasNewVideos] = useState(false);
  
  // Debug when component mounts/unmounts
  useEffect(() => {
    console.log('ChannelChatPage mounted at', new Date().toISOString());
    return () => console.log('ChannelChatPage unmounted at', new Date().toISOString());
  }, []);
  
  // Simple direct seeking when currentVideo changes
  useEffect(() => {
    if (currentVideo && videoPlayerRef.current) {
      console.log('Current video changed, seeking to:', currentVideo.timestamp);
      // Wait a bit for player to be ready if video just changed
      const delay = 2500; // 1 second delay to ensure player is ready
      const seekTimer = setTimeout(() => {
        if (videoPlayerRef.current) {
          console.log('Executing seek to:', currentVideo.timestamp);
          videoPlayerRef.current.seekTo(currentVideo.timestamp);
        }
      }, delay);
      
      return () => clearTimeout(seekTimer);
    }
  }, [currentVideo]);
  
  // Fetch channel videos
  useEffect(() => {
    console.log('Fetching channel videos for: in useEffect', channel?.id);
    if (channel?.id) {
      const videoFetchStart = performance.now();
      fetch(`/api/channels/${channel.id}/videos`)
        .then(res => {
          if (!res.ok) {
            console.log('Failed to fetch channel videos:', res);
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          return res.json();
        })
        .then(data => {
          const videoFetchTime = performance.now() - videoFetchStart;
          console.log('Fetched channel videos:', data);
          if (data.videos && data.videos.length > 0) {
            console.log(`Found ${data.videos.length} videos:`, data.videos.map((v: any) => ({ id: v.id, youtube_id: v.youtube_id, title: v.title })));
            setChannelVideos(data.videos);
            console.log(`=== Channel videos fetch time: ${videoFetchTime.toFixed(0)}ms ===`);
          } else {
            console.warn('No videos found for channel');
            setChannelVideos([]);
          }
        })
        .catch(error => {
          console.error('Failed to fetch channel videos:', error);
          setChannelVideos([]);
        });
    }
  }, [channel]);

  // Extract video references from messages
  useEffect(() => {
    console.log('Extracting videos from messages:', messages.length, 'Channel videos:', channelVideos.length);
    
    if (!messages.length) {
      console.log('No messages to process');
      return;
    }
    
    if (!channelVideos.length) {
      console.log('Channel videos not loaded yet, skipping extraction');
      return;
    }

    const videoMap = new Map<string, ReferencedVideo>();

    messages.forEach(msg => {
      console.log('Processing message:', msg);
      if (msg.role === 'assistant' && msg.content) {
        // Use video mapping if available
        const videoMapping = msg.videoMapping || {};
        
        // Extract all timestamps
        const citationRegex = /\[(\d{1,3}:\d{2}(?::\d{2})?)(?:\s*-\s*(\d{1,3}:\d{2}(?::\d{2})?))?\]/g;
        let match;
        
        while ((match = citationRegex.exec(msg.content)) !== null) {
          const timestamp = match[2] ? `${match[1]} - ${match[2]}` : match[1];
          const startTimestamp = match[1]; // Use first timestamp for lookup
          
          // Check if we have a mapping for this timestamp
          let targetVideo = null;
          if (videoMapping[startTimestamp]) {
            const mappedVideoId = videoMapping[startTimestamp].videoId;
            targetVideo = channelVideos.find(v => v.youtube_id === mappedVideoId);
          }
          
          // Fallback: try to find video by looking for title in nearby text
          if (!targetVideo) {
            console.log('No mapping found for timestamp:', startTimestamp);
            const startIndex = Math.max(0, match.index - 200);
            const endIndex = Math.min(msg.content.length, match.index + 200);
            const contextText = msg.content.substring(startIndex, endIndex).toLowerCase();
            
            for (const video of channelVideos) {
              if (contextText.includes(video.title.toLowerCase())) {
                targetVideo = video;
                break;
              }
            }
          }
          
          // Last fallback: use first video if we have any
          if (!targetVideo && channelVideos.length > 0) {
            targetVideo = channelVideos[0];
          }
          
          if (targetVideo) {
            console.log('Found target video:', targetVideo);
            if (!videoMap.has(targetVideo.youtube_id)) {
              videoMap.set(targetVideo.youtube_id, {
                videoId: targetVideo.youtube_id,
                title: targetVideo.title,
                thumbnail: targetVideo.thumbnail_url,
                citations: []
              });
            }
            
            const videoRef = videoMap.get(targetVideo.youtube_id)!;
            videoRef.citations.push({ timestamp });
          }
        }
      }
    });

    const newRefs = Array.from(videoMap.values());
    console.log('=== Video Extraction Debug ===');
    console.log('Channel videos available:', channelVideos.map(v => ({ youtube_id: v.youtube_id, title: v.title })));
    console.log('Extracted referenced videos:', newRefs);
    console.log('Video mappings from messages:', messages.filter(m => m.videoMapping).map(m => m.videoMapping));
    console.log('===========================');
    
    // Check if we have new videos and we're on chat tab
    if (newRefs.length > referencedVideos.length && activeTab === 'chat') {
      setHasNewVideos(true);
    }
    
    setReferencedVideos(newRefs);
  }, [messages, channelVideos]);

  useEffect(() => {
    console.log('Params changed:', params.id, 'Auth loaded:', authLoaded, 'User:', user?.id);
    // Only fetch channel details after auth has loaded and we have a user
    if (authLoaded && user && params.id) {
      console.log('Fetching channel details for:', params.id);
      fetchChannelDetails();
    }
  }, [authLoaded, user, params.id]);

  const handleMessagesUpdate = useCallback((newMessages: any[]) => {
    console.log('Messages updated from ChatInterface:', newMessages.length);
    setMessages(newMessages);
  }, []);

  const fetchChannelDetails = async () => {
    const performanceStart = performance.now();
    try {
      setIsLoading(true);
      const response = await fetch(`/api/channels/${params.id}`);
      const data = await response.json();
      const channelFetchTime = performance.now() - performanceStart;

      if (data.success) {
        console.log('Channel details:', data.channel);
        setChannel(data.channel);
        
        console.log('=== CHANNEL PAGE PERFORMANCE ===');
        console.log(`Channel details fetch: ${channelFetchTime.toFixed(0)}ms`);
        console.log('================================');
      } else {
        setError('Channel not found or access denied');
      }
    } catch (error) {
      console.error('Error fetching channel details:', error);
      setError('Failed to load channel');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while Clerk is initializing
  if (!authLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  // Only show sign-in message after auth has loaded and confirmed no user
  if (authLoaded && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Please sign in to access channel chat
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
        <span className="ml-2">Loading channel...</span>
      </div>
    );
  }

  if (error || !channel) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground mb-4">{error}</p>
            <div className="flex justify-center">
              <Link href="/">
                <Button variant="outline">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
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
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-primary" />
            <h1 className="font-semibold text-sm sm:text-lg line-clamp-1">{channel.title}</h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Chat with {channel.video_count} indexed videos • Ask about any topic across the channel
          </p>
        </div>
      </header>

      {/* Mobile Tabs */}
      <div className="lg:hidden border-b bg-background sticky top-0 z-10">
        <div className="flex">
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
          <button
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors relative ${
              activeTab === 'videos' 
                ? 'text-foreground' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => {
              setActiveTab('videos');
              setHasNewVideos(false);
            }}
          >
            <span className="relative">
              Videos {referencedVideos.length > 0 && `(${referencedVideos.length})`}
              {hasNewVideos && activeTab === 'chat' && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              )}
            </span>
            {activeTab === 'videos' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop: Side by side, Mobile: Tab-based */}
        <div className="flex flex-col lg:flex-row w-full">
          {/* Left Panel - Video Player and Referenced Videos */}
          <div className={`w-full lg:w-1/2 flex flex-col ${
            activeTab === 'chat' ? 'hidden lg:flex' : ''
          }`}>
            <div className="p-2 sm:p-4 border-b lg:border-b-0 lg:border-r h-full overflow-hidden flex flex-col">
              {(referencedVideos.length === 0 && !currentVideo) ? (
                <div className="bg-muted/50 rounded-lg p-8 text-center">
                  <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">Channel Chat</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Ask questions about any topic across the {channel.video_count} indexed videos in this channel.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    When videos are referenced in responses, they&apos;ll appear here.
                  </p>
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  {/* Video Player */}
                  {currentVideo && (
                    <div className="mb-4">
                      <VideoPlayer 
                        ref={videoPlayerRef}
                        key={currentVideo.videoId}
                        videoId={currentVideo.videoId}
                        onReady={() => {
                          console.log('Video player ready callback for video:', currentVideo.videoId);
                        }}
                        onTimeUpdate={() => {}}
                        className="w-full"
                      />
                      <div className="mt-2">
                        <p className="text-sm font-medium line-clamp-1">
                          {referencedVideos.find(v => v.videoId === currentVideo.videoId)?.title}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* Referenced Videos List */}
                  <div className="flex-1 flex flex-col min-h-0">
                    <ReferencedVideosList 
                      videos={referencedVideos}
                      currentVideo={currentVideo}
                      onVideoSelect={(videoId, timestamp) => {
                        console.log('Video selected from ReferencedVideosList:', videoId, 'at', timestamp);
                        // Always create a new object to ensure useEffect triggers
                        setCurrentVideo({ videoId, timestamp, _key: Date.now() });
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Chat Interface */}
          <div className={`w-full lg:w-1/2 flex flex-col min-h-0 flex-1 ${
            activeTab === 'videos' ? 'hidden lg:flex' : ''
          }`}>
            <div className="flex-1 min-h-0 lg:h-full">
              <ChatInterface
                channelId={channel.id}
                className="h-full"
                onMessagesUpdate={handleMessagesUpdate}
                onCitationClick={(timestamp) => {
                  console.log('Citation clicked:', timestamp);
                  
                  // On mobile, switch to videos tab when citation is clicked
                  const isMobile = window.innerWidth < 1024;
                  
                  // Extract video info from the current context
                  // This will be called when a citation is clicked in the chat
                  if (referencedVideos.length > 0) {
                    // Find the video that contains this timestamp
                    for (const video of referencedVideos) {
                      const hasTimestamp = video.citations.some(c => {
                        // Check if the citation matches exactly or is part of a range
                        const citationStart = c.timestamp.split(' - ')[0];
                        return c.timestamp === timestamp || citationStart === timestamp;
                      });
                      
                      if (hasTimestamp) {
                        // Parse timestamp to seconds
                        const timestampToParse = timestamp.includes(' - ') ? timestamp.split(' - ')[0] : timestamp;
                        const parts = timestampToParse.split(':').map(Number);
                        let seconds = 0;
                        if (parts.length === 2) {
                          seconds = parts[0] * 60 + parts[1];
                        } else if (parts.length === 3) {
                          seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                        }
                        
                        // Switch to videos tab on mobile
                        if (isMobile && activeTab === 'chat') {
                          setActiveTab('videos');
                          toast.success(`Jumping to ${timestamp}`, {
                            duration: 2000,
                            position: 'top-center',
                          });
                        }
                        
                        console.log('Setting current video:', video.videoId, 'at', seconds, 'seconds');
                        // Always create a new object to ensure useEffect triggers
                        setCurrentVideo({ videoId: video.videoId, timestamp: seconds, _key: Date.now() });
                        break;
                      }
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}