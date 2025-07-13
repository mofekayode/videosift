# MindSift Authentication Flow and API Routes QA Documentation

## Overview

MindSift uses **Clerk** for authentication combined with **Supabase** for data storage. The application supports both anonymous and authenticated users with different feature sets and rate limits.

## Authentication Architecture

### 1. Authentication Provider
- **Primary Auth**: Clerk (handles user registration, login, sessions)
- **Data Storage**: Supabase (stores user data, chat history, channels, etc.)
- **User Sync**: Automatic sync between Clerk and Supabase via `ensureUserExists()` function

### 2. Middleware
- **Location**: `/src/middleware.ts`
- **Type**: Clerk middleware (`clerkMiddleware`)
- **Coverage**: All routes except static files
- **Special handling**: API routes always run through middleware

### 3. User Types

#### Anonymous Users
- **Identification**: IP address-based
- **Features**:
  - Basic video chat (10 messages per session)
  - Video metadata viewing
  - Limited rate limits (30 messages/day)
  - No chat history
  - No channel indexing

#### Authenticated Users (Free Tier)
- **Identification**: Clerk user ID + Supabase UUID
- **Features**:
  - Extended chat sessions (50 messages per session)
  - Chat history saved
  - Channel indexing (1 channel limit)
  - Video uploads (10/day)
  - Same rate limits as anonymous (30 messages/day)
  - Priority processing
  - Email notifications

#### Premium Users (Future)
- **Features**: Enhanced limits defined but not yet implemented
- **Planned**: 200 messages/day, 10 channels, 50 video uploads/day

## API Routes Analysis

### Public APIs (No Authentication Required)

#### 1. `/api/video/metadata`
- **Method**: POST
- **Purpose**: Fetch YouTube video metadata
- **Rate Limiting**: None
- **Features**: 
  - Caching support
  - Automatic video record creation in DB
  - Returns video title, duration, thumbnail

#### 2. `/api/chat-stream`
- **Method**: POST
- **Purpose**: Stream chat responses for video Q&A
- **Authentication**: Optional (enhanced features if authenticated)
- **Rate Limiting**: 
  - Anonymous: 30 messages/hour/day (IP-based)
  - Authenticated: 30 messages/hour/day (user-based)
- **Session Limits**:
  - Anonymous: 10 messages per session
  - Authenticated: 50 messages per session
- **Features**:
  - RAG-based search through video transcripts
  - Timestamp citations
  - Response caching
  - Session tracking (anonymous via anonId, authenticated via userId)

#### 3. `/api/video/transcript-quick`
- **Method**: POST
- **Purpose**: Process video transcript for chat
- **Authentication**: Not required
- **Features**:
  - Downloads YouTube captions
  - Chunks transcript for RAG
  - Creates embeddings
  - Stores in vector database

#### 4. `/api/waitlist/join`
- **Method**: POST
- **Purpose**: Join product waitlist
- **Authentication**: Not required

### Authenticated-Only APIs

#### 1. `/api/user/channels`
- **Method**: GET
- **Purpose**: List user's indexed channels
- **Authentication**: Required (returns 401 if not authenticated)
- **Response**: Array of user's channels with processing status

#### 2. `/api/channel/process`
- **Method**: POST
- **Purpose**: Index a YouTube channel
- **Authentication**: Required
- **Limits**: 1 channel for free users
- **Process**:
  - Validates YouTube channel URL
  - Creates channel record
  - Queues for background processing
  - Triggers automatic processing

#### 3. `/api/user/chat-history`
- **Method**: GET
- **Purpose**: Retrieve user's chat sessions
- **Authentication**: Required
- **Response**: List of chat sessions with messages

#### 4. `/api/user/usage-stats`
- **Method**: GET
- **Purpose**: Get user's rate limit and usage statistics
- **Authentication**: Optional (shows anonymous stats if not authenticated)
- **Response**: 
  - Current tier
  - Chat usage (hourly/daily)
  - Video upload usage
  - Channel processing usage (if authenticated)

#### 5. `/api/user/sync`
- **Method**: POST
- **Purpose**: Sync Clerk user with Supabase
- **Authentication**: Required
- **Process**: Creates/updates user record in Supabase

