'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Send, Loader2 } from 'lucide-react';
import { ChatMessage } from '@/types';

interface ChatInterfaceProps {
  videoId?: string;
  channelId?: string;
  onCitationClick?: (timestamp: string) => void;
  className?: string;
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
  className = '' 
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    if (!videoId && !channelId) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userMessage.content,
          videoId,
          channelId,
          messages: messages.slice(-5) // Keep last 5 messages for context
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
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
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error while processing your question. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <p className="mb-2">Ask me anything about this video!</p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInput("What is this video about?")}
              >
                What is this video about?
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInput("Give me the key takeaways")}
              >
                Key takeaways
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInput("Summarize the main points")}
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
          <div className="flex justify-start">
            <Card className="max-w-[80%]">
              <CardContent className="p-3">
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question about the video..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button 
            onClick={sendMessage} 
            disabled={isLoading || !input.trim()}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
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

  const renderContent = (content: string, citations?: Citation[]) => {
    if (!citations || citations.length === 0) {
      return content;
    }

    // Replace citation timestamps with clickable links
    let renderedContent = content;
    const timestampRegex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;
    
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = timestampRegex.exec(content)) !== null) {
      // Add text before the timestamp
      if (match.index > lastIndex) {
        parts.push(content.slice(lastIndex, match.index));
      }

      // Add clickable timestamp
      const timestamp = match[1];
      parts.push(
        <button
          key={match.index}
          onClick={() => handleCitationClick(timestamp)}
          className="text-blue-500 hover:text-blue-700 underline mx-1"
        >
          [{timestamp}]
        </button>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(content.slice(lastIndex));
    }

    return parts;
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <Card className={`max-w-[80%] ${isUser ? 'bg-primary text-primary-foreground' : ''}`}>
        <CardContent className="p-3">
          <div className="text-sm">
            {renderContent(message.content, message.citations)}
          </div>
          <div className={`text-xs mt-1 ${isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
            {message.timestamp.toLocaleTimeString()}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}