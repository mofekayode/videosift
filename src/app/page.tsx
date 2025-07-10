'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { extractVideoId } from '@/lib/youtube';
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
      setError('Something went wrong. Please try again.');
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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">
            MindSift
          </h1>
          <p className="text-xl text-muted-foreground">
            Chat with any YouTube video using AI
          </p>
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
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Start Chatting'
              )}
            </Button>
            
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Or{' '}
                <Button variant="link" className="p-0 h-auto">
                  log in to search entire channels & save chats
                </Button>
              </p>
            </div>
          </CardContent>
        </Card>
        
        <div className="flex flex-wrap gap-2 justify-center">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handleSuggestionClick('Summarize this video')}
          >
            Summarize this video
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handleSuggestionClick('Give me the key takeaways')}
          >
            Give me the key takeaways
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handleSuggestionClick('Explain the main points')}
          >
            Explain the main points
          </Button>
        </div>
      </div>
    </div>
  );
}
