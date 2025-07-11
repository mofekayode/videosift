// Database types
export interface User {
  id: string;
  clerk_id: string;
  email: string;
  created_at: string;
}

export interface Video {
  id: string;
  youtube_id: string;
  title: string;
  description?: string;
  duration: number;
  thumbnail_url?: string;
  channel_id?: string;
  transcript_cached: boolean;
  created_at: string;
}

export interface Channel {
  id: string;
  youtube_channel_id: string;
  title: string;
  owner_user_id: string;
  status: 'pending' | 'processing' | 'ready' | 'error';
  created_at: string;
}

export interface VideoChunk {
  id: string;
  video_id: string;
  channel_id?: string;
  start_sec: number;
  end_sec: number;
  text: string;
  embedding?: number[];
  created_at: string;
}

export interface ChannelQueue {
  id: string;
  channel_id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  requested_by: string;
  requested_at: string;
  finished_at?: string;
  error_message?: string;
}

// Chat types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp: Date;
}

export interface Citation {
  timestamp: string;
  text: string;
  video_id?: string;
  video_title?: string;
}

// API types
export interface YouTubeMetadata {
  id: string;
  title: string;
  description: string;
  duration: number;
  thumbnail: string;
  channel_title: string;
  channel_id: string;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface ChatRequest {
  video_id?: string;
  channel_id?: string;
  messages: ChatMessage[];
  query: string;
}

export interface ChatResponse {
  response: string;
  citations: Citation[];
}