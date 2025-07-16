'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading';
import { 
  Activity, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  Play,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

interface QueueStatus {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

interface MonitorData {
  queue: QueueStatus;
  lastCompleted: string | null;
  lastFailed: string | null;
  recentChannels: Array<{
    id: string;
    title: string;
    status: string;
    created_at: string;
    completed_at?: string;
    error_message?: string;
  }>;
}

export default function MonitorPage() {
  const [data, setData] = useState<MonitorData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/monitor/status');
      if (!response.ok) throw new Error('Failed to fetch status');
      
      const result = await response.json();
      setData(result.data);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching monitor data:', error);
      toast.error('Failed to fetch monitoring data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const triggerCron = async () => {
    try {
      const response = await fetch('/api/cron/process-channels');
      if (!response.ok) throw new Error('Failed to trigger cron');
      
      const result = await response.json();
      toast.success(`Cron triggered! Processed ${result.result.processed} channels`);
      
      // Refresh data after trigger
      setTimeout(fetchData, 2000);
    } catch (error) {
      toast.error('Failed to trigger cron job');
    }
  };

  useEffect(() => {
    fetchData();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      if (autoRefresh) {
        setIsRefreshing(true);
        fetchData();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-500';
      case 'processing': return 'text-blue-500';
      case 'pending': return 'text-yellow-500';
      case 'failed': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'processing': return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'failed': return <AlertCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Channel Processing Monitor</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsRefreshing(true);
              fetchData();
            }}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Queue Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{data?.queue.pending || 0}</span>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{data?.queue.processing || 0}</span>
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{data?.queue.completed || 0}</span>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{data?.queue.failed || 0}</span>
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cron Control */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Cron Job Control</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Cron runs every minute. Last refresh: {lastRefresh.toLocaleTimeString()}
              </p>
              {data?.lastCompleted && (
                <p className="text-sm text-muted-foreground">
                  Last completion: {new Date(data.lastCompleted).toLocaleString()}
                </p>
              )}
            </div>
            <Button onClick={triggerCron} variant="outline">
              <Play className="w-4 h-4 mr-2" />
              Trigger Now
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Channels */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Channel Processing</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data?.recentChannels.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No channels processed recently
              </p>
            ) : (
              data?.recentChannels.map((channel) => (
                <div
                  key={channel.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className={getStatusColor(channel.status)}>
                      {getStatusIcon(channel.status)}
                    </div>
                    <div>
                      <p className="font-medium">{channel.title}</p>
                      <p className="text-sm text-muted-foreground">
                        Created: {new Date(channel.created_at).toLocaleString()}
                      </p>
                      {channel.error_message && (
                        <p className="text-sm text-red-500">{channel.error_message}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant={
                    channel.status === 'completed' ? 'default' :
                    channel.status === 'processing' ? 'secondary' :
                    channel.status === 'failed' ? 'destructive' :
                    'outline'
                  }>
                    {channel.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}