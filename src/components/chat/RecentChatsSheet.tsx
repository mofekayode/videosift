'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, PlayCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

interface ChatSession {
  id: string;
  video_id: string | null;
  video_title?: string;
  video_thumbnail?: string;
  video_youtube_id?: string;
  created_at: string;
  updated_at: string;
  last_message?: string;
  message_count: number;
  messageCount?: number;
  video?: {
    youtube_id: string;
    title: string;
    thumbnail_url: string;
  };
}

interface RecentChatsSheetProps {
  currentVideoId?: string;
  trigger?: React.ReactNode;
}

export function RecentChatsSheet({ currentVideoId, trigger }: RecentChatsSheetProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen]);

  const fetchSessions = async () => {
    try {
      setIsLoading(true);
      // Fetch complete history (up to 50 sessions)
      const response = await fetch('/api/user/chat-history');
      const data = await response.json();

      if (data.success) {
        setSessions(data.sessions);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueChat = (session: ChatSession) => {
    const youtubeId = session.video_youtube_id || session.video?.youtube_id;
    if (youtubeId) {
      router.push(`/watch/${youtubeId}?session=${session.id}`);
      setIsOpen(false);
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

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="gap-2">
      <MessageSquare className="h-4 w-4" />
      Recent Chats
    </Button>
  );

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {trigger || defaultTrigger}
      </SheetTrigger>
      <SheetContent side="right" className="w-[90vw] max-w-[900px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Chat History
            <span className="text-sm font-normal text-muted-foreground">
              ({sessions.length})
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-3 overflow-y-auto max-h-[calc(100vh-150px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No chat history yet</p>
              <p className="text-sm mt-1">
                Your conversations will appear here after you start chatting
              </p>
            </div>
          ) : (
            <>
              {sessions.map((session) => {
                const youtubeId = session.video_youtube_id || session.video?.youtube_id;
                const title = session.video_title || session.video?.title || 'Untitled Video';
                const thumbnail = session.video_thumbnail || session.video?.thumbnail_url;
                const messageCount = session.message_count || session.messageCount || 0;
                
                return (
                  <div
                    key={session.id}
                    className={`p-4 rounded-lg border transition-colors hover:bg-muted/50 ${
                      youtubeId === currentVideoId ? 'border-primary bg-muted/30' : ''
                    }`}
                  >
                    <div className="flex gap-4">
                      {/* Thumbnail */}
                      <div className="flex-shrink-0">
                        {thumbnail ? (
                          <img
                            src={thumbnail}
                            alt={title}
                            className="w-32 h-20 object-cover rounded"
                          />
                        ) : (
                          <div className="w-32 h-20 bg-muted rounded flex items-center justify-center">
                            <PlayCircle className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-base line-clamp-1 mb-1">
                          {title}
                        </h4>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {messageCount} messages
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(session.updated_at)}
                          </span>
                        </div>
                      </div>

                      {/* Action */}
                      <div className="flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleContinueChat(session)}
                          disabled={youtubeId === currentVideoId}
                        >
                          <PlayCircle className="h-4 w-4 mr-1" />
                          {youtubeId === currentVideoId ? 'Current' : 'Continue'}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {sessions.length >= 50 && (
                <p className="text-xs text-muted-foreground text-center mt-4">
                  Showing your 50 most recent conversations
                </p>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}