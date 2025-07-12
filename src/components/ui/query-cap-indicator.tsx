'use client';

import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  MessageCircle, 
  Clock, 
  AlertTriangle, 
  Crown,
  Zap
} from 'lucide-react';

interface QueryCapIndicatorProps {
  used: number;
  limit: number;
  timeframe: 'hour' | 'day';
  resetTime: Date;
  tier: 'anonymous' | 'user' | 'premium';
  compact?: boolean;
  showUpgrade?: boolean;
  onUpgrade?: () => void;
}

export function QueryCapIndicator({
  used,
  limit,
  timeframe,
  resetTime,
  tier,
  compact = false,
  showUpgrade = true,
  onUpgrade
}: QueryCapIndicatorProps) {
  const percentage = Math.round((used / limit) * 100);
  const remaining = Math.max(0, limit - used);
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  // Calculate time until reset
  const now = new Date();
  const timeDiff = resetTime.getTime() - now.getTime();
  const hoursUntilReset = Math.max(0, Math.floor(timeDiff / (1000 * 60 * 60)));
  const minutesUntilReset = Math.max(0, Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60)));

  const getStatusColor = () => {
    if (isAtLimit) return 'destructive';
    if (isNearLimit) return 'orange';
    return 'green';
  };

  const getStatusText = () => {
    if (isAtLimit) return 'Limit reached';
    if (isNearLimit) return 'Near limit';
    return 'Available';
  };

  const formatTimeRemaining = () => {
    if (timeDiff <= 0) return 'Resetting now';
    if (hoursUntilReset > 0) {
      return `${hoursUntilReset}h ${minutesUntilReset}m remaining`;
    }
    return `${minutesUntilReset}m remaining`;
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="relative">
          <div className="w-6 h-6">
            {/* Circular progress ring */}
            <svg className="w-6 h-6 transform -rotate-90" viewBox="0 0 24 24">
              <circle
                cx="12"
                cy="12"
                r="8"
                stroke="currentColor"
                strokeWidth="2"
                fill="transparent"
                className="text-muted"
                strokeDasharray={`${2 * Math.PI * 8}`}
              />
              <circle
                cx="12"
                cy="12"
                r="8"
                stroke="currentColor"
                strokeWidth="2"
                fill="transparent"
                className={`transition-all duration-300 ${
                  isAtLimit ? 'text-destructive' : 
                  isNearLimit ? 'text-orange-500' : 'text-primary'
                }`}
                strokeDasharray={`${2 * Math.PI * 8}`}
                strokeDashoffset={`${2 * Math.PI * 8 * (1 - percentage / 100)}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <MessageCircle className="w-3 h-3 text-muted-foreground" />
            </div>
          </div>
        </div>
        
        <div className="text-xs">
          <div className="flex items-center gap-1">
            <span className="font-medium">{remaining}</span>
            <span className="text-muted-foreground">left</span>
            {tier === 'anonymous' && showUpgrade && (
              <Badge variant="outline" className="text-xs">
                <Crown className="w-2 h-2 mr-1" />
                Beta
              </Badge>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className={`${isAtLimit ? 'border-destructive/50 bg-destructive/5' : ''}`}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">
                {timeframe === 'hour' ? 'Hourly' : 'Daily'} Messages
              </span>
            </div>
            <Badge 
              variant={isAtLimit ? 'destructive' : isNearLimit ? 'secondary' : 'outline'}
              className="text-xs"
            >
              {getStatusText()}
            </Badge>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Used</span>
              <span className={`font-medium ${
                isAtLimit ? 'text-destructive' : 
                isNearLimit ? 'text-orange-600' : 'text-green-600'
              }`}>
                {used} / {limit}
              </span>
            </div>
            
            <Progress 
              value={percentage} 
              className={`h-2 ${isAtLimit ? 'bg-destructive/20' : ''}`}
            />
            
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTimeRemaining()}
              </div>
              <span>{remaining} remaining</span>
            </div>
          </div>

          {/* Warning or upgrade prompt */}
          {isAtLimit && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
              <div className="text-xs">
                <p className="text-destructive font-medium">Message limit reached</p>
                <p className="text-muted-foreground">
                  Wait {formatTimeRemaining().toLowerCase()} or join beta for more messages
                </p>
              </div>
            </div>
          )}

          {tier === 'anonymous' && showUpgrade && percentage >= 50 && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Crown className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 text-xs">
                <p className="text-primary font-medium">Get 5x more messages</p>
                <p className="text-muted-foreground mb-2">
                  Sign up for {tier === 'anonymous' ? '50' : '250'} messages per {timeframe}
                </p>
                <Button 
                  size="sm" 
                  className="h-6 text-xs"
                  onClick={onUpgrade}
                >
                  <Zap className="w-3 h-3 mr-1" />
                  {tier === 'anonymous' ? 'Sign Up Free' : 'Join Beta'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}