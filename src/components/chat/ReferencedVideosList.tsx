'use client';

import React from 'react';
import { PlayCircle } from 'lucide-react';

interface ReferencedVideo {
  videoId: string;
  title: string;
  citations: Array<{
    timestamp: string;
    text?: string;
  }>;
  thumbnail?: string;
}

interface ReferencedVideosListProps {
  videos: ReferencedVideo[];
  currentVideo: { videoId: string; timestamp: number } | null;
  onVideoSelect: (videoId: string, timestamp: number) => void;
}

export function ReferencedVideosList({ videos, currentVideo, onVideoSelect }: ReferencedVideosListProps) {
  console.log('ReferencedVideosList render, videos:', videos.length);
  
  if (videos.length === 0) {
    return null;
  }
  
  return (
    <>
      <div className="mb-2">
        <h3 className="font-semibold text-sm">Referenced Videos</h3>
        <p className="text-xs text-muted-foreground mt-1">Click to play video at timestamp</p>
      </div>
      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {videos.map((video) => (
          <div 
            key={video.videoId} 
            className={`rounded-lg border transition-colors cursor-pointer ${
              currentVideo?.videoId === video.videoId 
                ? 'border-[#2D9CFF] bg-[#2D9CFF]/10' 
                : 'border-border bg-muted/20 hover:bg-muted/30'
            }`}
            onClick={() => {
              if (video.citations.length > 0) {
                const firstTimestamp = video.citations[0].timestamp;
                const parts = firstTimestamp.split(':').map(Number);
                let seconds = 0;
                if (parts.length === 2) {
                  seconds = parts[0] * 60 + parts[1];
                } else if (parts.length === 3) {
                  seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                }
                onVideoSelect(video.videoId, seconds);
              }
            }}
          >
            <div className="p-3 space-y-2">
              <div className="flex items-start gap-3">
                <div className="relative flex-shrink-0">
                  <img 
                    src={video.thumbnail} 
                    alt={video.title}
                    className="w-20 h-12 object-cover rounded"
                  />
                  <div className="absolute inset-0 bg-black/40 rounded flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <PlayCircle className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-medium line-clamp-2">{video.title}</h4>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {video.citations.length} citation{video.citations.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {video.citations.map((citation, idx) => (
                  <button
                    key={`${video.videoId}-${citation.timestamp}-${idx}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      const firstTimestamp = citation.timestamp.includes(' - ') ? citation.timestamp.split(' - ')[0] : citation.timestamp;
                      const parts = firstTimestamp.split(':').map(Number);
                      let seconds = 0;
                      
                      if (parts.length === 2) {
                        seconds = parts[0] * 60 + parts[1];
                      } else if (parts.length === 3) {
                        seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                      }
                      
                      onVideoSelect(video.videoId, seconds);
                    }}
                    className={`text-xs px-2 py-1 rounded font-mono transition-colors ${
                      currentVideo?.videoId === video.videoId 
                        ? 'bg-[#2D9CFF]/20 text-[#2D9CFF] hover:bg-[#2D9CFF]/30' 
                        : 'bg-background hover:bg-muted text-[#2D9CFF] hover:text-[#1E8AE6]'
                    }`}
                  >
                    {citation.timestamp}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}