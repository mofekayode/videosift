'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, Clock, Zap, Building2, Star, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useUser, SignInButton } from '@clerk/nextjs';

interface BetaMessagingProps {
  quotaUsed: number;
  quotaLimit: number;
  channelsUsed: number;
  channelLimit: number;
  userType: 'anonymous' | 'user' | 'premium';
}

export function BetaMessaging({ 
  quotaUsed, 
  quotaLimit, 
  channelsUsed, 
  channelLimit, 
  userType 
}: BetaMessagingProps) {
  const { user } = useUser();
  const [waitlistStatus, setWaitlistStatus] = useState<{
    onWaitlist: boolean;
    position: number | null;
    loading: boolean;
  }>({
    onWaitlist: false,
    position: null,
    loading: true
  });

  const isNearQuotaLimit = quotaUsed / quotaLimit >= 0.8;
  const isAtHalfQuota = quotaUsed / quotaLimit >= 0.5;

  // Check waitlist status on component mount
  useEffect(() => {
    checkWaitlistStatus();
  }, [user]);

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

  const handleLockPricing = async () => {
    // Same logic as join waitlist since "lock pricing" is essentially joining the waitlist
    await handleJoinWaitlist();
  };

  return (
    <div className="space-y-3">
      {/* FREE BETA Banner - Only show when user is at 50% quota or more */}
      {isAtHalfQuota && (
        <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Badge variant="secondary" className="bg-purple-100 text-purple-700 gap-1 hover:bg-purple-200 hover:text-purple-800">
                <Sparkles className="h-3 w-3" />
                FREE BETA
              </Badge>
              <p className="text-sm font-medium text-purple-800">
                Ask up to {quotaLimit} questions per day and index 1 YouTube channel
              </p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-purple-700">
                Pro plans launch on August 5th. Early testers get 50% off for 2 months.
              </p>
              {!user ? (
                <SignInButton mode="modal">
                  <Button 
                    size="sm" 
                    className="bg-purple-600 text-white hover:bg-purple-700"
                  >
                    Sign in to Join Wait-list
                  </Button>
                </SignInButton>
              ) : waitlistStatus.loading ? (
                <Button size="sm" disabled>
                  Loading...
                </Button>
              ) : waitlistStatus.onWaitlist ? (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-green-100 text-green-700 gap-1 hover:bg-green-200 hover:text-green-800">
                    <Users className="h-3 w-3" />
                    #{waitlistStatus.position} in line
                  </Badge>
                </div>
              ) : (
                <Button 
                  size="sm" 
                  className="bg-purple-600 text-white hover:bg-purple-700"
                  onClick={handleJoinWaitlist}
                >
                  Join Wait-list
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Usage Display */}
      <Card className="border-gray-800">
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-gray-600" />
            <p className="text-sm text-gray-500">
              You're at <span className="font-bold">{quotaUsed} / {quotaLimit}</span> free questions today
            </p>
          </div>
        </CardContent>
      </Card>

      {/* PRO PLAN Coming Soon Banner */}
      {isNearQuotaLimit && (
        <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Badge variant="secondary" className="bg-amber-100 text-amber-700 gap-1 hover:bg-amber-200 hover:text-amber-800">
                <Zap className="h-3 w-3" />
                PRO PLAN COMING SOON
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-amber-800">
                Need more juice? Join the wait-list and lock lifetime pricing.
              </p>
              {!user ? (
                <SignInButton mode="modal">
                  <Button 
                    size="sm" 
                    className="bg-amber-600 text-white hover:bg-amber-700"
                  >
                    <Star className="h-3 w-3 mr-1" />
                    Sign in to Lock Pricing
                  </Button>
                </SignInButton>
              ) : waitlistStatus.loading ? (
                <Button size="sm" disabled>
                  Loading...
                </Button>
              ) : waitlistStatus.onWaitlist ? (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-green-100 text-green-700 gap-1 hover:bg-green-200 hover:text-green-800">
                    <Users className="h-3 w-3" />
                    #{waitlistStatus.position} in line
                  </Badge>
                </div>
              ) : (
                <Button 
                  size="sm" 
                  className="bg-amber-600 text-white hover:bg-amber-700"
                  onClick={handleLockPricing}
                >
                  <Star className="h-3 w-3 mr-1" />
                  Lock Pricing
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}