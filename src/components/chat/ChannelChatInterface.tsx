'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading';
import { Badge } from '@/components/ui/badge';
import { Send, Users, MessageCircle, AlertCircle, Video, PlayCircle } from 'lucide-react';

interface Channel {
  id: string;
  title: string;
  youtube_channel_id: string;
  video_count: number;
  status: string;
  videos?: Array<{
    youtube_id: string;
    title: string;
    thumbnail_url?: string;
  }>;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: string[];
  timestamp: Date;
  referencedVideos?: Array<{ videoId: string; title: string; timestamps: string[] }>;
}

interface ChannelChatInterfaceProps {
  channel: Channel;
}

export function ChannelChatInterface({ channel }: ChannelChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messageCount, setMessageCount] = useState(0);
  const [limit, setLimit] = useState(50);
  const [error, setError] = useState<string | null>(null);
  const [referencedVideos, setReferencedVideos] = useState<Map<string, { title: string; timestamps: Set<string> }>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const extractVideoReferences = (content: string): Array<{ videoId: string; title: string; timestamps: string[] }> => {
    const videoRefs = new Map<string, { title: string; timestamps: Set<string> }>();
    
    // First, extract all timestamps
    const timestampPattern = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;
    const timestamps: string[] = [];
    let match;
    
    while ((match = timestampPattern.exec(content)) !== null) {
      timestamps.push(match[1]);
    }
    
    // Look for video references in numbered list format (as shown in screenshot)
    // Pattern: "2. Alexandr Wang: Building Scale AI..." followed by timestamps
    const numberedListPattern = /\d+\.\s*([^:]+?)(?::\s*[^[]+)?(?=\s*[-–]\s*|\s*\[)/g;
    const videoMatches: { title: string; nearbyTimestamps: string[] }[] = [];
    
    // Split content into lines for better parsing
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Check if this line contains a numbered item that might be a video title
      const numberMatch = line.match(/^\d+\.\s*(.+?)(?:[-–:]|$)/);
      if (numberMatch) {
        const potentialTitle = numberMatch[1].trim();
        
        // Look for timestamps in this line and the next few lines
        const nearbyTimestamps: string[] = [];
        for (let i = index; i < Math.min(index + 3, lines.length); i++) {
          const lineTimestamps = lines[i].match(/\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g);
          if (lineTimestamps) {
            lineTimestamps.forEach(ts => {
              const timestamp = ts.match(/\[(\d{1,2}:\d{2}(?::\d{2})?)\]/)?.[1];
              if (timestamp) nearbyTimestamps.push(timestamp);
            });
          }
        }
        
        if (nearbyTimestamps.length > 0) {
          videoMatches.push({ title: potentialTitle, nearbyTimestamps });
        }
      }
    });
    
    // Match video titles to actual videos in the channel
    videoMatches.forEach(({ title, nearbyTimestamps }) => {
      // Find best matching video
      const matchedVideo = channel.videos?.find(video => {
        // Try exact match first
        if (video.title === title) return true;
        
        // Try partial match - check if the title starts with the video title
        if (title.toLowerCase().includes(video.title.toLowerCase())) return true;
        if (video.title.toLowerCase().includes(title.toLowerCase())) return true;
        
        // Check if significant words match
        const titleWords = title.toLowerCase().split(/\s+/);
        const videoWords = video.title.toLowerCase().split(/\s+/);
        const matchingWords = titleWords.filter(word => 
          word.length > 3 && videoWords.includes(word)
        );
        return matchingWords.length >= 2;
      });
      
      if (matchedVideo) {
        if (!videoRefs.has(matchedVideo.youtube_id)) {
          videoRefs.set(matchedVideo.youtube_id, {
            title: matchedVideo.title,
            timestamps: new Set()
          });
        }
        nearbyTimestamps.forEach(ts => {
          videoRefs.get(matchedVideo.youtube_id)!.timestamps.add(ts);
        });
      }
    });
    
    // If no matches found but we have timestamps, associate with any mentioned videos
    if (videoRefs.size === 0 && timestamps.length > 0) {
      channel.videos?.forEach(video => {
        const titleWords = video.title.split(/\s+/).filter(w => w.length > 3);
        const mentioned = titleWords.some(word => 
          content.toLowerCase().includes(word.toLowerCase())
        );
        
        if (mentioned) {
          videoRefs.set(video.youtube_id, {
            title: video.title,
            timestamps: new Set(timestamps)
          });
        }
      });
    }
    
    return Array.from(videoRefs.entries()).map(([videoId, { title, timestamps }]) => ({
      videoId,
      title,
      timestamps: Array.from(timestamps)
    }));
  };
  
  const updateReferencedVideos = (newRefs: Array<{ videoId: string; title: string; timestamps: string[] }>) => {
    setReferencedVideos(prev => {
      const updated = new Map(prev);
      
      newRefs.forEach(ref => {
        if (!updated.has(ref.videoId)) {
          updated.set(ref.videoId, { title: ref.title, timestamps: new Set() });
        }
        ref.timestamps.forEach(ts => {
          updated.get(ref.videoId)!.timestamps.add(ts);
        });
      });
      
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setError(null);

    // Add user message immediately
    const newUserMessage: Message = {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newUserMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat-channel-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channelId: channel.id,
          message: userMessage,
          sessionId
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send message');
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      
      // Get session ID from headers
      const newSessionId = response.headers.get('X-Session-ID');
      if (newSessionId && !sessionId) {
        setSessionId(newSessionId);
      }
      
      const assistantMsg: Message = {
        role: 'assistant',
        content: '',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMsg]);
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          assistantMessage += chunk;
          
          // Extract video references from the content
          const videoRefs = extractVideoReferences(assistantMessage);
          
          // Update the last message with streaming content
          setMessages(prev => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = {
              ...assistantMsg,
              content: assistantMessage,
              referencedVideos: videoRefs
            };
            return newMessages;
          });
          
          // Update referenced videos
          updateReferencedVideos(videoRefs);
        }
      }
      
      // Update message count (estimate based on current messages)
      setMessageCount(messages.length + 2); // +2 for the new user and assistant messages

    } catch (error) {
      console.error('Error sending message:', error);
      setError(error instanceof Error ? error.message : 'Failed to send message');
      
      // Remove the user message on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const formatMessageContent = (content: string) => {
    // Simple timestamp link formatting
    const timestampRegex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;
    return content.replace(timestampRegex, (match, timestamp) => {
      return `<span class="timestamp-link">[${timestamp}]</span>`;
    });
  };

  // Helper function to convert timestamp to seconds
  const convertTimestampToSeconds = (timestamp: string): number => {
    const parts = timestamp.split(':').map(Number);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    return 0;
  };

  return (
    <div className="flex h-[600px]">
      {/* Left sidebar - Referenced Videos */}
      {referencedVideos.size > 0 && (
        <div className="w-80 border-r bg-muted/10 p-4 overflow-y-auto">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Video className="w-4 h-4" />
            Referenced Videos ({referencedVideos.size})
          </h3>
          <div className="space-y-3">
            {Array.from(referencedVideos.entries()).map(([videoId, { title, timestamps }]) => {
              const video = channel.videos?.find(v => v.youtube_id === videoId);
              return (
                <div key={videoId} className="bg-background rounded-lg p-3 border">
                  {video?.thumbnail_url && (
                    <img 
                      src={video.thumbnail_url} 
                      alt={title}
                      className="w-full h-32 object-cover rounded mb-2"
                    />
                  )}
                  <h4 className="font-medium text-sm line-clamp-2 mb-2">{title}</h4>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Referenced at:</p>
                    <div className="flex flex-wrap gap-1">
                      {Array.from(timestamps).map((ts, idx) => (
                        <a
                          key={idx}
                          href={`https://youtube.com/watch?v=${videoId}&t=${convertTimestampToSeconds(ts)}s`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block px-2 py-0.5 bg-primary/10 text-primary rounded text-xs hover:bg-primary/20 transition-colors"
                        >
                          {ts}
                        </a>
                      ))}
                    </div>
                  </div>
                  <a
                    href={`https://youtube.com/watch?v=${videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <PlayCircle className="w-3 h-3" />
                    Watch video
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-semibold">Channel Chat</h3>
              <p className="text-sm text-muted-foreground">
                Ask questions about any of the {channel.video_count} videos in this channel
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {messageCount}/{limit} messages
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Semantic Search
            </Badge>
          </div>
        </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Start Your Channel Chat</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Ask questions about any topic covered in the {channel.video_count} videos from {channel.title}. 
              Get answers with specific video references and timestamps.
            </p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>💡 Try asking: &quot;What are the main topics covered in this channel?&quot;</p>
              <p>🔍 Or: &quot;Find videos about [specific topic]&quot;</p>
              <p>📊 Or: &quot;Summarize the key insights from recent videos&quot;</p>
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              <div
                className="text-sm whitespace-pre-wrap"
                dangerouslySetInnerHTML={{
                  __html: formatMessageContent(message.content)
                }}
              />
              {message.citations && message.citations.length > 0 && (
                <div className="mt-2 text-xs opacity-75">
                  📎 {message.citations.length} file reference{message.citations.length !== 1 ? 's' : ''}
                </div>
              )}
              <div className="text-xs opacity-60 mt-1">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-4 py-3 max-w-[80%]">
              <div className="flex items-center gap-2">
                <LoadingSpinner />
                <span className="text-sm">Searching through {channel.video_count} videos...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-4 mb-2">
          <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-lg">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={`Ask about any of the ${channel.video_count} videos in ${channel.title}...`}
            disabled={isLoading || messageCount >= limit}
            className="flex-1"
          />
          <Button 
            type="submit" 
            disabled={!inputValue.trim() || isLoading || messageCount >= limit}
            size="icon"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
        
        {messageCount >= limit && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Message limit reached. Start a new session to continue chatting.
          </p>
        )}
      </div>

        {/* CSS for timestamp styling */}
        <style jsx>{`
          .timestamp-link {
            color: #3b82f6;
            font-weight: 500;
            cursor: pointer;
          }
          .timestamp-link:hover {
            text-decoration: underline;
          }
        `}</style>
      </div>
    </div>
  );
}