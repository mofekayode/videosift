'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading';
import { Clock, MessageCircle, Play } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface ChatSession {
  id: string;
  video_id: string;
  created_at: string;
  updated_at: string;
  video?: {
    youtube_id: string;
    title: string;
    thumbnail_url: string;
  };
  messageCount: number;
}

export function ChatHistory() {
  const { user } = useUser();
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchChatHistory();
    }
  }, [user]);

  const fetchChatHistory = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/user/chat-history');
      const data = await response.json();

      if (data.success) {
        setSessions(data.sessions);
      } else {
        setError('Failed to load chat history');
      }
    } catch (error) {
      console.error('Error fetching chat history:', error);
      setError('Failed to load chat history');
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueChat = (session: ChatSession) => {
    if (session.video?.youtube_id) {
      // Pass session ID as query parameter to continue the chat
      router.push(`/watch/${session.video.youtube_id}?session=${session.id}`);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    return date.toLocaleDateString();
  };

  if (!user) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Chats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
            <span className="ml-2 text-muted-foreground">Loading your chat history...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Chats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">{error}</p>
            <Button 
              variant="outline" 
              onClick={fetchChatHistory}
              className="mt-4"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (sessions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Chats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No chat history yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Your conversations will appear here after you start chatting with videos
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          Recent Chats
          <span className="text-sm font-normal text-muted-foreground">
            ({sessions.length})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              {session.video?.thumbnail_url && (
                <Image
                  src={session.video.thumbnail_url}
                  alt="Video thumbnail"
                  width={80}
                  height={60}
                  className="rounded object-cover flex-shrink-0"
                />
              )}
              
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm truncate">
                  {session.video?.title || 'Video Chat'}
                </h4>
                
                <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" />
                    {session.messageCount} messages
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(session.updated_at)}
                  </span>
                </div>
              </div>
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleContinueChat(session)}
                className="flex items-center gap-1 flex-shrink-0"
              >
                <Play className="w-3 h-3" />
                Continue
              </Button>
            </div>
          ))}
        </div>
        
        {sessions.length >= 50 && (
          <p className="text-xs text-muted-foreground text-center mt-4">
            Showing your 50 most recent conversations
          </p>
        )}
      </CardContent>
    </Card>
  );
}