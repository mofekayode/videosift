'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Channel {
  id: string;
  youtube_channel_id: string;
  title: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  video_count?: number;
}

export function ChannelDropdown() {
  const { user } = useUser();
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');

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
        // Only show completed channels
        const completedChannels = data.channels.filter((ch: Channel) => ch.status === 'completed');
        setChannels(completedChannels);
      }
    } catch (error) {
      console.error('Error fetching channels:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChannelSelect = (channelId: string) => {
    setSelectedChannelId(channelId);
  };

  const handleStartChatWithChannel = () => {
    if (selectedChannelId) {
      router.push(`/chat/channel/${selectedChannelId}`);
    }
  };

  // Don't show anything if loading or no channels
  if (!user || isLoading || channels.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        Or select an indexed channel
      </label>
      <div className="flex gap-2">
        <Select value={selectedChannelId} onValueChange={handleChannelSelect}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select a channel to chat with" />
          </SelectTrigger>
          <SelectContent>
            {channels.map((channel) => (
              <SelectItem key={channel.id} value={channel.id}>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>{channel.title}</span>
                  {channel.video_count && (
                    <span className="text-xs text-muted-foreground">
                      ({channel.video_count} videos)
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button 
          onClick={handleStartChatWithChannel}
          disabled={!selectedChannelId}
        >
          Chat with Channel
        </Button>
      </div>
    </div>
  );
}