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
  vector_store_id?: string;
  transcript_storage_path?: string;
  chunks_processed?: boolean;
  created_at: string;
}

export interface Channel {
  id: string;
  youtube_channel_id: string;
  title: string;
  owner_user_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  video_count?: number;
  last_indexed_at?: string;
  assistant_id?: string;
  vector_store_id?: string;
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

// Chat session types
export interface ChatSession {
  id: string;
  video_id?: string;  // For single video chats
  video_ids?: string; // JSON string for multi-video chats
  channel_id?: string; // For channel chats
  user_id?: string;  // null for anonymous users
  anon_id?: string;  // anonymous session identifier
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  created_at: string;
}

export interface Citation {
  timestamp: string;
  text: string;
  video_id?: string;
  video_title?: string;
}

// Client-side chat message (with Date timestamp for compatibility)
export interface ClientChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp: Date;
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
  session_id?: string;
  anon_id?: string;
  messages: ClientChatMessage[];
  query: string;
}

export interface ChatResponse {
  response: string;
  citations: Citation[];
}