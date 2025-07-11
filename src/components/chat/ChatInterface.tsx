'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading';
import { handleApiError, getOpenAIErrorMessage } from '@/components/ui/error';
import { useUser, SignUpButton } from '@clerk/nextjs';
import { Send, Loader2, AlertCircle, Clock } from 'lucide-react';
import { ChatMessage } from '@/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatInterfaceProps {
  videoId?: string;
  channelId?: string;
  onCitationClick?: (timestamp: string) => void;
  className?: string;
  initialQuestion?: string;
  onCitationsUpdate?: (timestamps: string[]) => void;
}

interface Citation {
  timestamp: string;
  text: string;
  video_id?: string;
}

export function ChatInterface({ 
  videoId, 
  channelId, 
  onCitationClick, 
  className = '',
  initialQuestion,
  onCitationsUpdate
}: ChatInterfaceProps) {
  const { isSignedIn } = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [autoSearchExecuted, setAutoSearchExecuted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-search with initial question from URL parameter
  useEffect(() => {
    if (initialQuestion && initialQuestion.trim() && !autoSearchExecuted && videoId) {
      console.log('Auto-search triggered for:', initialQuestion);
      setAutoSearchExecuted(true);
      
      // Set up the initial message first
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: initialQuestion.trim(),
        timestamp: new Date(),
      };
      
      setMessages([userMessage]);
      setInput('');
    }
  }, [initialQuestion, videoId, autoSearchExecuted]);

  // Separate effect to handle the actual search after message is set
  useEffect(() => {
    if (autoSearchExecuted && initialQuestion && messages.length > 0 && !isLoading && videoId) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'user' && lastMessage.content === initialQuestion.trim()) {
        setIsLoading(true);
        handleAutoSearch(initialQuestion.trim());
      }
    }
  }, [autoSearchExecuted, initialQuestion, messages, isLoading, videoId]);

  // Update citations whenever messages change
  useEffect(() => {
    if (onCitationsUpdate) {
      const allTimestamps: string[] = [];
      messages.forEach(msg => {
        if (msg.content && msg.role === 'assistant') {
          // Extract original citation text from message content
          const timestampRegex = /\[(\d{1,2}:\d{2}(?::\d{2})?)(?:\s*-\s*(\d{1,2}:\d{2}(?::\d{2})?))?]/g;
          let match;
          while ((match = timestampRegex.exec(msg.content)) !== null) {
            const fullMatch = match[0]; // This includes the brackets and full range
            const displayText = fullMatch.slice(1, -1); // Remove brackets for display
            if (!allTimestamps.includes(displayText)) {
              allTimestamps.push(displayText);
            }
          }
        }
      });
      onCitationsUpdate(allTimestamps);
    }
  }, [messages, onCitationsUpdate]);

  const handleAutoSearch = async (query: string) => {
    if (!query.trim() || isLoading) return;
    if (!videoId) return;

    try {
      setConnectionError(null);
      
      const response = await fetch('/api/chat-simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          videoId,
          messages: messages.slice(-5) // Keep last 5 messages for context
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        citations: data.citations,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = handleApiError(error);
      
      // Set connection error for display
      setConnectionError(errorMessage);
      
      const assistantErrorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I encountered an error: ${errorMessage}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantErrorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    if (!videoId) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const query = input.trim();
    setInput('');
    setIsLoading(true);

    await handleAutoSearch(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const retryLastMessage = () => {
    if (messages.length > 0) {
      const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
      if (lastUserMessage) {
        setInput(lastUserMessage.content);
        setConnectionError(null);
      }
    }
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Connection Error Banner */}
      {connectionError && (
        <div className="bg-destructive/10 border-l-4 border-destructive p-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">Connection issue detected</span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={retryLastMessage}
            className="text-xs"
          >
            Retry
          </Button>
        </div>
      )}
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-background">
        {messages.length === 0 && (
          <div className="max-w-4xl mx-auto px-4 py-12 text-center">
            <div className="text-muted-foreground mb-6">
              <h3 className="text-lg font-medium mb-2">Ask me anything about this video!</h3>
              <p className="text-sm">I can help you understand the content, find specific information, or answer questions.</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const question = "What is this video about?";
                  const userMessage: ChatMessage = {
                    id: Date.now().toString(),
                    role: 'user',
                    content: question,
                    timestamp: new Date(),
                  };
                  setMessages([userMessage]);
                  setIsLoading(true);
                  handleAutoSearch(question);
                }}
                className="text-sm bg-background hover:bg-muted/50"
                disabled={isLoading}
              >
                What is this video about?
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const question = "Give me the key takeaways";
                  const userMessage: ChatMessage = {
                    id: Date.now().toString(),
                    role: 'user',
                    content: question,
                    timestamp: new Date(),
                  };
                  setMessages([userMessage]);
                  setIsLoading(true);
                  handleAutoSearch(question);
                }}
                className="text-sm bg-background hover:bg-muted/50"
                disabled={isLoading}
              >
                Key takeaways
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const question = "Summarize the main points";
                  const userMessage: ChatMessage = {
                    id: Date.now().toString(),
                    role: 'user',
                    content: question,
                    timestamp: new Date(),
                  };
                  setMessages([userMessage]);
                  setIsLoading(true);
                  handleAutoSearch(question);
                }}
                className="text-sm bg-background hover:bg-muted/50"
                disabled={isLoading}
              >
                Summarize
              </Button>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onCitationClick={onCitationClick}
          />
        ))}

        {isLoading && (
          <div className="max-w-4xl mx-auto px-4 py-6">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium text-primary">MAI</span>
              </div>
              <div className="flex-1 max-w-[80%]">
                <div className="rounded-2xl px-4 py-3 bg-transparent">
                  <div className="flex items-center space-x-2">
                    <LoadingSpinner size="sm" />
                    <span className="text-sm text-muted-foreground">Analyzing video...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Authentication reminder for guests */}
      {!isSignedIn && messages.length >= 3 && (
        <div className="border-t bg-[#2D9CFF]/5 p-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                Sign up to save this conversation
              </span>
            </div>
            <SignUpButton mode="modal">
              <Button size="sm" className="text-xs flex-shrink-0 bg-[#2D9CFF] hover:bg-[#1E8AE6] text-white">
                Save Chat
              </Button>
            </SignUpButton>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t bg-background">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What do you want to know next?"
              disabled={isLoading}
              className="w-full resize-none border-0 bg-muted/50 rounded-xl p-4 pr-12 text-sm focus:ring-0 focus:outline-none focus:border-transparent focus:ring-transparent focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-muted/60 min-h-[60px] max-h-40"
              rows={2}
            />
            <Button 
              onClick={sendMessage} 
              disabled={isLoading || !input.trim()}
              size="icon"
              className="absolute right-2 bottom-2 h-8 w-8 rounded-lg bg-primary hover:bg-primary/90 disabled:bg-muted"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  onCitationClick?: (timestamp: string) => void;
}

function MessageBubble({ message, onCitationClick }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  const handleCitationClick = (timestamp: string) => {
    if (onCitationClick) {
      onCitationClick(timestamp);
    }
  };

  const renderContentWithCitations = (content: string, citations?: Citation[]) => {
    return (
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom text component to handle timestamps
          p: ({ children }) => {
            const processChildren = (child: any): any => {
              if (typeof child === 'string') {
                // Replace citation timestamps with clickable links
                // Handle both single timestamps [12:34] and ranges [12:34 - 15:67]
                const timestampRegex = /\[(\d{1,2}:\d{2}(?::\d{2})?)(?:\s*-\s*(\d{1,2}:\d{2}(?::\d{2})?))?]/g;
                const parts = [];
                let lastIndex = 0;
                let match;

                while ((match = timestampRegex.exec(child)) !== null) {
                  // Add text before the timestamp
                  if (match.index > lastIndex) {
                    parts.push(child.slice(lastIndex, match.index));
                  }

                  // Add clickable timestamp
                  const startTimestamp = match[1];
                  const endTimestamp = match[2];
                  const displayText = endTimestamp ? `${startTimestamp} - ${endTimestamp}` : startTimestamp;
                  
                  parts.push(
                    <button
                      key={`timestamp-${match.index}`}
                      onClick={() => handleCitationClick(startTimestamp)}
                      className="text-[#2D9CFF] hover:text-[#1E8AE6] underline mx-1"
                      title={`Jump to ${startTimestamp}`}
                    >
                      [{displayText}]
                    </button>
                  );

                  lastIndex = match.index + match[0].length;
                }

                // Add remaining text
                if (lastIndex < child.length) {
                  parts.push(child.slice(lastIndex));
                }

                return parts.length > 1 ? parts : child;
              }
              return child;
            };

            const processedChildren = Array.isArray(children) 
              ? children.map(processChildren) 
              : processChildren(children);

            return <div className="mb-2">{processedChildren}</div>;
          },
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
          li: ({ children }) => <li className="mb-1">{children}</li>,
        }}
      >
        {content}
      </ReactMarkdown>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} gap-3`}>
        {!isUser && (
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-medium text-primary">MAI</span>
          </div>
        )}
        <div className={`flex-1 ${isUser ? 'max-w-[80%] ml-auto' : 'max-w-[80%]'}`}>
          <div className={`rounded-2xl px-4 py-3 ${
            isUser 
              ? 'bg-[#3B3B4F] text-white ml-auto' 
              : 'bg-[#1E1E29] text-white'
          }`}>
            <div className="text-sm leading-relaxed">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {renderContentWithCitations(message.content, message.citations)}
              </div>
            </div>
          </div>
          <div className={`text-[11px] mt-2 text-[#7A7A8C] ${isUser ? 'text-right' : ''}`}>
            {message.timestamp.toLocaleTimeString()}
          </div>
        </div>
        {isUser && (
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-medium">You</span>
          </div>
        )}
      </div>
    </div>
  );
}