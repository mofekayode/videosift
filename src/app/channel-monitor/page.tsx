'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Clock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface ChannelProgress {
  queueId: string;
  channelId: string;
  channelTitle: string;
  status: string;
  progress: number;
  videosProcessed: number;
  totalVideos: number;
  currentVideo: string | null;
  currentVideoIndex: number | null;
  estimatedTimeRemaining: number | null;
  estimatedCompletionAt: string | null;
  startedAt: string | null;
  error: string | null;
}

export default function ChannelMonitorPage() {
  const [channels, setChannels] = useState<ChannelProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/channel/monitor');
      const data = await response.json();
      
      if (data.success) {
        setChannels(data.activeChannels);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch channel status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Refresh every 3 seconds
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="ml-2">Loading channel status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Channel Processing Monitor</h1>
        <p className="text-muted-foreground">
          Real-time status of channel processing jobs
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Last updated: {lastUpdate.toLocaleTimeString()}
        </p>
      </div>

      {channels.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              No channels are currently being processed
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {channels.map((channel) => (
            <Card key={channel.queueId}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {getStatusIcon(channel.status)}
                    {channel.channelTitle}
                  </CardTitle>
                  <Badge variant={channel.status === 'processing' ? 'default' : 'secondary'}>
                    {channel.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Progress bar */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Progress: {channel.videosProcessed} / {channel.totalVideos} videos</span>
                      <span>{channel.progress}%</span>
                    </div>
                    <Progress value={channel.progress} className="h-2" />
                  </div>

                  {/* Current video */}
                  {channel.currentVideo && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Current video ({channel.currentVideoIndex}/{channel.totalVideos}):</span>
                      <p className="font-medium truncate">{channel.currentVideo}</p>
                    </div>
                  )}

                  {/* Time estimates */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {channel.startedAt && (
                      <div>
                        <span className="text-muted-foreground">Started at:</span>
                        <p className="font-medium">{new Date(channel.startedAt).toLocaleTimeString()}</p>
                      </div>
                    )}
                    {channel.estimatedTimeRemaining !== null && (
                      <div>
                        <span className="text-muted-foreground">Time remaining:</span>
                        <p className="font-medium">{formatTime(channel.estimatedTimeRemaining)}</p>
                      </div>
                    )}
                    {channel.estimatedCompletionAt && (
                      <div>
                        <span className="text-muted-foreground">Estimated completion:</span>
                        <p className="font-medium">{new Date(channel.estimatedCompletionAt).toLocaleTimeString()}</p>
                      </div>
                    )}
                  </div>

                  {/* Error message */}
                  {channel.error && (
                    <div className="bg-red-50 border border-red-200 rounded p-3">
                      <p className="text-sm text-red-800">{channel.error}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}