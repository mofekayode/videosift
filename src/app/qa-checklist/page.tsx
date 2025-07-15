'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface QAItem {
  id: string;
  category: string;
  title: string;
  description: string;
  steps?: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  completed: boolean;
}

const qaItems: QAItem[] = [
  // Authentication & User Management
  {
    id: 'auth-1',
    category: 'Authentication & User Management',
    title: 'Sign up flow',
    description: 'Test complete sign up process',
    steps: [
      'Sign up with email',
      'Verify email (if applicable)',
      'Check user is created in Clerk and Supabase',
      'Verify default quotas are assigned'
    ],
    priority: 'critical',
    completed: false
  },
  {
    id: 'auth-2',
    category: 'Authentication & User Management',
    title: 'Sign in/out',
    description: 'Test sign in and sign out functionality',
    priority: 'critical',
    completed: false
  },
  {
    id: 'auth-3',
    category: 'Authentication & User Management',
    title: 'Anonymous user experience',
    description: 'Test site functionality without signing in',
    steps: [
      'Browse videos',
      'Try to chat (should work with limits)',
      'Try to index channel (should require login)'
    ],
    priority: 'high',
    completed: false
  },

  // Video Processing
  {
    id: 'video-1',
    category: 'Video Processing',
    title: 'Index new video',
    description: 'Test indexing a YouTube video',
    steps: [
      'Paste YouTube URL',
      'Watch processing steps',
      'Verify video appears in dashboard',
      'Check transcript is processed'
    ],
    priority: 'critical',
    completed: false
  },
  {
    id: 'video-2',
    category: 'Video Processing',
    title: 'Video player functionality',
    description: 'Test all video player features',
    steps: [
      'Play/pause works',
      'Seeking works',
      'Volume control works',
      'Fullscreen works'
    ],
    priority: 'high',
    completed: false
  },
  {
    id: 'video-3',
    category: 'Video Processing',
    title: 'Timestamp navigation',
    description: 'Click timestamps in chat to jump to video position',
    priority: 'high',
    completed: false
  },

  // Chat Functionality
  {
    id: 'chat-1',
    category: 'Chat Functionality',
    title: 'Basic chat with video',
    description: 'Send messages and receive AI responses',
    priority: 'critical',
    completed: false
  },
  {
    id: 'chat-2',
    category: 'Chat Functionality',
    title: 'Chat history persistence',
    description: 'Refresh page and verify chat history remains',
    priority: 'high',
    completed: false
  },
  {
    id: 'chat-3',
    category: 'Chat Functionality',
    title: 'Continue previous chat',
    description: 'Click Continue on Recent Chats and verify history loads',
    priority: 'high',
    completed: false
  },
  {
    id: 'chat-4',
    category: 'Chat Functionality',
    title: 'Chat context awareness',
    description: 'Verify AI remembers previous messages in conversation',
    priority: 'high',
    completed: false
  },

  // Channel Processing
  {
    id: 'channel-1',
    category: 'Channel Processing',
    title: 'Index new channel',
    description: 'Test channel indexing process',
    steps: [
      'Paste channel URL',
      'Verify quota check (1 channel limit)',
      'Watch processing queue',
      'Receive completion email',
      'Verify channel appears in dashboard'
    ],
    priority: 'critical',
    completed: false
  },
  {
    id: 'channel-2',
    category: 'Channel Processing',
    title: 'Channel quota enforcement',
    description: 'Try to index 2nd channel as beta user (should fail)',
    priority: 'critical',
    completed: false
  },
  {
    id: 'channel-3',
    category: 'Channel Processing',
    title: 'Chat with channel',
    description: 'Test chatting across all videos in a channel',
    priority: 'high',
    completed: false
  },

  // Rate Limiting & Quotas
  {
    id: 'quota-1',
    category: 'Rate Limiting & Quotas',
    title: 'Chat message limits',
    description: 'Test rate limiting for chat messages',
    steps: [
      'Send multiple messages quickly',
      'Verify hourly limit enforcement',
      'Check error messages are clear'
    ],
    priority: 'high',
    completed: false
  },
  {
    id: 'quota-2',
    category: 'Rate Limiting & Quotas',
    title: 'Anonymous user limits',
    description: 'Test stricter limits for non-authenticated users',
    priority: 'medium',
    completed: false
  },
  {
    id: 'quota-3',
    category: 'Rate Limiting & Quotas',
    title: 'Quota display accuracy',
    description: 'Verify quota displays update correctly',
    priority: 'medium',
    completed: false
  },

  // Search & Discovery
  {
    id: 'search-1',
    category: 'Search & Discovery',
    title: 'Homepage video search',
    description: 'Search for videos using the search bar',
    priority: 'high',
    completed: false
  },
  {
    id: 'search-2',
    category: 'Search & Discovery',
    title: 'Ask a question flow',
    description: 'Use "Ask a question" to search and navigate to video',
    priority: 'high',
    completed: false
  },

  // Performance
  {
    id: 'perf-1',
    category: 'Performance',
    title: 'Page load times',
    description: 'Verify pages load within 3 seconds',
    steps: [
      'Test homepage',
      'Test /watch page',
      'Test /channels page',
      'Test dashboard'
    ],
    priority: 'medium',
    completed: false
  },
  {
    id: 'perf-2',
    category: 'Performance',
    title: 'Chat response time',
    description: 'AI responses should start streaming within 2-3 seconds',
    priority: 'high',
    completed: false
  },

  // Mobile Experience
  {
    id: 'mobile-1',
    category: 'Mobile Experience',
    title: 'Responsive design',
    description: 'Test all pages on mobile viewport',
    priority: 'high',
    completed: false
  },
  {
    id: 'mobile-2',
    category: 'Mobile Experience',
    title: 'Mobile video player',
    description: 'Verify video player works well on mobile',
    priority: 'high',
    completed: false
  },
  {
    id: 'mobile-3',
    category: 'Mobile Experience',
    title: 'Mobile chat interface',
    description: 'Test chatting on mobile devices',
    priority: 'high',
    completed: false
  },

  // Error Handling
  {
    id: 'error-1',
    category: 'Error Handling',
    title: 'Invalid video URLs',
    description: 'Test error messages for bad YouTube URLs',
    priority: 'medium',
    completed: false
  },
  {
    id: 'error-2',
    category: 'Error Handling',
    title: 'Network errors',
    description: 'Test behavior with slow/no internet',
    priority: 'low',
    completed: false
  },
  {
    id: 'error-3',
    category: 'Error Handling',
    title: 'API errors',
    description: 'Verify graceful handling of API failures',
    priority: 'medium',
    completed: false
  },

  // Email Notifications
  {
    id: 'email-1',
    category: 'Email Notifications',
    title: 'Channel completion email',
    description: 'Verify email is sent when channel processing completes',
    priority: 'medium',
    completed: false
  },

  // Dashboard
  {
    id: 'dash-1',
    category: 'Dashboard',
    title: 'Recent videos display',
    description: 'Verify recent videos show correctly',
    priority: 'medium',
    completed: false
  },
  {
    id: 'dash-2',
    category: 'Dashboard',
    title: 'Channel management',
    description: 'View and manage indexed channels',
    priority: 'medium',
    completed: false
  },
  {
    id: 'dash-3',
    category: 'Dashboard',
    title: 'Usage statistics',
    description: 'Verify usage stats are accurate',
    priority: 'low',
    completed: false
  }
];

