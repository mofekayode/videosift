'use client';

import React, { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  User, 
  MessageSquare, 
  Users, 
  History,
  Settings,
  Crown,
  TrendingUp,
  Calendar,
  ChevronRight
} from 'lucide-react';
import { QuotaDashboard } from '@/components/dashboard/QuotaDashboard';
import { ChannelSelector } from '@/components/channels/ChannelSelector';
import { BetaMessaging } from '@/components/messaging/BetaMessaging';
import { useQuota } from '@/hooks/useQuota';
import Link from 'next/link';

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const [activeTab, setActiveTab] = useState('overview');
  const { quotaUsed, quotaLimit, channelsUsed, channelLimit, userType } = useQuota();

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Sign in required</h3>
              <p className="text-muted-foreground mb-4">
                Please sign in to access your dashboard
              </p>
              <Link href="/">
                <Button>Go to Home</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground">
                Welcome back, {user.firstName || user.emailAddresses[0]?.emailAddress}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="gap-1">
                <Crown className="w-3 h-3" />
                Free Plan
              </Badge>
              <Link href="/">
                <Button variant="outline">
                  Back to Home
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="usage">Usage & Quotas</TabsTrigger>
            <TabsTrigger value="channels">Channels</TabsTrigger>
            <TabsTrigger value="history">Chat History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Beta Messaging */}
            <BetaMessaging 
              quotaUsed={quotaUsed}
              quotaLimit={quotaLimit}
              channelsUsed={channelsUsed}
              channelLimit={channelLimit}
              userType={userType}
            />

            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Messages Today</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">12</div>
                  <p className="text-xs text-muted-foreground">
                    +20% from yesterday
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Channels Indexed</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">1</div>
                  <p className="text-xs text-muted-foreground">
                    Beta limit: 1 channel
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
                  <History className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">8</div>
                  <p className="text-xs text-muted-foreground">
                    Across all videos
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Member Since</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {new Date(user.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'short' })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(user.createdAt || Date.now()).getFullYear()}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Common tasks and features
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Link href="/">
                    <Button variant="outline" className="w-full justify-between h-auto p-4">
                      <div className="text-left">
                        <div className="font-medium">Chat with Video</div>
                        <div className="text-xs text-muted-foreground">Paste a YouTube URL</div>
                      </div>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-between h-auto p-4"
                    onClick={() => setActiveTab('channels')}
                  >
                    <div className="text-left">
                      <div className="font-medium">Manage Channels</div>
                      <div className="text-xs text-muted-foreground">Index new channels</div>
                    </div>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-between h-auto p-4"
                    onClick={() => setActiveTab('history')}
                  >
                    <div className="text-left">
                      <div className="font-medium">View History</div>
                      <div className="text-xs text-muted-foreground">Past conversations</div>
                    </div>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Your latest interactions
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Chatted about AI video</p>
                      <p className="text-xs text-muted-foreground">2 hours ago</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Users className="h-4 w-4 text-green-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Channel processing completed</p>
                      <p className="text-xs text-muted-foreground">1 day ago</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Account created</p>
                      <p className="text-xs text-muted-foreground">3 days ago</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usage">
            <QuotaDashboard />
          </TabsContent>

          <TabsContent value="channels">
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">Your Channels</h2>
                <p className="text-muted-foreground">
                  Manage your indexed YouTube channels
                </p>
              </div>
              <ChannelSelector />
            </div>
          </TabsContent>

          <TabsContent value="history">
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">Chat History</h2>
                <p className="text-muted-foreground">
                  View and continue your previous conversations
                </p>
              </div>
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Chat History Coming Soon</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      We're building a comprehensive chat history feature that will let you 
                      view, search, and continue your previous conversations.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}