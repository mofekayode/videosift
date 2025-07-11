'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlayCircle, ExternalLink, Users } from 'lucide-react';
import Link from 'next/link';

interface VideoSource {
  youtube_id: string;
  title: string;
  thumbnail_url?: string;
}

interface VideoSourcesProps {
  videoSources: VideoSource[];
  referencedVideos?: VideoSource[];
  compact?: boolean;
}

export function VideoSources({ videoSources, referencedVideos, compact = false }: VideoSourcesProps) {
  if (!videoSources?.length) return null;
  
  const displayVideos = referencedVideos?.length ? referencedVideos : videoSources;
  const showingReferencedOnly = Boolean(referencedVideos?.length);
  
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Users className="w-3 h-3" />
        <span>
          Sources: {displayVideos.length} video{displayVideos.length !== 1 ? 's' : ''}
          {showingReferencedOnly && videoSources.length > displayVideos.length && 
            ` (${videoSources.length - displayVideos.length} more available)`
          }
        </span>
      </div>
    );
  }
  
  return (
    <Card className="mt-3">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">
            Video Sources {showingReferencedOnly && '(Referenced)'}
          </span>
          {showingReferencedOnly && (
            <Badge variant="secondary" className="text-xs">
              {displayVideos.length} of {videoSources.length}
            </Badge>
          )}
        </div>
        
        <div className="grid gap-2">
          {displayVideos.map((video) => (
            <div
              key={video.youtube_id}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              {/* Thumbnail */}
              <div className="flex-shrink-0">
                {video.thumbnail_url ? (
                  <img
                    src={video.thumbnail_url}
                    alt={video.title}
                    className="w-16 h-12 object-cover rounded border"
                  />
                ) : (
                  <div className="w-16 h-12 bg-muted rounded border flex items-center justify-center">
                    <PlayCircle className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              
              {/* Video Info */}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium line-clamp-2 mb-1">
                  {video.title}
                </h4>
                <div className="flex items-center gap-2">
                  <Link href={`/watch/${video.youtube_id}`}>
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      <PlayCircle className="w-3 h-3 mr-1" />
                      Watch
                    </Button>
                  </Link>
                  <a
                    href={`https://youtube.com/watch?v=${video.youtube_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="ghost" size="sm" className="h-7 text-xs">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      YouTube
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {showingReferencedOnly && videoSources.length > displayVideos.length && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-muted-foreground text-center">
              + {videoSources.length - displayVideos.length} more video{videoSources.length - displayVideos.length !== 1 ? 's' : ''} in this search
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}