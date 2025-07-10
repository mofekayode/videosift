-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Users table (integrates with Clerk)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clerk_id TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Channels table
CREATE TABLE IF NOT EXISTS channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    youtube_channel_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    owner_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'error')),
    video_count INTEGER DEFAULT 0,
    total_duration INTEGER DEFAULT 0, -- in seconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Videos table
CREATE TABLE IF NOT EXISTS videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    youtube_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    duration INTEGER NOT NULL, -- in seconds
    thumbnail_url TEXT,
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    transcript_cached BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Video chunks for vector search
CREATE TABLE IF NOT EXISTS video_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    start_sec INTEGER NOT NULL,
    end_sec INTEGER NOT NULL,
    text TEXT NOT NULL,
    embedding VECTOR(1536), -- OpenAI embedding dimension
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Channel processing queue
CREATE TABLE IF NOT EXISTS channel_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
    requested_by UUID REFERENCES users(id) ON DELETE CASCADE,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    progress INTEGER DEFAULT 0 -- percentage 0-100
);

-- Chat sessions (optional for saving conversations)
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    title TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    citations JSONB, -- Store citation data as JSON
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_videos_youtube_id ON videos(youtube_id);
CREATE INDEX IF NOT EXISTS idx_videos_channel_id ON videos(channel_id);
CREATE INDEX IF NOT EXISTS idx_video_chunks_video_id ON video_chunks(video_id);
CREATE INDEX IF NOT EXISTS idx_video_chunks_channel_id ON video_chunks(channel_id);
CREATE INDEX IF NOT EXISTS idx_video_chunks_embedding ON video_chunks USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_channel_queue_status ON channel_queue(status);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid()::text = clerk_id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid()::text = clerk_id);

-- RLS Policies for channels
CREATE POLICY "Users can view own channels" ON channels
    FOR SELECT USING (owner_user_id IN (
        SELECT id FROM users WHERE clerk_id = auth.uid()::text
    ));

CREATE POLICY "Users can create channels" ON channels
    FOR INSERT WITH CHECK (owner_user_id IN (
        SELECT id FROM users WHERE clerk_id = auth.uid()::text
    ));

-- RLS Policies for videos (public read for single video chat)
CREATE POLICY "Videos are publicly readable" ON videos
    FOR SELECT USING (true);

CREATE POLICY "Channel owners can manage videos" ON videos
    FOR ALL USING (channel_id IN (
        SELECT c.id FROM channels c 
        JOIN users u ON c.owner_user_id = u.id 
        WHERE u.clerk_id = auth.uid()::text
    ));

-- RLS Policies for video chunks (public read for search)
CREATE POLICY "Video chunks are publicly readable" ON video_chunks
    FOR SELECT USING (true);

-- RLS Policies for channel queue
CREATE POLICY "Users can view own queue items" ON channel_queue
    FOR SELECT USING (requested_by IN (
        SELECT id FROM users WHERE clerk_id = auth.uid()::text
    ));

CREATE POLICY "Users can create queue items" ON channel_queue
    FOR INSERT WITH CHECK (requested_by IN (
        SELECT id FROM users WHERE clerk_id = auth.uid()::text
    ));

-- RLS Policies for chat sessions
CREATE POLICY "Users can view own chat sessions" ON chat_sessions
    FOR SELECT USING (user_id IN (
        SELECT id FROM users WHERE clerk_id = auth.uid()::text
    ));

CREATE POLICY "Users can create chat sessions" ON chat_sessions
    FOR INSERT WITH CHECK (user_id IN (
        SELECT id FROM users WHERE clerk_id = auth.uid()::text
    ));

-- RLS Policies for chat messages
CREATE POLICY "Users can view messages in own sessions" ON chat_messages
    FOR SELECT USING (session_id IN (
        SELECT cs.id FROM chat_sessions cs 
        JOIN users u ON cs.user_id = u.id 
        WHERE u.clerk_id = auth.uid()::text
    ));

CREATE POLICY "Users can create messages in own sessions" ON chat_messages
    FOR INSERT WITH CHECK (session_id IN (
        SELECT cs.id FROM chat_sessions cs 
        JOIN users u ON cs.user_id = u.id 
        WHERE u.clerk_id = auth.uid()::text
    ));

-- Functions for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_channels_updated_at BEFORE UPDATE ON channels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON videos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON chat_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();