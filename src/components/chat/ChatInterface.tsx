'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading';
import { handleApiError, getOpenAIErrorMessage } from '@/components/ui/error';
import { useUser, SignUpButton } from '@clerk/nextjs';
import { Send, Loader2, AlertCircle, Clock, MessageCircle, Video, PlayCircle } from 'lucide-react';
import { ChatMessage } from '@/types';
import { generateAnonId, getStoredAnonId, setStoredAnonId } from '@/lib/session';
import { getChatMessagesBySession } from '@/lib/database';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { QueryCapIndicator } from '@/components/ui/query-cap-indicator';
import { useRateLimit } from '@/hooks/useRateLimit';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { QUOTA_CONFIG, getUserTier } from '@/lib/rate-limit';

interface ChatInterfaceProps {
  videoId?: string;
  channelId?: string;
  sessionId?: string;
  onCitationClick?: (timestamp: string) => void;
  className?: string;
  initialQuestion?: string;
  onCitationsUpdate?: (timestamps: string[]) => void;
  onReferencedVideosUpdate?: (videos: Map<string, ReferencedVideo>) => void;
  onMessagesUpdate?: (messages: ChatMessage[]) => void;
}

interface Citation {
  timestamp: string;
  text: string;
  video_id?: string;
}

interface ReferencedVideo {
  videoId: string;
  title: string;
  citations: Array<{
    timestamp: string;
    text?: string;
  }>;
  thumbnail?: string;
}

