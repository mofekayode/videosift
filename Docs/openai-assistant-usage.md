# OpenAI Assistant API Usage Guide

## Architecture Overview

We use OpenAI's Assistant API with Vector Stores for RAG (Retrieval Augmented Generation) instead of storing transcripts in our database.

### Benefits:
- No token limits - OpenAI handles chunking automatically
- Better search quality with OpenAI's embeddings
- Reduced database storage
- Automatic citation extraction

## Usage Patterns

### 1. Single Video Chat
```javascript
// Each video has its own vector store
const response = await chatWithAssistant(
  "What is discussed in this video?",
  video.vector_store_id, // Single ID
  threadId
);
```

### 2. Multi-Video Chat (up to 10 videos)
```javascript
// Pass array of vector store IDs
const response = await chatWithAssistant(
  "Compare these videos",
  [video1.vector_store_id, video2.vector_store_id, video3.vector_store_id],
  threadId
);
```

### 3. Channel Chat (Option 1: Individual Video Stores)
```javascript
// Get all videos in channel
const channelVideos = await getChannelVideos(channelId);
const vectorStoreIds = channelVideos
  .map(v => v.vector_store_id)
  .filter(Boolean)
  .slice(0, 10); // Max 10 stores

const response = await chatWithAssistant(
  "What topics does this channel cover?",
  vectorStoreIds,
  threadId
);
```

### 4. Channel Chat (Option 2: Single Channel Store) - Better!
```javascript
// Create one vector store for entire channel
const { vectorStoreId } = await createChannelVectorStore(
  channelId,
  channelName,
  videos.map(v => ({
    videoId: v.id,
    youtubeId: v.youtube_id,
    title: v.title,
    transcript: formatTranscriptForUpload(v.chunks)
  }))
);

// Use single store for all channel queries
const response = await chatWithAssistant(
  "What topics does this channel cover?",
  channelVectorStoreId, // Single channel store
  threadId
);
```

## Limitations

1. **Max 10 vector stores per search** - OpenAI limitation
   - Solution: Create channel-level stores for channels with many videos
   
2. **No chunk-level attribution** - Can't tell which specific video a fact came from
   - Solution: Assistant includes video titles in responses when citing

3. **Storage costs** - Each vector store has storage costs in OpenAI
   - Solution: Delete old/unused vector stores periodically

## Database Schema

### Videos Table
```sql
videos
- id
- youtube_id
- title
- vector_store_id (NEW) -- OpenAI vector store ID
- file_id (NEW)        -- OpenAI file ID
- transcript_cached    -- Boolean flag
```

### Channels Table (proposed addition)
```sql
channels
- id
- youtube_channel_id
- name
- vector_store_id     -- Single store for all channel videos
```

## Migration Path

1. For existing videos without vector stores:
   - Run migration script to upload transcripts to OpenAI
   - Update videos with vector_store_id

2. For channels:
   - Option A: Use individual video stores (limited to 10)
   - Option B: Create channel-level stores (recommended)

## API Endpoints

- `/api/video/transcript-quick` - Downloads transcript and creates vector store
- `/api/chat-simple` - Single video chat using vector store
- `/api/chat-multi-video` - Multi-video chat using array of vector stores
- `/api/chat-channel` - Channel chat (needs update for vector stores)