export default function QAChecklistPage() {
  const [items, setItems] = useState<QAItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Load saved state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('qa-checklist');
    if (saved) {
      try {
        const savedItems = JSON.parse(saved);
        // Merge saved state with any new items
        const mergedItems = qaItems.map(item => {
          const savedItem = savedItems.find((s: QAItem) => s.id === item.id);
          return savedItem ? { ...item, completed: savedItem.completed } : item;
        });
        setItems(mergedItems);
      } catch (e) {
        setItems(qaItems);
      }
    } else {
      setItems(qaItems);
    }
  }, []);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (items.length > 0) {
      localStorage.setItem('qa-checklist', JSON.stringify(items));
    }
  }, [items]);

  const toggleItem = (id: string) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const resetAll = () => {
    if (confirm('Are you sure you want to reset all items?')) {
      setItems(qaItems);
      localStorage.removeItem('qa-checklist');
      toast.success('Checklist reset');
    }
  };

  const markAllComplete = () => {
    setItems(prev => prev.map(item => ({ ...item, completed: true })));
    toast.success('All items marked as complete');
  };

  // Calculate progress
  const totalItems = items.length;
  const completedItems = items.filter(item => item.completed).length;
  const progress = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  // Get unique categories
  const categories = ['all', ...Array.from(new Set(items.map(item => item.category)))];

  // Filter items
  const filteredItems = items.filter(item => {
    const statusMatch = filter === 'all' || 
      (filter === 'completed' && item.completed) || 
      (filter === 'pending' && !item.completed);
    
    const categoryMatch = categoryFilter === 'all' || item.category === categoryFilter;
    
    return statusMatch && categoryMatch;
  });

  // Group items by category
  const groupedItems = filteredItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, QAItem[]>);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
            <h1 className="text-3xl font-bold">QA Checklist</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetAll}>
              Reset All
            </Button>
            <Button variant="outline" size="sm" onClick={markAllComplete}>
              Mark All Complete
            </Button>
          </div>
        </div>

        {/* Progress */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Overall Progress</span>
                <span className="font-medium">{completedItems} / {totalItems} completed</span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-right">{progress.toFixed(0)}%</p>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All ({items.length})
            </Button>
            <Button
              variant={filter === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('pending')}
            >
              Pending ({items.filter(i => !i.completed).length})
            </Button>
            <Button
              variant={filter === 'completed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('completed')}
            >
              Completed ({items.filter(i => i.completed).length})
            </Button>
          </div>

          <select
            className="px-3 py-1 border rounded-md bg-background"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat}
              </option>
            ))}
          </select>
        </div>

        {/* Items grouped by category */}
        <div className="space-y-8">
          {Object.entries(groupedItems).map(([category, categoryItems]) => (
            <div key={category}>
              <h2 className="text-xl font-semibold mb-4">{category}</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {categoryItems.map(item => (
                  <Card key={item.id} className={item.completed ? 'opacity-60' : ''}>
                    <CardContent className="pt-6">
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={item.completed}
                            onCheckedChange={() => toggleItem(item.id)}
                            className="mt-1"
                          />
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className={`font-medium ${item.completed ? 'line-through' : ''}`}>
                                {item.title}
                              </h3>
                              <span className={`text-xs font-medium ${getPriorityColor(item.priority)}`}>
                                {item.priority}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                            
                            {item.steps && (
                              <div className="mt-2 space-y-1">
                                <p className="text-xs font-medium text-muted-foreground">Steps:</p>
                                <ul className="text-xs text-muted-foreground space-y-0.5 ml-4">
                                  {item.steps.map((step, i) => (
                                    <li key={i} className="list-disc">{step}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                          
                          {item.completed ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                          ) : (
                            <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>

        {filteredItems.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No items match your filters</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}