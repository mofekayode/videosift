'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Rocket, Calendar, Sparkles, Building2, Upload, Search, Eye } from 'lucide-react';

interface RoadmapFeature {
  id: string;
  title: string;
  description: string;
  status: 'coming-soon' | 'in-development' | 'planned';
  icon: React.ReactNode;
  category: 'search' | 'enterprise' | 'upload' | 'ai' | 'multimodal';
  timeline: string;
}

const roadmapFeatures: RoadmapFeature[] = [
  {
    id: 'multi-channel-search',
    title: 'Multi-Channel Search',
    description: 'Search across multiple YouTube channels simultaneously for comprehensive insights.',
    status: 'in-development',
    icon: <Search className="h-5 w-5" />,
    category: 'search',
    timeline: 'Next 2 weeks'
  },
  {
    id: 'multimodal-search',
    title: 'Multimodal Search',
    description: 'Search what\'s actually happening in videos - analyze audio, visuals, and text together.',
    status: 'coming-soon',
    icon: <Eye className="h-5 w-5" />,
    category: 'multimodal',
    timeline: 'August 19th'
  },
  {
    id: 'file-upload',
    title: 'File Upload & Processing',
    description: 'Upload your own video files, PDFs, and documents for AI-powered analysis.',
    status: 'coming-soon',
    icon: <Upload className="h-5 w-5" />,
    category: 'upload',
    timeline: 'September 2nd'
  },
  {
    id: 'enterprise-features',
    title: 'Enterprise Solutions',
    description: 'Team workspaces, advanced analytics, custom integrations, and white-label options.',
    status: 'planned',
    icon: <Building2 className="h-5 w-5" />,
    category: 'enterprise',
    timeline: 'September 16th'
  }
];

const statusConfig = {
  'in-development': { label: 'In Development', color: 'bg-blue-500' },
  'coming-soon': { label: 'Coming Soon', color: 'bg-green-500' },
  'planned': { label: 'Planned', color: 'bg-yellow-500' }
};

const categoryConfig = {
  search: { label: 'Search & Discovery', color: 'bg-purple-100 text-purple-800' },
  multimodal: { label: 'Multimodal AI', color: 'bg-orange-100 text-orange-800' },
  upload: { label: 'Content Upload', color: 'bg-blue-100 text-blue-800' },
  enterprise: { label: 'Enterprise', color: 'bg-gray-100 text-gray-800' },
  ai: { label: 'AI Features', color: 'bg-green-100 text-green-800' }
};

interface RoadmapModalProps {
  trigger?: React.ReactNode;
}

export function RoadmapModal({ trigger }: RoadmapModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Rocket className="h-4 w-4" />
            Roadmap
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Rocket className="h-6 w-6 text-primary" />
            MindSift Roadmap
          </DialogTitle>
          <DialogDescription className="text-base">
            Exciting features coming soon to enhance your video analysis experience
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Current Status Banner */}
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Currently in Beta</CardTitle>
              </div>
              <CardDescription>
                We're actively building the future of video intelligence. Your feedback helps shape what comes next!
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roadmapFeatures.map((feature) => (
              <Card key={feature.id} className="group hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-primary/10 text-primary">
                        {feature.icon}
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold">
                          {feature.title}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge 
                            variant="secondary" 
                            className={categoryConfig[feature.category].color}
                          >
                            {categoryConfig[feature.category].label}
                          </Badge>
                          <div className="flex items-center gap-1">
                            <div 
                              className={`w-2 h-2 rounded-full ${statusConfig[feature.status].color}`}
                            />
                            <span className="text-xs text-muted-foreground">
                              {statusConfig[feature.status].label}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="text-sm mb-3">
                    {feature.description}
                  </CardDescription>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {feature.timeline}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Bottom CTA */}
          <Card className="mt-4 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
            <CardContent className="pt-6">
              <div className="text-center">
                <h3 className="font-semibold text-green-900 mb-2">
                  Want to influence our roadmap?
                </h3>
                <p className="text-sm text-green-700 mb-4">
                  Join our community and share your ideas for new features and improvements.
                </p>
                <div className="flex justify-center">
                  <Button 
                    size="sm" 
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => window.open('mailto:mofekayode@gmail.com?subject=MindSift Feedback&body=Hi! I have some feedback about MindSift:', '_blank')}
                  >
                    Send Feedback
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}