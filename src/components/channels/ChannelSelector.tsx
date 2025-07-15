'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading';
import { PlayCircle, Users, Clock, CheckCircle2, AlertCircle, Loader2, Trash2, RefreshCw, ChevronDown, ChevronUp, Video } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

interface Video {
  id: string;
  youtube_id: string;
  title: string;
  thumbnail_url?: string;
  duration?: number;
  chunks_processed?: boolean;
  transcript_cached?: boolean;
}

interface Channel {
  id: string;
  youtube_channel_id: string;
  title: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  video_count?: number;
  total_video_count?: number;
  last_indexed_at?: string;
  created_at: string;
  videos?: Video[];
  channel_queue?: {
    id: string;
    status: string;
    videos_processed?: number;
    total_videos?: number;
    current_video_index?: number;
    current_video_title?: string;
    estimated_completion_at?: string;
    started_at?: string;
    error_message?: string;
  }[];
}

interface ChannelSelectorProps {
  onChannelSelect?: (channel: Channel) => void;
  selectedChannelId?: string;
}

export function ChannelSelector({ onChannelSelect, selectedChannelId }: ChannelSelectorProps) {
  const { user } = useUser();
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingChannelId, setDeletingChannelId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasPendingChannels, setHasPendingChannels] = useState(false);
  const [expandedChannelId, setExpandedChannelId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchUserChannels();
      
      // Set up realtime subscription
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      // Subscribe to channel changes
      const channelSubscription = supabase
        .channel('channel-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'channels'
          },
          (payload) => {
            console.log('Channel change received:', payload);
            fetchUserChannels();
          }
        )
        .subscribe();
      
      // Subscribe to channel_queue changes
      const queueSubscription = supabase
        .channel('queue-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'channel_queue'
          },
          (payload) => {
            console.log('Queue change received:', payload);
            fetchUserChannels();
          }
        )
        .subscribe();
      
      return () => {
        channelSubscription.unsubscribe();
        queueSubscription.unsubscribe();
      };
    }
  }, [user]);

  const fetchUserChannels = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/user/channels');
      const data = await response.json();

      if (data.success) {
        setChannels(data.channels);
        // Check if any channels are pending
        const pending = data.channels.some((ch: Channel) => 
          ch.status === 'pending' || 
          ch.channel_queue?.some(q => q.status === 'pending')
        );
        setHasPendingChannels(pending);
      } else {
        setError('Failed to load channels');
      }
    } catch (error) {
      console.error('Error fetching channels:', error);
      setError('Failed to load channels');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChannelSelect = (channel: Channel) => {
    if (channel.status === 'ready') {
      onChannelSelect?.(channel);
      // Navigate to channel chat interface
      router.push(`/chat/channel/${channel.id}`);
    }
  };

  const toggleChannelExpansion = (channelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedChannelId(expandedChannelId === channelId ? null : channelId);
  };

  const handleProcessPendingChannels = async () => {
    setIsProcessing(true);
    
    try {
      const response = await fetch('/api/channel/process-queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (response.ok) {
        if (data.message?.includes('No pending channels')) {
          toast.info('No channels are waiting to be processed');
        } else {
          toast.success('Channel processing started! You\'ll be notified by email when complete.');
        }
        // Refresh channels to show updated status
        fetchUserChannels();
      } else {
        toast.error(data.error || 'Failed to start processing');
      }
    } catch (error) {
      console.error('Error processing channels:', error);
      toast.error('Failed to start channel processing');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteChannel = async (channelId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent channel selection when clicking delete
    
    if (!confirm('Are you sure you want to remove this channel? You can add it again later.')) {
      return;
    }

    setDeletingChannelId(channelId);

    try {
      const response = await fetch(`/api/user/channels/${channelId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Channel removed successfully');
        // Remove channel from local state
        setChannels(channels.filter(c => c.id !== channelId));
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to remove channel');
      }
    } catch (error) {
      console.error('Error deleting channel:', error);
      toast.error('Failed to remove channel');
    } finally {
      setDeletingChannelId(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ready':
        return 'Ready';
      case 'processing':
        return 'Processing';
      case 'failed':
        return 'Failed';
      default:
        return 'Pending';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (!user) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Your Channels
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
            <span className="ml-2 text-muted-foreground">Loading channels...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Your Channels
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">{error}</p>
            <Button 
              variant="outline" 
              onClick={fetchUserChannels}
              className="mt-4"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (channels.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Your Channels
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No channels indexed yet</p>
            <p className="text-sm text-muted-foreground mt-2">
             Go to home page to index channels
            </p>
            <Button 
              variant="outline" 
              onClick={() => router.push('/')} 
              className="mt-4"
            >
              Go to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Your Channels
              <span className="text-sm font-normal text-muted-foreground">
                ({channels.length})
              </span>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Click on a completed channel to start chatting
            </p>
          </div>
          {hasPendingChannels && (
            <Button
              onClick={handleProcessPendingChannels}
              disabled={isProcessing}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Process Pending
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {channels.map((channel) => (
            <div
              key={channel.id}
              className={`p-3 border rounded-lg transition-all cursor-pointer hover:shadow-sm ${
                channel.status === 'ready' 
                  ? 'hover:bg-muted/50 border-border' 
                  : 'cursor-not-allowed opacity-60 border-muted'
              } ${
                selectedChannelId === channel.id 
                  ? 'ring-2 ring-primary border-primary' 
                  : ''
              }`}
              onClick={() => handleChannelSelect(channel)}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  {getStatusIcon(channel.status)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-sm truncate">
                      {channel.title}
                    </h4>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getStatusColor(channel.status)}`}
                      >
                        {getStatusText(channel.status)}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-destructive/10"
                        onClick={(e) => handleDeleteChannel(channel.id, e)}
                        disabled={deletingChannelId === channel.id}
                      >
                        {deletingChannelId === channel.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3 text-destructive" />
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {channel.video_count !== undefined && (
                      <span className="flex items-center gap-1">
                        <PlayCircle className="w-3 h-3" />
                        {channel.video_count} videos
                      </span>
                    )}
                    {channel.last_indexed_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(channel.last_indexed_at).toLocaleDateString()}
                      </span>
                    )}
                    {channel.status === 'ready' && channel.videos && channel.videos.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-2 text-xs"
                        onClick={(e) => toggleChannelExpansion(channel.id, e)}
                      >
                        {expandedChannelId === channel.id ? (
                          <>
                            <ChevronUp className="w-3 h-3 mr-1" />
                            Hide videos
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3 h-3 mr-1" />
                            Show videos
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                  
                  {channel.status === 'ready' && (
                    <div className="text-xs text-green-600 mt-1">
                      <p>Ready for chat • {channel.video_count || 0} videos indexed</p>
                      {channel.total_video_count && channel.total_video_count > (channel.video_count || 0) && (
                        <p className="text-amber-600 mt-0.5">
                          {channel.total_video_count - (channel.video_count || 0)} videos couldn't be indexed (no captions)
                        </p>
                      )}
                    </div>
                  )}
                  
                  {channel.status === 'processing' && channel.channel_queue?.[0] && (
                    <div className="mt-1 space-y-1">
                      <p className="text-xs text-blue-600">
                        Processing video {channel.channel_queue[0].current_video_index || 0} of {channel.channel_queue[0].total_videos || channel.total_video_count || '?'}
                      </p>
                      {channel.channel_queue[0].current_video_title && (
                        <p className="text-xs text-muted-foreground truncate">
                          Current: {channel.channel_queue[0].current_video_title}
                        </p>
                      )}
                      {channel.channel_queue[0].estimated_completion_at && (
                        <p className="text-xs text-muted-foreground">
                          ETA: {new Date(channel.channel_queue[0].estimated_completion_at).toLocaleTimeString()}
                        </p>
                      )}
                      {channel.channel_queue[0].videos_processed !== undefined && (
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                          <div 
                            className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                            style={{ 
                              width: `${(channel.channel_queue[0].videos_processed / (channel.channel_queue[0].total_videos || 1)) * 100}%` 
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                  
                  {channel.status === 'failed' && (
                    <p className="text-xs text-red-600 mt-1">
                      Processing failed - contact support
                    </p>
                  )}
                </div>
              </div>
              
              {/* Expanded video list */}
              {expandedChannelId === channel.id && channel.videos && channel.videos.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {channel.videos.map((video) => (
                      <div key={video.id} className="flex items-start gap-3 p-2 rounded hover:bg-muted/50">
                        {video.thumbnail_url ? (
                          <img 
                            src={video.thumbnail_url} 
                            alt={video.title}
                            className="w-20 h-12 object-cover rounded flex-shrink-0"
                          />
                        ) : (
                          <div className="w-20 h-12 bg-muted rounded flex-shrink-0 flex items-center justify-center">
                            <Video className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium line-clamp-2">{video.title}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {video.chunks_processed ? (
                                <span className="flex items-center gap-1 text-green-600">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Indexed
                                </span>
                              ) : video.transcript_cached === false ? (
                                <span className="flex items-center gap-1 text-amber-600">
                                  <AlertCircle className="w-3 h-3" />
                                  No captions
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  Pending
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-muted-foreground text-center">
            <strong>Beta Limit:</strong> 1 channel per user during beta
          </p>
          <p className="text-xs text-muted-foreground text-center mt-1">
            Pro plans with unlimited channels launch August 5th
          </p>
        </div>
      </CardContent>
    </Card>
  );
}