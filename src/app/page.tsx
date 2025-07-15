'use client';

import { useState, useRef, useEffect } from 'react';
import { useBanner } from '@/contexts/BannerContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading';
import { handleApiError } from '@/components/ui/error';
import { extractVideoId, isValidYouTubeUrl, isValidYouTubeChannelUrl } from '@/lib/youtube';
import { AuthStatus } from '@/components/auth/AuthGuard';
import { BetaMessaging } from '@/components/messaging/BetaMessaging';
import { ChannelDropdown } from '@/components/channels/ChannelDropdown';
import { useQuota } from '@/hooks/useQuota';
import { trackEvent } from '@/lib/posthog';
import { SignInButton, useUser } from '@clerk/nextjs';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';

export default function Home() {
  const router = useRouter();
  const { isSignedIn, isLoaded, user } = useUser();
  const [activeTab, setActiveTab] = useState<'video' | 'channel'>('video');
  const [url, setUrl] = useState('');
  const [firstQuestion, setFirstQuestion] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidUrl, setIsValidUrl] = useState(false);
  const [videoPreview, setVideoPreview] = useState<{ title: string; thumbnail: string } | null>(null);
  const [isPreprocessing, setIsPreprocessing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { bannerVisible, showBanner } = useBanner();
  const questionRef = useRef<HTMLTextAreaElement>(null);
  
  // Real quota data
  const { quotaUsed, quotaLimit, channelsUsed, channelLimit, userType } = useQuota();

  // Prevent hydration issues by only rendering animations on client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleUrlChange = async (newUrl: string) => {
    setUrl(newUrl);
    setError(null);
    setVideoPreview(null);
    
    const trimmedUrl = newUrl.trim();
    let valid = false;
    
    if (activeTab === 'video') {
      valid = Boolean(trimmedUrl && isValidYouTubeUrl(trimmedUrl));
    } else {
      valid = Boolean(trimmedUrl && isValidYouTubeChannelUrl(trimmedUrl) && !isValidYouTubeUrl(trimmedUrl));
    }
    
    setIsValidUrl(valid);
    
    if (valid && activeTab === 'video') {
      // Track video URL pasted
      const videoId = extractVideoId(trimmedUrl);
      trackEvent('video_url_pasted', {
        video_id: videoId || undefined, // Convert null to undefined to satisfy TypeScript
        url: trimmedUrl
      });

      // Fetch video preview and start pre-processing
      try {
        if (videoId) {
          // Fetch video preview
          const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
          if (response.ok) {
            const data = await response.json();
            setVideoPreview({
              title: data.title,
              thumbnail: data.thumbnail_url
            });
            
            // Auto-focus the question input after video loads
            setTimeout(() => {
              questionRef.current?.focus();
            }, 100);
            
            // Start pre-processing in the background (non-blocking)
            (async () => {
              try {
                console.log('🚀 Starting background pre-processing for:', trimmedUrl);
                
                // Pre-download metadata
                const metadataResponse = await fetch('/api/video/metadata', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ url: trimmedUrl }),
                });
                
                if (metadataResponse.ok) {
                  const metadataResult = await metadataResponse.json();
                  console.log('✅ Video metadata pre-loaded:', metadataResult);
                  
                  // If video was created/found, try to pre-download transcript in background
                  if (metadataResult.data?.video) {
                    console.log('🔄 Pre-downloading transcript in background...');
                    fetch('/api/video/transcript', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ videoId: metadataResult.data.video.youtube_id }),
                    }).then(response => {
                      if (response.ok) {
                        console.log('✅ Transcript pre-loaded in background');
                      } else {
                        console.log('⚠️ Transcript pre-load failed');
                      }
                    }).catch(error => {
                      console.log('⚠️ Transcript pre-load error:', error);
                    });
                  }
                } else {
                  console.log('❌ Metadata pre-load failed');
                }
              } catch (error) {
                console.log('❌ Pre-processing failed:', error);
              }
            })();
          }
        }
      } catch (error) {
        console.log('Failed to fetch video preview:', error);
        setIsPreprocessing(false);
      }
    }
  };

  const handleStartChat = async () => {
    if (!url.trim()) {
      setError(activeTab === 'video' ? 'Please enter a YouTube video URL' : 'Please enter a YouTube channel URL');
      return;
    }

    const isVideo = isValidYouTubeUrl(url);
    const isChannel = isValidYouTubeChannelUrl(url);

    if (activeTab === 'video' && !isVideo) {
      setError('Please enter a valid YouTube video URL');
      return;
    }
    
    if (activeTab === 'channel' && (!isChannel || isVideo)) {
      setError('Please enter a valid YouTube channel URL');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Handle channel URLs differently
      if (isChannel && !isVideo) {
        // Check if user is signed in for channel processing
        if (!isSignedIn) {
          setError('Please sign in to index YouTube channels');
          setIsProcessing(false);
          return;
        }
        
        // Process channel
        const response = await fetch('/api/channel/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelUrl: url }),
        });

        const data = await response.json();

        if (response.ok) {
          if (data.alreadyProcessed) {
            toast.success(`Great news! "${data.channel.title}" is already indexed and ready to chat with.`);
          } else {
            toast.success(`Channel "${data.channel.title}" queued for processing. You'll receive an email when it's ready.`);
          }
          router.push('/dashboard?tab=channels');
        } else {
          setError(data.error || 'Failed to process channel');
          // Show quota exceeded message if applicable
          if (data.quotaExceeded) {
            toast.error(data.error);
          }
        }
      } else {
        // Process video (existing logic)
        const videoId = extractVideoId(url);
        if (!videoId) {
          setError('Please enter a valid YouTube URL');
          return;
        }

        // Navigate to watch page with the video ID
        const watchUrl = firstQuestion.trim() 
          ? `/watch/${videoId}?q=${encodeURIComponent(firstQuestion.trim())}`
          : `/watch/${videoId}`;
        
        console.log('Navigating to:', watchUrl, 'with question:', firstQuestion);
        router.push(watchUrl);
      }
    } catch (error) {
      console.error('Processing error:', error);
      setError(handleApiError(error));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartChatWithQuestion = async (question: string) => {
    if (!isValidYouTubeUrl(url) && !isValidYouTubeChannelUrl(url)) {
      setError('Please enter a valid YouTube video or channel URL');
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
      // Navigate to watch page with the video ID and question
      const watchUrl = `/watch/${videoId}?q=${encodeURIComponent(question.trim())}`;
      
      console.log('Navigating to:', watchUrl, 'with question:', question);
      router.push(watchUrl);
    } catch (error) {
      console.error('Navigation error:', error);
      setError(handleApiError(error));
      setIsProcessing(false);
    }
  };


  return (
    <>
      {/* Subtle Background Animation */}
      {isMounted && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <style jsx>{`
            @keyframes float {
              0%, 100% { transform: translateY(0px) rotate(0deg); }
              33% { transform: translateY(-20px) rotate(1deg); }
              66% { transform: translateY(-10px) rotate(-1deg); }
            }
            @keyframes float-slow {
              0%, 100% { transform: translateY(0px) translateX(0px) rotate(0deg); }
              25% { transform: translateY(-30px) translateX(10px) rotate(0.5deg); }
              50% { transform: translateY(-15px) translateX(-5px) rotate(-0.5deg); }
              75% { transform: translateY(-25px) translateX(5px) rotate(0.3deg); }
            }
            .animate-float {
              animation: float 12s ease-in-out infinite;
            }
            .animate-float-slow {
              animation: float-slow 20s ease-in-out infinite;
            }
          `}</style>
          
          {/* Large floating orbs */}
          <div className="absolute inset-0">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className={`absolute rounded-full bg-gradient-to-r from-purple-500/4 to-blue-500/4 animate-float-slow blur-xl`}
                style={{
                  width: `${Math.random() * 400 + 200}px`,
                  height: `${Math.random() * 400 + 200}px`,
                  left: `${Math.random() * 80 + 10}%`,
                  top: `${Math.random() * 80 + 10}%`,
                  animationDelay: `${Math.random() * 10}s`,
                }}
              />
            ))}
          </div>
          
          {/* Medium floating particles */}
          <div className="absolute inset-0">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`absolute rounded-full bg-gradient-to-r from-cyan-400/6 to-purple-400/6 animate-float blur-sm`}
                style={{
                  width: `${Math.random() * 150 + 80}px`,
                  height: `${Math.random() * 150 + 80}px`,
                  left: `${Math.random() * 90 + 5}%`,
                  top: `${Math.random() * 90 + 5}%`,
                  animationDelay: `${Math.random() * 15}s`,
                }}
              />
            ))}
          </div>
          
          {/* Small twinkling dots */}
          <div className="absolute inset-0">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className={`absolute rounded-full bg-gradient-to-r from-white/8 to-blue-200/8 animate-pulse`}
                style={{
                  width: `${Math.random() * 4 + 2}px`,
                  height: `${Math.random() * 4 + 2}px`,
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 5}s`,
                  animationDuration: `${Math.random() * 3 + 2}s`
                }}
              />
            ))}
          </div>
        </div>
      )}
      
      <div className={`min-h-screen flex items-start justify-center p-2 sm:p-4 transition-all duration-300 relative z-10 ${
        bannerVisible && showBanner ? 'pt-16' : 'pt-20'
      }`}>
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

        {/* Beta Messaging */}
        <BetaMessaging 
          quotaUsed={quotaUsed}
          quotaLimit={quotaLimit}
          channelsUsed={channelsUsed}
          channelLimit={channelLimit}
          userType={userType}
        />
        
        <Card className="overflow-visible">
          <CardHeader className="pb-3">
            <div className="flex space-x-1 border-b">
              <button
                onClick={() => {
                  setActiveTab('video');
                  setUrl('');
                  setFirstQuestion('');
                  setVideoPreview(null);
                  setIsValidUrl(false);
                  setError(null);
                }}
                className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                  activeTab === 'video'
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Chat with Video
                {activeTab === 'video' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
              <button
                onClick={() => {
                  setActiveTab('channel');
                  setUrl('');
                  setFirstQuestion('');
                  setVideoPreview(null);
                  setIsValidUrl(false);
                  setError(null);
                }}
                className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                  activeTab === 'channel'
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Chat with Channel
                {activeTab === 'channel' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeTab === 'video' ? (
              <>
                <div className="space-y-2">
                  <label htmlFor="youtube-url" className="text-sm font-medium">
                    Paste YouTube Video Link
                  </label>
                  <Input
                    id="youtube-url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    type="url"
                    value={url}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleStartChat();
                      }
                    }}
                    disabled={isProcessing}
                    className=""
                  />
                </div>
                
                {/* Question input and preview for video tab */}
                {isValidUrl && (
                  <>
                    <div className="space-y-2">
                      <label htmlFor="first-question" className="text-sm font-medium">
                        Ask Your First Question (Optional)
                      </label>
                      <Textarea
                        ref={questionRef}
                        id="first-question"
                        placeholder="Ask me anything about this video"
                        value={firstQuestion}
                        onChange={(e) => setFirstQuestion(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleStartChat();
                          }
                        }}
                        disabled={isProcessing}
                        rows={3}
                      />
                      
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            const question = 'Summarize this video';
                            setFirstQuestion(question);
                            handleStartChatWithQuestion(question);
                          }}
                          disabled={isProcessing}
                          className="text-xs"
                        >
                          Summarize this video
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            const question = 'Give me the key takeaways';
                            setFirstQuestion(question);
                            handleStartChatWithQuestion(question);
                          }}
                          disabled={isProcessing}
                          className="text-xs"
                        >
                          Key takeaways
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            const question = 'Explain the main points';
                            setFirstQuestion(question);
                            handleStartChatWithQuestion(question);
                          }}
                          disabled={isProcessing}
                          className="text-xs"
                        >
                          Main points
                        </Button>
                      </div>
                    </div>
                    
                    {videoPreview && (
                      <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg border shadow-sm animate-in fade-in-0">
                        <Image 
                          src={videoPreview.thumbnail} 
                          alt="Video thumbnail" 
                          width={64}
                          height={48}
                          className="w-16 h-12 object-cover rounded shadow-sm"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{videoPreview.title}</p>
                          <p className="text-xs text-green-600 dark:text-green-400">Transcript ready. Ask away.</p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                {isSignedIn ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Select a Channel to Chat With
                      </label>
                      <ChannelDropdown 
                        onChannelSelect={(channelId: string) => {
                          router.push(`/chat/channel/${channelId}`);
                        }}
                      />
                    </div>
                    
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">Or add new channel</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label htmlFor="channel-url" className="text-sm font-medium">
                        Add New YouTube Channel
                      </label>
                      <Input
                        id="channel-url"
                        placeholder="https://www.youtube.com/@channel or https://www.youtube.com/c/channelname"
                        type="url"
                        value={url}
                        onChange={(e) => handleUrlChange(e.target.value)}
                        onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleStartChat();
                      }
                    }}
                        disabled={isProcessing}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 space-y-4">
                    <p className="text-muted-foreground">
                      Sign in to chat with YouTube channels
                    </p>
                    <SignInButton mode="modal">
                      <Button>Sign In</Button>
                    </SignInButton>
                  </div>
                )}
              </>
            )}

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {error}
              </div>
            )}

            {activeTab === 'video' && isValidUrl && (
              <Button 
                className="w-full h-11" 
                onClick={handleStartChat}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Start Chatting'
                )}
              </Button>
            )}
            
            {activeTab === 'channel' && isValidYouTubeChannelUrl(url) && !isValidYouTubeUrl(url) && (
              <Button 
                className="w-full h-11" 
                onClick={handleStartChat}
                disabled={isProcessing || !isSignedIn}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  isSignedIn ? 'Index Channel' : 'Sign In to Index Channel'
                )}
              </Button>
            )}
            
            <div className="text-center space-y-3">
              {/* Only render auth-dependent content after mount to avoid hydration issues */}
              {isMounted && (
                <>
                  {/* Sign in button - only for non-signed-in users on video tab */}
                  {!user && activeTab === 'video' && (
                    <div className="flex justify-center">
                      <SignInButton mode="modal">
                        <Button variant="secondary" size="sm" className="text-sm">
                          Sign in to save chats & index channels
                        </Button>
                      </SignInButton>
                    </div>
                  )}

                  {/* Channels section - only for signed-in users */}
                  {user && (
                    <div className="flex justify-center">
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="text-sm"
                        onClick={() => router.push('/dashboard')}
                      >
                        Manage Channels & History
                      </Button>
                    </div>
                  )}
                </>
              )}
              
              {activeTab === 'video' && (
                <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                  <span>Need a video to try?</span>
                  <Button 
                    variant="link" 
                    size="sm"
                    onClick={() => handleUrlChange('https://www.youtube.com/watch?v=BHO_glbVcIg')}
                    className="p-0 h-auto text-sm text-primary hover:underline"
                  >
                    Use demo video
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </>
  );
}
