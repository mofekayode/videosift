'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { LoadingSpinner } from '@/components/ui/loading';
import { ChannelChatInterface } from '@/components/chat/ChannelChatInterface';

interface Channel {
  id: string;
  title: string;
  youtube_channel_id: string;
  video_count: number;
  status: string;
}

export default function ChannelChatPage() {
  const params = useParams();
  const { user } = useUser();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && params.id) {
      fetchChannelDetails();
    }
  }, [user, params.id]);

  const fetchChannelDetails = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/channels/${params.id}`);
      const data = await response.json();

      if (data.success) {
        setChannel(data.channel);
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

  if (!user) {
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold">{channel.title}</h1>
              <p className="text-sm text-muted-foreground">
                {channel.video_count} videos indexed • Multi-channel chat
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-0">
              <ChannelChatInterface channel={channel} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}