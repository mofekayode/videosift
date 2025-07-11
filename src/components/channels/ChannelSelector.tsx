'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading';
import { PlayCircle, Users, Clock, CheckCircle2, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface Channel {
  id: string;
  youtube_channel_id: string;
  title: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  video_count?: number;
  last_indexed_at?: string;
  created_at: string;
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

  useEffect(() => {
    if (user) {
      fetchUserChannels();
    }
  }, [user]);

  const fetchUserChannels = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/user/channels');
      const data = await response.json();

      if (data.success) {
        setChannels(data.channels);
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
    if (channel.status === 'completed') {
      onChannelSelect?.(channel);
      // Navigate to channel chat interface
      router.push(`/chat/channel/${channel.id}`);
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
      case 'completed':
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
      case 'completed':
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
              Add a YouTube channel URL above to get started
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
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
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {channels.map((channel) => (
            <div
              key={channel.id}
              className={`p-3 border rounded-lg transition-all cursor-pointer hover:shadow-sm ${
                channel.status === 'completed' 
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
                    {channel.video_count && (
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
                  </div>
                  
                  {channel.status === 'completed' && (
                    <p className="text-xs text-green-600 mt-1">
                      Ready for chat
                    </p>
                  )}
                  
                  {channel.status === 'processing' && (
                    <p className="text-xs text-blue-600 mt-1">
                      Processing videos...
                    </p>
                  )}
                  
                  {channel.status === 'failed' && (
                    <p className="text-xs text-red-600 mt-1">
                      Processing failed - contact support
                    </p>
                  )}
                </div>
              </div>
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