'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading';
import { handleApiError } from '@/components/ui/error';
import { extractVideoId } from '@/lib/youtube';
import { AuthStatus } from '@/components/auth/AuthGuard';
import { SignInButton } from '@clerk/nextjs';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [firstQuestion, setFirstQuestion] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartChat = async () => {
    if (!url.trim()) {
      setError('Please enter a YouTube URL');
      return;
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      setError('Please enter a valid YouTube URL');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Navigate to watch page with the video ID
      const watchUrl = firstQuestion.trim() 
        ? `/watch/${videoId}?q=${encodeURIComponent(firstQuestion)}`
        : `/watch/${videoId}`;
      
      router.push(watchUrl);
    } catch (error) {
      console.error('Navigation error:', error);
      setError(handleApiError(error));
      setIsProcessing(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setFirstQuestion(suggestion);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleStartChat();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-2xl space-y-6 sm:space-y-8">
        <div className="text-center space-y-2 sm:space-y-4">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            MindSift
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground">
            Chat with any YouTube video using AI
          </p>
          <div className="flex justify-center">
            <AuthStatus />
          </div>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Get Started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="youtube-url" className="text-sm font-medium">
                Paste YouTube Link
              </label>
              <Input
                id="youtube-url"
                placeholder="https://www.youtube.com/watch?v=..."
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isProcessing}
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="first-question" className="text-sm font-medium">
                Ask Your First Question (Optional)
              </label>
              <Input
                id="first-question"
                placeholder="What is this video about?"
                value={firstQuestion}
                onChange={(e) => setFirstQuestion(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isProcessing}
              />
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {error}
              </div>
            )}
            
            <Button 
              className="w-full" 
              onClick={handleStartChat}
              disabled={isProcessing || !url.trim()}
            >
              {isProcessing ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Processing...
                </>
              ) : (
                'Start Chatting'
              )}
            </Button>
            
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Or{' '}
                <SignInButton mode="modal">
                  <Button variant="link" className="p-0 h-auto text-sm">
                    log in to search entire channels & save chats
                  </Button>
                </SignInButton>
              </p>
            </div>
          </CardContent>
        </Card>
        
        <div className="flex flex-wrap gap-1 sm:gap-2 justify-center">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handleSuggestionClick('Summarize this video')}
            className="text-xs sm:text-sm"
          >
            Summarize this video
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handleSuggestionClick('Give me the key takeaways')}
            className="text-xs sm:text-sm"
          >
            Give me the key takeaways
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handleSuggestionClick('Explain the main points')}
            className="text-xs sm:text-sm"
          >
            Explain the main points
          </Button>
        </div>
      </div>
    </div>
  );
}