export function ChatInterface({ 
  videoId, 
  channelId,
  sessionId: propSessionId, 
  onCitationClick, 
  className = '',
  initialQuestion,
  onCitationsUpdate,
  onReferencedVideosUpdate,
  onMessagesUpdate
}: ChatInterfaceProps) {
  const { isSignedIn, user } = useUser();
  const { rateLimitData, updateFromResponse } = useRateLimit();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [autoSearchExecuted, setAutoSearchExecuted] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(propSessionId || null);
  const [anonId, setAnonId] = useState<string | null>(null);
  const [referencedVideos, setReferencedVideos] = useState<Map<string, ReferencedVideo>>(new Map());
  const [channelVideos, setChannelVideos] = useState<any[]>([]);
  const [sessionInfo, setSessionInfo] = useState<{
    messageCount: number;
    limit: number;
    remaining: number;
  } | null>(null);
  const [todayMessageCount, setTodayMessageCount] = useState<number>(0);
  const [messageCountLoaded, setMessageCountLoaded] = useState<boolean>(false);
  const [showLimitError, setShowLimitError] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const urlCleanedRef = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Get the user's daily message limit based on their tier
  const getDailyLimit = () => {
    const tier = getUserTier(user?.id);
    return QUOTA_CONFIG[tier].chat_messages_per_day;
  };

  // Load previous messages when continuing a session
  useEffect(() => {
    if (propSessionId && messages.length === 0) {
      console.log('Loading previous messages for session:', propSessionId);
      getChatMessagesBySession(propSessionId).then((previousMessages) => {
        if (previousMessages.length > 0) {
          console.log('Loaded', previousMessages.length, 'previous messages');
          setMessages(previousMessages);
          // Update session info with correct message count
          const userMessageCount = previousMessages.filter(m => m.role === 'user').length;
          setSessionInfo({
            messageCount: userMessageCount,
            limit: 30, // Default daily limit
            remaining: Math.max(0, 30 - userMessageCount)
          });
        }
      }).catch(error => {
        console.error('Failed to load previous messages:', error);
      });
    }
  }, [propSessionId]);

  useEffect(() => {
    scrollToBottom();
    console.log('Messages updated:', messages.length, 'User messages:', messages.filter(m => m.role === 'user').length);
    
    // Notify parent of message updates
    if (onMessagesUpdate) {
      onMessagesUpdate(messages);
    }
  }, [messages]);

  // Extract video references from messages when in channel mode
  useEffect(() => {
    console.log('Video extraction effect running:', { channelId, channelVideosLength: channelVideos.length, messagesLength: messages.length });
    if (!channelId || channelVideos.length === 0) return;
    
    // Only process if we have assistant messages
    const hasAssistantMessages = messages.some(m => m.role === 'assistant' && m.content);
    if (!hasAssistantMessages) {
      console.log('No assistant messages to process');
      return;
    }
    
    const extractVideoReferences = (content: string): Map<string, Set<string>> => {
      const videoRefs = new Map<string, Set<string>>();
      
      // Try new format first: [12:34] "Video Title"
      const newFormatRegex = /\[(\d{1,3}:\d{2}(?::\d{2})?)(?:\s*-\s*(\d{1,3}:\d{2}(?::\d{2})?))?\]\s*"([^"]+)"/g;
      
      // Fallback to old format: [12:34 - videoId]
      const oldFormatRegex = /\[(\d{1,3}:\d{2}(?::\d{2})?)(?:\s*-\s*(\d{1,3}:\d{2}(?::\d{2})?))?\s*-\s*([a-zA-Z0-9_-]{11})\]/g;
      
      // Also try simple timestamps without video reference
      const simpleTimestampRegex = /\[(\d{1,3}:\d{2}(?::\d{2})?)(?:\s*-\s*(\d{1,3}:\d{2}(?::\d{2})?))?\]/g;
      
      console.log('Extracting video references from:', content.substring(0, 200));
      
      // Try new format
      let match;
      let foundAny = false;
      while ((match = newFormatRegex.exec(content)) !== null) {
        foundAny = true;
        const startTime = match[1];
        const endTime = match[2];
        const videoTitle = match[3];
        const timestamp = endTime ? `${startTime} - ${endTime}` : startTime;
        
        // Find video by title
        const video = channelVideos.find(v => v.title === videoTitle);
        if (video) {
          const videoId = video.youtube_id;
          if (!videoRefs.has(videoId)) {
            videoRefs.set(videoId, new Set());
          }
          videoRefs.get(videoId)!.add(timestamp);
        }
      }
      
      // If no new format citations found, try old format
      if (!foundAny) {
        while ((match = oldFormatRegex.exec(content)) !== null) {
          foundAny = true;
          const startTime = match[1];
          const endTime = match[2];
          const videoId = match[3];
          const timestamp = endTime ? `${startTime} - ${endTime}` : startTime;
          
          if (!videoRefs.has(videoId)) {
            videoRefs.set(videoId, new Set());
          }
          videoRefs.get(videoId)!.add(timestamp);
        }
      }
      
      // If still no citations found, just extract timestamps and try to match with video mentions
      if (!foundAny && channelVideos.length > 0) {
        console.log('No formatted citations found, extracting simple timestamps');
        const timestamps: Array<{timestamp: string, position: number}> = [];
        
        // Reset regex
        simpleTimestampRegex.lastIndex = 0;
        
        while ((match = simpleTimestampRegex.exec(content)) !== null) {
          const startTime = match[1];
          const endTime = match[2];
          const timestamp = endTime ? `${startTime} - ${endTime}` : startTime;
          timestamps.push({ timestamp, position: match.index });
        }
        
        console.log('Found timestamps:', timestamps);
        
        if (timestamps.length > 0) {
          // Try to associate timestamps with videos based on nearby text mentions
          timestamps.forEach(({ timestamp, position }) => {
            // Look for video title mentions near this timestamp (within 200 chars)
            const contextStart = Math.max(0, position - 200);
            const contextEnd = Math.min(content.length, position + 200);
            const context = content.substring(contextStart, contextEnd).toLowerCase();
            
            // Find which video is mentioned in the context
            let matchedVideo = null;
            for (const video of channelVideos) {
              // Check if video title or parts of it appear in the context
              const titleWords = video.title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
              const matchCount = titleWords.filter((word: string) => context.includes(word)).length;
              if (matchCount >= Math.min(2, titleWords.length)) {
                matchedVideo = video;
                break;
              }
            }
            
            // If we found a matching video, add the timestamp
            if (matchedVideo) {
              const videoId = matchedVideo.youtube_id;
              if (!videoRefs.has(videoId)) {
                videoRefs.set(videoId, new Set());
              }
              videoRefs.get(videoId)!.add(timestamp);
            } else {
              // If no specific video found, add to the first video as fallback
              const firstVideo = channelVideos[0];
              if (firstVideo) {
                if (!videoRefs.has(firstVideo.youtube_id)) {
                  videoRefs.set(firstVideo.youtube_id, new Set());
                }
                videoRefs.get(firstVideo.youtube_id)!.add(timestamp);
              }
            }
          });
        }
      }
      
      console.log('Extracted references:', videoRefs);
      return videoRefs;
    };
    
    // Process all assistant messages to extract referenced videos
    const allRefs = new Map<string, ReferencedVideo>();
    
    console.log('Processing messages for video references:', messages.length);
    
    messages.forEach(msg => {
      if (msg.role === 'assistant' && msg.content) {
        console.log('Processing assistant message:', msg.content.substring(0, 300));
        const refs = extractVideoReferences(msg.content);
        
        refs.forEach((timestamps, videoId) => {
          console.log('Processing video references:', { videoId, timestamps: Array.from(timestamps) });
          
          if (!allRefs.has(videoId)) {
            // Find video info from channel videos if available
            const videoInfo = channelVideos.find(v => v.youtube_id === videoId);
            console.log('Found video info:', videoInfo);
            
            allRefs.set(videoId, {
              videoId,
              title: videoInfo?.title || `Video ${videoId}`,
              thumbnail: videoInfo?.thumbnail_url || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
              citations: Array.from(timestamps).map(ts => ({ timestamp: ts }))
            });
          } else {
            // Add new timestamps to existing video
            const existing = allRefs.get(videoId)!;
            timestamps.forEach(ts => {
              if (!existing.citations.some(c => c.timestamp === ts)) {
                existing.citations.push({ timestamp: ts });
              }
            });
          }
        });
      }
    });
    
    setReferencedVideos(allRefs);
    
    // Notify parent component about referenced videos
    if (onReferencedVideosUpdate) {
      console.log('Calling onReferencedVideosUpdate with:', allRefs.size, 'videos');
      onReferencedVideosUpdate(allRefs);
    }
  }, [messages, channelId, channelVideos]);

  // Fetch channel videos when channelId is provided
  useEffect(() => {
    if (channelId) {
      const fetchChannelVideos = async () => {
        try {
          const response = await fetch(`/api/channels/${channelId}/videos`);
          if (response.ok) {
            const data = await response.json();
            console.log('Fetched channel videos:', data.videos);
            setChannelVideos(data.videos || []);
          }
        } catch (error) {
          console.error('Failed to fetch channel videos:', error);
        }
      };
      fetchChannelVideos();
    }
  }, [channelId]);

  // Fetch today's message count
  useEffect(() => {
    const fetchMessageCount = async () => {
      try {
        console.log('🔍 Fetching message count...');
        console.log('User signed in:', isSignedIn);
        console.log('User ID:', user?.id);
        console.log('AnonId:', anonId);
        
        const headers: any = {};
        if (!isSignedIn && anonId) {
          headers['x-anon-id'] = anonId;
          console.log('📤 Sending anon_id in header:', anonId);
        }
        
        const response = await fetch('/api/user/message-count', { headers });
        const data = await response.json();
        console.log('📊 Message count response:', data);
        console.log('📊 Count value:', data.count);
        console.log('📊 Setting todayMessageCount to:', data.count || 0);
        setTodayMessageCount(data.count || 0);
        setMessageCountLoaded(true);
        
        // Log current state after setting
        setTimeout(() => {
          console.log('📊 State check - todayMessageCount should be:', data.count || 0);
        }, 100);
      } catch (error) {
        console.error('❌ Failed to fetch message count:', error);
        setMessageCountLoaded(true); // Still mark as loaded to unblock UI
      }
    };

    // Fetch immediately on mount and when auth changes
    fetchMessageCount();
  }, [isSignedIn, user?.id]); // Simplified dependencies

  // Refetch message count after each message
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant') {
        // Refetch count after getting a response
        const headers: any = {};
        if (!isSignedIn && anonId) {
          headers['x-anon-id'] = anonId;
        }
        fetch('/api/user/message-count', { headers })
          .then(res => res.json())
          .then(data => {
            console.log('📊 Updated message count after response:', data.count);
            setTodayMessageCount(data.count || 0);
          })
          .catch(err => console.error('Failed to refresh message count:', err));
      }
    }
  }, [messages.length]); // Trigger when messages array changes

  // Initialize session on component mount
  useEffect(() => {
    if (!isSignedIn) {
      // For anonymous users, get or create device-based anon ID
      import('./../../lib/session').then(async ({ getOrCreateDeviceAnonId }) => {
        const deviceAnonId = await getOrCreateDeviceAnonId();
        setAnonId(deviceAnonId);
        console.log('🔐 Using device-based anon ID:', deviceAnonId);
        
        // Fetch message count for anonymous user
        const headers = { 'x-anon-id': deviceAnonId };
        fetch('/api/user/message-count', { headers })
          .then(res => res.json())
          .then(data => {
            setTodayMessageCount(data.count || 0);
        setMessageCountLoaded(true);
            console.log('📊 Initial message count for anon user:', data.count);
          })
          .catch(err => console.error('Failed to fetch initial message count:', err));
      });
    }
  }, [isSignedIn]);

  // Auto-search with initial question from URL parameter
  useEffect(() => {
    if (initialQuestion && initialQuestion.trim() && !autoSearchExecuted && videoId) {
      console.log('Auto-search triggered for:', initialQuestion);
      setAutoSearchExecuted(true);
      
      // Check if user has already exceeded limit before auto-searching
      const dailyLimit = rateLimitData?.daily.limit || getDailyLimit();
      if (todayMessageCount >= dailyLimit) {
        console.log('🚫 Auto-search blocked: Daily limit exceeded');
        const limitMessage: ChatMessage = {
          id: Date.now().toString(),
          session_id: '',
          role: 'assistant',
          content: `You've reached your daily limit of ${dailyLimit} messages. Please try again tomorrow.`,
          created_at: new Date().toISOString(),
        };
        setMessages([limitMessage]);
        return;
      }
      
      // Set up the initial message first
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        session_id: '',
        role: 'user',
        content: initialQuestion.trim(),
        created_at: new Date().toISOString(),
      };
      
      setMessages([userMessage]);
      setInput('');
    }
  }, [initialQuestion, videoId, autoSearchExecuted, todayMessageCount, rateLimitData]);

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
          const timestampRegex = /\[(\d{1,3}:\d{2}(?::\d{2})?)(?:\s*-\s*(\d{1,3}:\d{2}(?::\d{2})?))?]/g;
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
  }, [messages]);

  const handleAutoSearch = async (query: string) => {
    if (!query.trim() || isLoading) return;
    if (!videoId && !channelId) return;
    
    // Check rate limit before processing auto-search
    const dailyLimit = rateLimitData?.daily.limit || getDailyLimit();
    if (todayMessageCount >= dailyLimit) {
      console.log('🚫 Auto-search blocked in handleAutoSearch: Daily limit exceeded');
      setIsLoading(false);
      return;
    }

    // Wait for anonId if not signed in
    let currentAnonId = anonId;
    if (!isSignedIn && !currentAnonId) {
      console.log('⏳ Waiting for anon ID...');
      // Try once more to get the anon ID
      const { getOrCreateDeviceAnonId } = await import('./../../lib/session');
      currentAnonId = await getOrCreateDeviceAnonId();
      setAnonId(currentAnonId);
      console.log('🔐 Got anon ID:', currentAnonId);
    }

    try {
      setConnectionError(null);
      
      console.log('📤 Sending chat request:', { query, videoId, channelId, sessionId, anonId: currentAnonId });
      
      // Use channel endpoint if channelId is provided, otherwise use regular video endpoint
      const endpoint = channelId ? '/api/chat-channel-stream' : '/api/chat-stream';
      const body = channelId 
        ? {
            message: query,
            channelId,
            sessionId,
            anonId: currentAnonId || anonId
          }
        : {
            query,
            videoId,
            messages: messages.slice(-5), // Keep last 5 messages for context
            sessionId,
            anonId: currentAnonId || anonId, // Use currentAnonId if we just fetched it
            threadId: sessionId // For streaming endpoint
          };
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      console.log('📥 Response status:', response.status, response.statusText);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle rate limit
        if (response.status === 429) {
          const limitMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            session_id: sessionId || '',
            role: 'assistant',
            content: errorData.error || 'Rate limit exceeded',
            created_at: new Date().toISOString(),
          };
          setMessages(prev => [...prev, limitMessage]);
          setIsLoading(false);
          
          // Show toast for rate limit errors
          const messageCount = errorData.messageCount || todayMessageCount;
          const limit = errorData.limit || rateLimitData?.daily.limit || getDailyLimit();
          
          toast.error(`Daily limit exceeded! You've sent ${messageCount} out of ${limit} messages today.`, {
            duration: 5000,
            position: 'top-center',
            style: {
              background: 'rgb(127 29 29)',
              color: 'white',
              border: '1px solid rgb(185 28 28)',
            },
          });
          
          // Update local message count if server provided it
          if (errorData.messageCount) {
            setTodayMessageCount(errorData.messageCount);
          }
          
          return;
        }
        
        const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      // Check if it's a streaming response
      const contentType = response.headers.get('content-type');
      const isStreaming = contentType?.includes('text/plain');
      
      if (isStreaming) {
        // Handle streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let assistantMessage = '';
        
        // Get session ID from headers
        const newSessionId = response.headers.get('X-Session-ID');
        if (newSessionId && !sessionId) {
          setSessionId(newSessionId);
          
          // Update URL to include session ID
          const newParams = new URLSearchParams(searchParams);
          newParams.delete('q'); // Remove query param if it exists
          newParams.set('session', newSessionId);
          const newUrl = `${pathname}?${newParams.toString()}`;
          router.replace(newUrl, { scroll: false });
        }
        
        // Get video mapping from headers for channel chat
        const videoMappingHeader = response.headers.get('X-Video-Mapping');
        let videoMapping: Record<string, { videoId: string; title: string }> = {};
        if (videoMappingHeader) {
          try {
            // Decode the URI-encoded header first
            const decodedMapping = decodeURIComponent(videoMappingHeader);
            videoMapping = JSON.parse(decodedMapping);
            console.log('📺 Video mapping from API:', videoMapping);
          } catch (e) {
            console.error('Failed to parse video mapping:', e);
          }
        }
        
        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          session_id: newSessionId || sessionId || '',
          role: 'assistant',
          content: '',
          created_at: new Date().toISOString(),
          videoMapping // Include video mapping from headers
        };
        
        setMessages(prev => [...prev, assistantMsg]);
        
        if (reader) {
          let firstChunkReceived = false;
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            assistantMessage += chunk;
            
            // Hide loading spinner after first chunk
            if (!firstChunkReceived && chunk.length > 0) {
              firstChunkReceived = true;
              setIsLoading(false);
            }
            
            // Update the last message with streaming content
            setMessages(prev => {
              const newMessages = [...prev];
              newMessages[newMessages.length - 1] = {
                ...assistantMsg,
                content: assistantMessage,
                videoMapping // Add video mapping to message
              };
              return newMessages;
            });
          }
        }
        
        // Update rate limit from headers
        const rateLimitData = {
          hourly: {
            limit: parseInt(response.headers.get('X-RateLimit-Limit-Hourly') || '30'),
            remaining: parseInt(response.headers.get('X-RateLimit-Remaining-Hourly') || '29'),
            resetTime: new Date(parseInt(response.headers.get('X-RateLimit-Reset-Hourly') || '0') * 1000)
          },
          daily: {
            limit: parseInt(response.headers.get('X-RateLimit-Limit-Daily') || '30'),
            remaining: parseInt(response.headers.get('X-RateLimit-Remaining-Daily') || '29'),
            resetTime: new Date(parseInt(response.headers.get('X-RateLimit-Reset-Daily') || '0') * 1000)
          }
        };
        updateFromResponse({ rateLimit: rateLimitData });
      } else {
        // Non-streaming response (cached or error)
        const data = await response.json();

        // Update session ID if returned from server
        if (data.sessionId && !sessionId) {
          setSessionId(data.sessionId);
        }

        // Update rate limit data from response
        updateFromResponse(data);

        // Update session info if provided
        if (data.sessionInfo) {
          setSessionInfo(data.sessionInfo);
        }

        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          session_id: data.sessionId || '',
          role: 'assistant',
          content: data.response,
          citations: data.citations,
          created_at: new Date().toISOString(),
        };

        setMessages(prev => [...prev, assistantMessage]);
        setIsLoading(false);
        
        // Refresh message count after getting response
        const headers: any = {};
        if (!isSignedIn && anonId) {
          headers['x-anon-id'] = anonId;
        }
        fetch('/api/user/message-count', { headers })
          .then(res => res.json())
          .then(data => {
            setTodayMessageCount(data.count || 0);
            setMessageCountLoaded(true);
          })
          .catch(err => console.error('Failed to refresh message count:', err));
      }
    } catch (error) {
      console.error('❌ Chat error:', error);
      console.error('❌ Error type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('❌ Error message:', error instanceof Error ? error.message : String(error));
      let errorMessage = handleApiError(error);
      
      // Check if there's a more specific error message from the API
      if (error instanceof Error && error.message.includes('500')) {
        try {
          // Try to parse the error response for more details
          const match = error.message.match(/\{.*\}/);
          if (match) {
            const errorData = JSON.parse(match[0]);
            if (errorData.details) {
              errorMessage = `${errorData.error}: ${errorData.details}`;
            } else if (errorData.error) {
              errorMessage = errorData.error;
            }
          }
        } catch (e) {
          // Keep the original error message if parsing fails
        }
      }
      
      // Set connection error for display
      setConnectionError(errorMessage);
      
      const assistantErrorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        session_id: sessionId || '',
        role: 'assistant',
        content: `I encountered an error: ${errorMessage}`,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantErrorMessage]);
    } finally {
      setIsLoading(false);
      
      // Refresh message count after any response (success or error)
      const headers: any = {};
      if (!isSignedIn && anonId) {
        headers['x-anon-id'] = anonId;
      }
      fetch('/api/user/message-count', { headers })
        .then(res => res.json())
        .then(data => setTodayMessageCount(data.count || 0))
        .catch(err => console.error('Failed to refresh message count:', err));
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    if (!videoId && !channelId) return;
    if (!messageCountLoaded) {
      console.log('⏳ Waiting for message count to load...');
      return;
    }
    
    // Check rate limit before sending - use actual message count
    const dailyLimit = rateLimitData?.daily.limit || getDailyLimit();
    if (todayMessageCount >= dailyLimit) {
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        session_id: sessionId || '',
        role: 'assistant',
        content: `⚠️ You've reached your daily limit of ${dailyLimit} messages. Please try again tomorrow.`,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
      setInput(''); // Clear the input so user knows their action was processed
      
      // Show visual feedback
      setShowLimitError(true);
      setTimeout(() => setShowLimitError(false), 3000); // Hide after 3 seconds
      
      // Show toast notification for better visibility
      toast.error(`Daily limit reached! You've sent ${todayMessageCount} out of ${dailyLimit} messages today.`, {
        duration: 5000,
        position: 'top-center',
        style: {
          background: 'rgb(127 29 29)',
          color: 'white',
          border: '1px solid rgb(185 28 28)',
        },
      });
      
      // Scroll to bottom to show the error message
      setTimeout(() => scrollToBottom(), 100);
      return;
    }

    // Ensure we have anonId for anonymous users
    let currentAnonId = anonId;
    if (!isSignedIn && !currentAnonId) {
      const { getOrCreateDeviceAnonId } = await import('./../../lib/session');
      currentAnonId = await getOrCreateDeviceAnonId();
      setAnonId(currentAnonId);
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      session_id: sessionId || '',
      role: 'user',
      content: input.trim(),
      created_at: new Date().toISOString(),
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

      {/* Session Usage Indicator */}
      {sessionInfo && sessionInfo.remaining < 5 && (
        <div className="bg-orange-500/10 border-l-4 border-orange-500 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-orange-600 dark:text-orange-400">
              {sessionInfo.remaining > 0 
                ? `${sessionInfo.remaining} messages remaining in this session`
                : 'Session limit reached'
              }
            </span>
            {!isSignedIn && sessionInfo.remaining > 0 && (
              <span className="text-xs text-muted-foreground">
                Sign in for higher limits
              </span>
            )}
          </div>
        </div>
      )}
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-background">
        {messages.length === 0 && (
          <div className="max-w-4xl mx-auto px-4 py-12 text-center">
            <div className="text-muted-foreground mb-6">
              <h3 className="text-lg font-medium mb-2">
                {channelId ? "Ask me anything about this channel!" : "Ask me anything about this video!"}
              </h3>
              <p className="text-sm">
                {channelId 
                  ? "I can help you explore topics across all videos in this channel."
                  : "I can help you understand the content, find specific information, or answer questions."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const question = channelId ? "What topics are covered in this channel?" : "What is this video about?";
                  const userMessage: ChatMessage = {
                    id: Date.now().toString(),
                    session_id: sessionId || '',
                    role: 'user',
                    content: question,
                    created_at: new Date().toISOString(),
                  };
                  setMessages([userMessage]);
                  setIsLoading(true);
                  handleAutoSearch(question);
                }}
                className="text-sm bg-background hover:bg-muted/50"
                disabled={isLoading}
              >
                {channelId ? "Topics covered" : "What is this video about?"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const question = "Give me the key takeaways";
                  const userMessage: ChatMessage = {
                    id: Date.now().toString(),
                    session_id: sessionId || '',
                    role: 'user',
                    content: question,
                    created_at: new Date().toISOString(),
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
                  const question = channelId ? "Give me insights from recent videos" : "Summarize the main points";
                  const userMessage: ChatMessage = {
                    id: Date.now().toString(),
                    session_id: sessionId || '',
                    role: 'user',
                    content: question,
                    created_at: new Date().toISOString(),
                  };
                  setMessages([userMessage]);
                  setIsLoading(true);
                  handleAutoSearch(question);
                }}
                className="text-sm bg-background hover:bg-muted/50"
                disabled={isLoading}
              >
                {channelId ? "Recent insights" : "Summarize"}
              </Button>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubbleInternal
            key={message.id}
            message={message}
            onCitationClick={onCitationClick}
            user={user}
            channelVideos={channelVideos}
          />
        ))}

        {isLoading && (
          <div className="max-w-4xl mx-auto px-4 py-6">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium text-primary">VAI</span>
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

      {/* Rate Limit Indicator */}
      <div className="px-4 py-3 border-t bg-background/50">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MessageCircle className="w-4 h-4" />
            <span>You&apos;re at <span className="font-semibold text-foreground">{todayMessageCount} / {rateLimitData?.daily.limit || getDailyLimit()}</span> free questions today</span>
          </div>
          
          {/* Rate Limit Error Banner */}
          {showLimitError && (
            <div className="mt-2 p-4 bg-red-100 dark:bg-red-950/40 border-2 border-red-500 dark:border-red-600 rounded-lg shadow-lg animate-pulse">
              <p className="text-sm font-semibold text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 animate-bounce" />
                Daily limit reached! You've used all {rateLimitData?.daily.limit || getDailyLimit()} messages for today.
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1 ml-7">
                Try again tomorrow or upgrade for more messages.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-t bg-background">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            <Textarea
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                
                // Remove ?q= parameter when user starts typing
                if (!urlCleanedRef.current && e.target.value.length > 0 && searchParams.get('q')) {
                  urlCleanedRef.current = true;
                  const newParams = new URLSearchParams(searchParams);
                  newParams.delete('q');
                  
                  // If we have a session ID, keep it in the URL
                  if (sessionId) {
                    newParams.set('session', sessionId);
                  }
                  
                  const newUrl = newParams.toString() ? `${pathname}?${newParams.toString()}` : pathname;
                  router.replace(newUrl, { scroll: false });
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                !messageCountLoaded
                  ? "Loading message count..."
                  : todayMessageCount >= (rateLimitData?.daily.limit || getDailyLimit())
                  ? `Daily limit reached (${rateLimitData?.daily.limit || getDailyLimit()} messages). Try again tomorrow.`
                  : sessionInfo?.remaining === 0 
                    ? "Session limit reached - start a new chat" 
                    : "What do you want to know next?"
              }
              disabled={isLoading || !messageCountLoaded || todayMessageCount >= (rateLimitData?.daily.limit || getDailyLimit())}
              className={`w-full resize-none border-0 bg-muted/50 rounded-xl p-4 pr-12 text-sm focus:ring-0 focus:outline-none focus:border-transparent focus:ring-transparent focus-visible:ring-0 focus-visible:ring-offset-0 hover:bg-muted/60 min-h-[60px] max-h-40 ${showLimitError ? 'animate-shake' : ''}`}
              rows={2}
            />
            <Button 
              onClick={sendMessage} 
              disabled={isLoading || !input.trim() || !messageCountLoaded || todayMessageCount >= (rateLimitData?.daily.limit || getDailyLimit())}
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
  user?: any;
}

interface MessageBubblePropsInternal extends MessageBubbleProps {
  channelVideos?: any[];
}

function MessageBubbleInternal({ message, onCitationClick, user, channelVideos = [] }: MessageBubblePropsInternal) {
  const isUser = message.role === 'user';

  const handleCitationClick = (timestamp: string, videoId?: string) => {
    if (videoId) {
      // For channel citations with video ID, open in new tab
      const firstTimestamp = timestamp.includes(' - ') ? timestamp.split(' - ')[0] : timestamp;
      const parts = firstTimestamp.split(':').map(Number);
      let seconds = 0;
      
      if (parts.length === 2) {
        seconds = parts[0] * 60 + parts[1];
      } else if (parts.length === 3) {
        seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
      
      window.open(`https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`, '_blank');
    } else if (onCitationClick) {
      // For regular video citations, use the callback
      onCitationClick(timestamp);
    }
  };

  const renderContentWithCitations = (content: string, _citations?: Citation[]) => {
    // Simple approach: directly process the content to replace timestamps
    const processTextWithTimestamps = (text: string) => {
      // Match multiple formats:
      // 1. [timestamp] "Video Title" - preferred channel format
      // 2. [timestamp] - fallback format
      // 3. [At timestamp]: - format from segments
      const timestampRegex = /\[(?:At\s+)?(\d{1,3}:\d{2}(?::\d{2})?)(?:\s*-\s*(\d{1,3}:\d{2}(?::\d{2})?))?\](?:\s*[""]([^""]+)[""])?/g;
      const parts = [];
      let lastIndex = 0;
      let match;
      
      while ((match = timestampRegex.exec(text)) !== null) {
        // Add text before timestamp
        if (match.index > lastIndex) {
          parts.push(text.slice(lastIndex, match.index));
        }
        
        // Extract parts
        const startTimestamp = match[1];
        const endTimestamp = match[2];
        const videoTitle = match[3];
        
        const displayText = endTimestamp 
          ? `${startTimestamp} - ${endTimestamp}` 
          : startTimestamp;
        
        // Find video ID from title if in channel mode
        let videoId: string | undefined;
        if (videoTitle && channelVideos.length > 0) {
          // Normalize titles for comparison (handle HTML entities, case, etc.)
          const normalizeTitle = (title: string) => {
            return title
              .toLowerCase()
              .replace(/&amp;/g, '&')
              .replace(/&#39;/g, "'")
              .replace(/&quot;/g, '"')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .trim();
          };
          
          const normalizedSearchTitle = normalizeTitle(videoTitle);
          const video = channelVideos.find(v => 
            normalizeTitle(v.title) === normalizedSearchTitle
          );
          
          if (!video) {
            console.warn(`Could not find video with title: "${videoTitle}"`);
            console.log('Available videos:', channelVideos.map(v => v.title));
          }
          
          videoId = video?.youtube_id;
        }
        
        parts.push(
          <button
            key={`ts-${match.index}-${startTimestamp}-${videoId || ''}`}
            onClick={() => handleCitationClick(displayText, videoId)}
            className="text-[#2D9CFF] hover:text-[#1E8AE6] underline font-mono text-sm inline-flex items-center px-1 py-0.5 mx-0.5 rounded hover:bg-[#2D9CFF]/10 transition-colors touch-manipulation"
            title={videoId ? `Open "${videoTitle}" at ${startTimestamp}` : `Jump to ${startTimestamp}`}
            style={{ minHeight: '24px' }} // Ensure minimum touch target size
          >
            [{displayText}]
          </button>
        );
        
        lastIndex = match.index + match[0].length;
      }
      
      // Add remaining text
      if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
      }
      
      return parts.length > 0 ? parts : text;
    };

    return (
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => {
            return <div className="mb-2">{React.Children.map(children, child => 
              typeof child === 'string' ? processTextWithTimestamps(child) : child
            )}</div>;
          },
          strong: ({ children }) => {
            return <strong className="font-semibold">{React.Children.map(children, child => 
              typeof child === 'string' ? processTextWithTimestamps(child) : child
            )}</strong>;
          },
          em: ({ children }) => {
            return <em>{React.Children.map(children, child => 
              typeof child === 'string' ? processTextWithTimestamps(child) : child
            )}</em>;
          },
          ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
          li: ({ children }) => {
            return <li className="mb-1">{React.Children.map(children, child => 
              typeof child === 'string' ? processTextWithTimestamps(child) : child
            )}</li>;
          },
          code: ({ children }) => <code className="bg-muted px-1 py-0.5 rounded text-sm">{children}</code>,
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
            <span className="text-xs font-medium text-primary">VAI</span>
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
            {new Date(message.created_at).toLocaleTimeString()}
          </div>
        </div>
        {isUser && (
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
            {user?.imageUrl ? (
              <img 
                src={user.imageUrl} 
                alt={user.fullName || 'User'} 
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xs font-medium">You</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}