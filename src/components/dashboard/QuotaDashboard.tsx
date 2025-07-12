'use client';

import React, { useState, useEffect } from 'react';
import { useUser, SignInButton } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { 
  MessageSquare, 
  Users, 
  Clock, 
  Calendar,
  Crown,
  AlertTriangle,
  RefreshCw,
  Star
} from 'lucide-react';

interface UsageStats {
  chat: {
    hourly: {
      allowed: boolean;
      limit: number;
      remaining: number;
      resetTime: Date;
    };
    daily: {
      allowed: boolean;
      limit: number;
      remaining: number;
      resetTime: Date;
    };
  };
  channelProcess?: {
    allowed: boolean;
    limit: number;
    remaining: number;
    resetTime: Date;
  };
}

export function QuotaDashboard() {
  const { user } = useUser();
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todayMessageCount, setTodayMessageCount] = useState(0);
  const [waitlistStatus, setWaitlistStatus] = useState<{
    onWaitlist: boolean;
    position: number | null;
    loading: boolean;
  }>({
    onWaitlist: false,
    position: null,
    loading: true
  });

  const checkWaitlistStatus = async () => {
    try {
      const email = user?.emailAddresses[0]?.emailAddress;
      if (!email) {
        setWaitlistStatus({ onWaitlist: false, position: null, loading: false });
        return;
      }

      const response = await fetch(`/api/waitlist/status?email=${encodeURIComponent(email)}`);
      const data = await response.json();
      
      setWaitlistStatus({
        onWaitlist: data.onWaitlist,
        position: data.position,
        loading: false
      });
    } catch (error) {
      console.error('Failed to check waitlist status:', error);
      setWaitlistStatus({ onWaitlist: false, position: null, loading: false });
    }
  };

  const handleJoinWaitlist = async () => {
    const email = user?.emailAddresses[0]?.emailAddress;
    
    if (!user || !email) {
      toast.error("Please sign in to join the waitlist");
      return;
    }

    try {
      const response = await fetch('/api/waitlist/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.success) {
        setWaitlistStatus({
          onWaitlist: true,
          position: data.position,
          loading: false
        });
        
        toast.success(`You've joined the waitlist! You're #${data.position} in line.`, {
          duration: 4000,
        });
      } else {
        toast.error(data.error || 'Failed to join waitlist');
      }
    } catch (error) {
      console.error('Failed to join waitlist:', error);
      toast.error('Failed to join waitlist. Please try again.');
    }
  };

  const fetchUsageStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/user/usage-stats');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch usage stats');
      }
      
      // Convert date strings back to Date objects
      const stats = {
        ...data.stats,
        chat: {
          hourly: {
            ...data.stats.chat.hourly,
            resetTime: new Date(data.stats.chat.hourly.resetTime)
          },
          daily: {
            ...data.stats.chat.daily,
            resetTime: new Date(data.stats.chat.daily.resetTime)
          }
        },
        ...(data.stats.channelProcess && {
          channelProcess: {
            ...data.stats.channelProcess,
            resetTime: new Date(data.stats.channelProcess.resetTime)
          }
        })
      };
      
      setUsageStats(stats);
    } catch (error) {
      console.error('Error fetching usage stats:', error);
      setError(error instanceof Error ? error.message : 'Failed to load usage data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchUsageStats();
      checkWaitlistStatus();
      
      // Also fetch real message count
      fetch('/api/user/message-count')
        .then(res => res.json())
        .then(data => setTodayMessageCount(data.count))
        .catch(err => console.error('Failed to fetch message count:', err));
    }
  }, [user]);

  const getUsageColor = (used: number, limit: number) => {
    const percentage = (used / limit) * 100;
    if (percentage >= 90) return 'text-destructive';
    if (percentage >= 75) return 'text-orange-600';
    return 'text-green-600';
  };

  const getProgressColor = (used: number, limit: number) => {
    const percentage = (used / limit) * 100;
    if (percentage >= 90) return 'bg-destructive';
    if (percentage >= 75) return 'bg-orange-500';
    return 'bg-green-500';
  };

  const formatTimeRemaining = (resetTime: Date) => {
    const now = new Date();
    const diff = resetTime.getTime() - now.getTime();
    
    if (diff <= 0) return 'Reset available';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `Resets in ${hours}h ${minutes}m`;
    }
    return `Resets in ${minutes}m`;
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-muted-foreground">Please sign in to view usage statistics</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-muted-foreground">Loading usage data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">
            <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-2" />
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={fetchUsageStats} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!usageStats) return null;

  const tier = usageStats.channelProcess ? 'user' : 'anonymous';
  const isPremium = false; // TODO: Check actual subscription status

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Usage & Quotas</h2>
          <p className="text-sm text-muted-foreground">
            Monitor your usage across all MindSift features
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isPremium ? "default" : "secondary"} className="gap-1">
            {isPremium && <Crown className="w-3 h-3" />}
            {isPremium ? "Pro" : "Beta"}
          </Badge>
          <Button onClick={fetchUsageStats} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Chat Usage */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Chat Messages (Daily)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Used</span>
                <span className={`text-sm font-medium ${getUsageColor(
                  todayMessageCount,
                  30
                )}`}>
                  {todayMessageCount} / 30
                </span>
              </div>
              <Progress 
                value={(todayMessageCount / 30) * 100}
                className="h-2"
              />
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                {formatTimeRemaining(usageStats.chat.daily.resetTime)}
              </div>
            </div>
          </CardContent>
        </Card>
         {/* Channel Processing (for signed users) */}
      {usageStats.channelProcess && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />
              Channel Processing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Used</span>
                <span className={`text-sm font-medium ${getUsageColor(
                  usageStats.channelProcess.limit - usageStats.channelProcess.remaining,
                  usageStats.channelProcess.limit
                )}`}>
                  {usageStats.channelProcess.limit - usageStats.channelProcess.remaining} / {usageStats.channelProcess.limit}
                </span>
              </div>
              <Progress 
                value={(usageStats.channelProcess.limit - usageStats.channelProcess.remaining) / usageStats.channelProcess.limit * 100}
                className="h-2"
              />
              <p className="text-xs text-muted-foreground">
                Channels you can process during beta
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      </div>

      {/* Beta/Upgrade Prompt */}
      {!isPremium && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Crown className="w-5 h-5 text-primary mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-primary mb-1">Join Beta</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Get early access to Pro features with 50% off for 2 months when we launch
                </p>
                {!user ? (
                  <SignInButton mode="modal">
                    <Button size="sm" className="bg-primary hover:bg-primary/90">
                      <Star className="h-3 w-3 mr-1" />
                      Sign in to Join Waitlist
                    </Button>
                  </SignInButton>
                ) : waitlistStatus.loading ? (
                  <Button size="sm" disabled className="bg-primary hover:bg-primary/90">
                    Loading...
                  </Button>
                ) : waitlistStatus.onWaitlist ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-green-100 text-green-700 gap-1">
                      <Users className="h-3 w-3" />
                      #{waitlistStatus.position} in line
                    </Badge>
                  </div>
                ) : (
                  <Button 
                    size="sm" 
                    className="bg-primary hover:bg-primary/90"
                    onClick={handleJoinWaitlist}
                  >
                    <Star className="h-3 w-3 mr-1" />
                    Join Waitlist
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}