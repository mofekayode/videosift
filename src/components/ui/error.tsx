'use client';

import { AlertTriangle, RefreshCw, Home, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ErrorCardProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  showHomeButton?: boolean;
  className?: string;
}

export function ErrorCard({ 
  title = 'Something went wrong', 
  message, 
  onRetry, 
  showHomeButton = true, 
  className 
}: ErrorCardProps) {
  return (
    <Card className={cn('w-full max-w-md', className)}>
      <CardHeader>
        <div className="flex items-center space-x-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <CardTitle className="text-destructive">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex space-x-2">
          {onRetry && (
            <Button onClick={onRetry} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          )}
          {showHomeButton && (
            <Button asChild size="sm">
              <Link href="/">
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface ErrorBoundaryFallbackProps {
  error: Error;
  resetError: () => void;
}

export function ErrorBoundaryFallback({ error, resetError }: ErrorBoundaryFallbackProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <ErrorCard
        title="Application Error"
        message={error.message || 'An unexpected error occurred. Please try refreshing the page.'}
        onRetry={resetError}
      />
    </div>
  );
}

interface ApiErrorHandlerProps {
  error: string | null;
  isLoading: boolean;
  onRetry?: () => void;
  children: React.ReactNode;
}

export function ApiErrorHandler({ error, isLoading, onRetry, children }: ApiErrorHandlerProps) {
  if (error && !isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <ErrorCard
          message={error}
          onRetry={onRetry}
          showHomeButton={false}
        />
      </div>
    );
  }

  return <>{children}</>;
}

// Error handling utilities
export const handleApiError = (error: unknown): string => {
  if (error instanceof Error) {
    // Handle specific error types
    if (error.message.includes('404')) {
      return 'Video not found. Please check the URL and try again.';
    }
    if (error.message.includes('403')) {
      return 'Access denied. This video might be private or restricted.';
    }
    if (error.message.includes('429')) {
      return 'Rate limit exceeded. Please wait a moment and try again.';
    }
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return 'Network error. Please check your connection and try again.';
    }
    return error.message;
  }
  return 'An unexpected error occurred. Please try again.';
};

export const getYouTubeErrorMessage = (errorCode: string): string => {
  switch (errorCode) {
    case 'quotaExceeded':
      return 'YouTube API quota exceeded. Please try again later.';
    case 'videoNotFound':
      return 'Video not found. It may have been deleted or made private.';
    case 'videoUnavailable':
      return 'Video is unavailable in your region or has restrictions.';
    case 'transcriptUnavailable':
      return 'Transcript not available for this video.';
    default:
      return 'YouTube service error. Please try again later.';
  }
};

export const getOpenAIErrorMessage = (errorType: string): string => {
  switch (errorType) {
    case 'rate_limit':
      return 'AI service is busy. Please wait a moment and try again.';
    case 'context_length':
      return 'Video content is too long. Try asking more specific questions.';
    case 'invalid_request':
      return 'Invalid request. Please try rephrasing your question.';
    default:
      return 'AI service error. Please try again later.';
  }
};