#### 6. `/api/user/migrate-sessions`
- **Method**: POST
- **Purpose**: Migrate anonymous sessions to authenticated user
- **Authentication**: Required
- **Features**: Transfers chat history from anonymous to authenticated account

### Admin/Debug APIs
- Located in `/api/debug/*` and `/api/admin/*`
- Include database status, error monitoring, cache stats
- Should be protected in production

## Rate Limiting System

### Configuration (from `/src/lib/rate-limit.ts`)

```typescript
QUOTA_CONFIG = {
  anonymous: {
    chat_messages_per_day: 30,
    chat_messages_per_hour: 30,
    video_uploads_per_day: 2,
  },
  user: {
    chat_messages_per_day: 30,
    chat_messages_per_hour: 30,
    video_uploads_per_day: 10,
    channels_per_user: 1,
  },
  premium: {
    chat_messages_per_day: 30,
    chat_messages_per_hour: 30,
    video_uploads_per_day: 50,
    channels_per_user: 10,
  }
}
```

### Implementation
- **Storage**: Supabase `rate_limits` table
- **Tracking**: By IP (anonymous) or User ID (authenticated)
- **Windows**: Hourly and daily
- **Headers**: Rate limit info returned in response headers

## Authentication Flow

### 1. Initial Page Load
```
User visits site → Clerk checks auth status → clerkMiddleware runs
```

### 2. Anonymous User Flow
```
No auth → Use IP for rate limiting → Limited features → Can upgrade via SignInButton
```

### 3. Sign Up/Sign In Flow
```
User clicks sign up → Clerk modal → Account creation → 
Auto sync to Supabase → Welcome email → Full features unlocked
```

### 4. User Sync Process (`ensureUserExists`)
```
Check Clerk auth → Get user ID → Check Supabase → 
If not exists: Create user record → Send welcome email
```

### 5. Session Migration
```
Anonymous user signs up → Detect anonymous sessions (via anonId) → 
Call migrate API → Transfer chat history → Update session ownership
```

## Security Considerations

1. **API Protection**: All user-specific APIs check Clerk authentication
2. **Data Isolation**: Supabase RLS ensures users only see their own data
3. **Rate Limiting**: Prevents abuse for both anonymous and authenticated users
4. **IP Tracking**: Used for anonymous rate limiting and security
5. **CORS**: Handled by Next.js automatically
6. **Webhook Security**: Clerk webhooks for user events at `/api/webhooks/clerk`

## Feature Comparison

| Feature | Anonymous | Authenticated (Free) | Premium (Planned) |
|---------|-----------|---------------------|-------------------|
| Chat with videos | ✅ (10 msg/session) | ✅ (50 msg/session) | ✅ (200 msg/session) |
| Daily message limit | 30 | 30 | 200 |
| Chat history | ❌ | ✅ | ✅ |
| Channel indexing | ❌ | ✅ (1 channel) | ✅ (10 channels) |
| Video uploads/day | 2 | 10 | 50 |
| Priority processing | ❌ | ✅ | ✅ |
| Email notifications | ❌ | ✅ | ✅ |
| API access | Limited | Full | Full |

## Testing Authentication

### Key Test Scenarios

1. **Anonymous Usage**
   - Chat without sign in
   - Hit rate limits
   - Session limits
   - Upgrade prompts

2. **Sign Up Flow**
   - New user registration
   - User sync to Supabase
   - Welcome email
   - Session migration

3. **Authenticated Features**
   - Channel indexing
   - Chat history
   - Usage stats
   - Rate limits

4. **Edge Cases**
   - Network failures during sync
   - Duplicate user prevention
   - Session migration conflicts
   - Rate limit edge cases

## Common Issues and Solutions

1. **User not syncing to Supabase**
   - Check `ensureUserExists` is called
   - Verify Clerk webhook is configured
   - Check Supabase connection

2. **Rate limits not working**
   - Verify IP detection logic
   - Check rate_limits table
   - Ensure increment functions are called

3. **Session migration failing**
   - Verify anonId is passed correctly
   - Check device fingerprinting
   - Review migration logic

4. **Authentication required errors**
   - Ensure Clerk middleware is running
   - Check auth() call in API routes
   - Verify user sync completed