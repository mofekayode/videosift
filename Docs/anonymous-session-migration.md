# Anonymous Session Migration

This document explains how anonymous user sessions are migrated to authenticated users when they sign in.

## Overview

When anonymous users interact with MindSift, their sessions are tracked using a device-specific fingerprint. When they sign in, we automatically migrate their chat history to their authenticated account.

## How It Works

### 1. Device Fingerprinting
- Anonymous users get a unique ID based on device characteristics
- ID format: `anon_device_{fingerprint}_{timestamp}`
- Stored in localStorage, sessionStorage, and cookies for redundancy

### 2. Automatic Migration on Sign In
- When a user signs in, the `ChatInterface` component triggers migration
- The `onUserSignIn` function is called automatically
- All sessions with the anonymous ID are transferred to the user

### 3. What Gets Migrated
- **Chat Sessions**: All conversations are preserved
- **Chat Messages**: Complete message history
- **Rate Limits**: Anonymous usage counts toward user limits (prevents abuse)

## Database Migration Function

```sql
migrate_anon_sessions_to_user(p_user_id UUID, p_anon_id TEXT)
```

This function:
1. Updates all sessions from `anon_id` to `user_id`
2. Merges rate limit counts
3. Logs the migration for auditing
4. Returns migration statistics

## Usage

### Automatic (Recommended)
Migration happens automatically when users sign in through the UI.

### Manual Migration
If needed, you can trigger migration manually:

#### From Client Components:
```typescript
import { migrateSessionsViaAPI } from '@/lib/migrate-sessions';

const result = await migrateSessionsViaAPI();
console.log(`Migrated ${result.sessions_migrated} sessions`);
```

#### From Server Components/API Routes:
```typescript
import { migrateAnonSessionsToUser } from '@/lib/migrate-sessions-server';

const result = await migrateAnonSessionsToUser(userId, anonId);
console.log(`Migrated ${result.sessions_migrated} sessions`);
```

### API Endpoint
```bash
POST /api/user/migrate-sessions
Authorization: Bearer <token>
Content-Type: application/json

{
  "anonId": "anon_device_abc123" // Optional, will use stored ID if not provided
}
```

## Benefits

1. **Seamless Experience**: Users don't lose their chat history when signing up
2. **Security**: Rate limits carry over, preventing abuse
3. **Transparency**: Users see their previous conversations preserved
4. **Audit Trail**: All migrations are logged for compliance

## Technical Details

- Migration is atomic (all-or-nothing transaction)
- Anonymous IDs are cleared after successful migration
- Failed migrations are logged but don't block sign-in
- Sessions can only be migrated once (idempotent)