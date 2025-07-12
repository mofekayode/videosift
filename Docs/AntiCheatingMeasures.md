# Anti-Cheating Measures for Anonymous Rate Limiting

## Overview
We've implemented multiple layers of protection to prevent anonymous users from bypassing the 30 messages/day rate limit.

## 1. Device Fingerprinting
- **What**: Creates a unique identifier based on device characteristics
- **Components Used**:
  - User Agent
  - Screen resolution and color depth
  - Timezone and language
  - Platform (OS)
  - Hardware concurrency (CPU cores)
  - Device memory
  - WebGL renderer (GPU info)
  - Touch support
  - Browser plugins
- **Implementation**: `src/lib/device-fingerprint.ts`

## 2. Multiple Storage Mechanisms
- **localStorage**: Primary storage for device ID
- **sessionStorage**: Session-based backup
- **Cookies**: 1-year persistent cookies as fallback
- **Why**: Makes it harder to clear all traces

## 3. Server-Side Validation
- **IP-based rate limiting**: Falls back to IP address if no user ID
- **Device tracking in database**: Stores device fingerprint, IP, and user agent
- **Suspicious activity detection**: Monitors for:
  - Multiple devices from same IP (>3/day)
  - Rapid requests from same IP (>50/day)
  - Multiple anonymous IDs from same device (>5/day)

## 4. Database Schema Updates
```sql
-- Added to chat_sessions table:
- device_fingerprint TEXT
- client_ip TEXT  
- user_agent TEXT

-- New suspicious_activity table for monitoring
```

## 5. How It Works

### For Anonymous Users:
1. Device fingerprint is generated on first visit
2. Stored as `anon_device_<fingerprint>_<timestamp>`
3. Sent with every API request
4. Server validates against both device ID and IP address

### Prevention Mechanisms:
- **Clear localStorage**: Device fingerprint remains the same, IP tracking continues
- **Use incognito**: Device fingerprint similar, IP-based limits apply
- **Use VPN**: Device fingerprint remains, catches device-based abuse
- **Multiple devices**: Caught by IP-based tracking
- **Clear everything + VPN + different device**: Only way to bypass, but requires significant effort

## 6. Monitoring

The system logs suspicious activity to help identify patterns:
- Check `suspicious_activity` table for flagged behavior
- Monitor logs for device fingerprint mismatches
- Track IP addresses with unusual patterns

## 7. Future Enhancements

Consider adding:
1. **Browser fingerprinting libraries**: More sophisticated fingerprinting
2. **Behavioral analysis**: Track usage patterns (typing speed, mouse movements)
3. **CAPTCHA**: For suspicious IPs after X attempts
4. **Temporary bans**: Block IPs/devices with repeated violations
5. **Email verification**: For continued access after hitting limits

## Implementation Files
- `/src/lib/device-fingerprint.ts` - Device fingerprinting logic
- `/src/lib/session.ts` - Session management with device IDs
- `/src/app/api/chat-simple/route.ts` - Server-side validation
- `/supabase/migrations/20250111_add_device_tracking.sql` - Database schema

## Testing
To test the anti-cheating measures:
1. Try clearing localStorage and refreshing
2. Try using incognito mode
3. Try using a VPN
4. Monitor the `suspicious_activity` table for flagged behavior