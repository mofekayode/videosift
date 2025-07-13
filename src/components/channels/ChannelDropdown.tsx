'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
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
  status: 'pending' | 'processing' | 'ready' | 'failed';
  video_count?: number;
}

interface ChannelDropdownProps {
  onChannelSelect?: (channelId: string) => void;
}

export function ChannelDropdown({ onChannelSelect }: ChannelDropdownProps = {}) {
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
        // Only show ready channels
        const readyChannels = data.channels.filter((ch: Channel) => ch.status === 'ready');
        setChannels(readyChannels);
      }
    } catch (error) {
      console.error('Error fetching channels:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChannelSelect = (channelId: string) => {
    setSelectedChannelId(channelId);
    // Navigate immediately when channel is selected
    if (onChannelSelect) {
      onChannelSelect(channelId);
    } else {
      router.push(`/chat/channel/${channelId}`);
    }
  };


  // Show loading state
  if (!user || isLoading) {
    return (
      <div className="flex items-center justify-center p-4 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading channels...
      </div>
    );
  }
  
  // Show empty state
  if (channels.length === 0) {
    return (
      <div className="text-center p-4 text-sm text-muted-foreground">
        No channels indexed yet. Add a channel below to get started.
      </div>
    );
  }

  return (
    <Select value={selectedChannelId} onValueChange={handleChannelSelect}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a channel to chat with" />
      </SelectTrigger>
      <SelectContent>
        {channels.map((channel) => (
          <SelectItem key={channel.id} value={channel.id}>
            <div className="flex items-center gap-2 cursor-pointer">
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
  );
}