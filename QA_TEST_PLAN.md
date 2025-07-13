# MindSift - Comprehensive QA Test Plan

## Overview
MindSift is a web application that allows users to chat with YouTube videos and channels using AI. This test plan covers all features for both anonymous and signed-in users.

## Test Environment
- **Application URL**: [Production/Staging URL]
- **Supported Browsers**: Chrome, Firefox, Safari, Edge (latest versions)
- **Mobile Devices**: iOS Safari, Android Chrome
- **Test Data**: Demo video URL: https://www.youtube.com/watch?v=BHO_glbVcIg

## User Types & Permissions

### Anonymous Users
- Can chat with individual YouTube videos
- Limited to 30 messages per day
- Cannot save chat history
- Cannot index YouTube channels
- Messages tracked via anonymous ID in localStorage

### Signed-In Users
- All anonymous features plus:
- Can save and view chat history
- Can index YouTube channels (1 channel limit in beta)
- Can manage indexed channels
- Can view usage statistics in dashboard
- Messages tracked per user account

## Test Cases

### 1. Landing Page & Navigation

#### 1.1 Homepage Load
- **Steps**: Navigate to homepage
- **Expected**: 
  - MindSift title and tagline visible
  - Tab switcher shows "Chat with Video" and "Chat with Channel"
  - Auth status shows correctly (anonymous or user email)
  - Beta messaging displays with quota info
  - Background animation renders without performance issues

#### 1.2 Tab Switching
- **Steps**: Click between "Chat with Video" and "Chat with Channel" tabs
- **Expected**: 
  - Tab content switches correctly
  - URL field clears when switching
  - Error messages clear
  - Active tab indicator updates

#### 1.3 Demo Video Link
- **Steps**: Click "Use demo video" link
- **Expected**: 
  - Demo URL auto-fills in input field
  - Video preview loads with thumbnail
  - Question field becomes visible
  - Suggested questions appear

### 2. Anonymous User - Video Chat

#### 2.1 Valid Video URL Input
- **Steps**: 
  1. Paste valid YouTube URL (e.g., https://www.youtube.com/watch?v=BHO_glbVcIg)
  2. Wait for video preview
- **Expected**: 
  - Video thumbnail and title display
  - "Transcript ready" message appears
  - Question input field appears
  - Suggested question buttons show

#### 2.2 Invalid Video URL
- **Steps**: Enter invalid URLs:
  - Non-YouTube URL
  - Malformed YouTube URL
  - YouTube channel URL in video tab
- **Expected**: Error message "Please enter a valid YouTube video URL"

#### 2.3 Start Chat Without Question
- **Steps**: 
  1. Enter valid video URL
  2. Click "Start Chatting" without entering question
- **Expected**: Redirects to /watch/[videoId] page with chat interface

#### 2.4 Start Chat With Question
- **Steps**: 
  1. Enter valid video URL
  2. Type question in textarea
  3. Press Enter or click "Start Chatting"
- **Expected**: 
  - Redirects to /watch/[videoId]?q=[encoded-question]
  - Question automatically sent in chat

#### 2.5 Suggested Questions
- **Steps**: Click each suggested question button
- **Expected**: 
  - Question fills in textarea
  - Chat starts with that question
  - Redirects to watch page

#### 2.6 Message Quota
- **Steps**: Send 30 messages as anonymous user
- **Expected**: 
  - Quota indicator updates after each message
  - After 30 messages, quota exhausted message appears
  - Further messages blocked until next day

### 3. Anonymous User - Channel Features

#### 3.1 Channel Tab Access
- **Steps**: Click "Chat with Channel" tab as anonymous user
- **Expected**: 
  - "Sign in to chat with YouTube channels" message
  - Sign In button displayed
  - No channel input field shown

#### 3.2 Sign In Prompt
- **Steps**: Click Sign In button
- **Expected**: Clerk authentication modal opens

### 4. Video Watch Page (/watch/[id])

#### 4.1 Page Load
- **Steps**: Navigate to watch page with video ID
- **Expected**: 
  - Video player loads and displays
  - Chat interface appears on right/bottom
  - Video title shows
  - Loading states display during data fetch

#### 4.2 Video Player Controls
- **Steps**: Test video player functionality
- **Expected**: 
  - Play/pause works
  - Seeking works without stuttering
  - Volume controls functional
  - Fullscreen mode works

#### 4.3 Chat Interface
- **Steps**: Send various messages
- **Expected**: 
  - Messages appear in chat
  - AI responses stream in real-time
  - Timestamp citations display correctly
  - Loading indicators show during processing

#### 4.4 Video Sources Panel
- **Steps**: Click on timestamp citations
- **Expected**: 
  - Video seeks to referenced timestamp
  - Source highlights in transcript
  - Smooth playback without jerking

#### 4.5 Mobile Responsiveness
- **Steps**: Test on mobile device
- **Expected**: 
  - Video player stacks above chat
  - Chat interface remains usable
  - All controls accessible

### 5. Signed-In User - Authentication

#### 5.1 Sign In Flow
- **Steps**: 
  1. Click "Sign In" button
  2. Complete Clerk authentication
- **Expected**: 
  - Redirects back to app
  - User email displays in header
  - Dashboard link appears

#### 5.2 Sign Out
- **Steps**: Click user menu and sign out
- **Expected**: 
  - Returns to anonymous state
  - Chat history no longer accessible
  - Channel features disabled

### 6. Signed-In User - Dashboard

#### 6.1 Dashboard Access
- **Steps**: Navigate to /dashboard
- **Expected**: 
  - Dashboard loads with user greeting
  - Shows 4 tabs: Overview, Usage & Quotas, Channels, Chat History
  - Quick stats display correctly

#### 6.2 Overview Tab
- **Steps**: Review overview tab content
- **Expected**: 
  - Messages today count accurate
  - Channels indexed count (max 1)
  - Total conversations count
  - Member since date
  - Quick action buttons functional

#### 6.3 Usage & Quotas Tab
- **Steps**: Click Usage & Quotas tab
- **Expected**: 
  - Daily message limit: 30/30
  - Channel limit: 1/1
  - Visual progress indicators
  - Usage resets daily

#### 6.4 Chat History Tab
- **Steps**: 
  1. View chat history
  2. Click on previous conversation
- **Expected**: 
  - All past chats listed
  - Clicking chat reopens conversation
  - Messages preserved correctly
  - Can continue previous chats

### 7. Signed-In User - Channel Management

#### 7.1 Add New Channel
- **Steps**: 
  1. Go to Channels tab or homepage
  2. Enter valid channel URL (e.g., https://www.youtube.com/@channelname)
  3. Click "Index Channel"
- **Expected**: 
  - Success message with email notification promise
  - Channel appears in pending state
  - Only 1 channel allowed in beta

#### 7.2 Channel Processing Status
- **Steps**: Monitor channel processing
- **Expected**: 
  - Status shows: pending → processing → ready
  - Progress bar updates
  - Video count displays
  - Email notification when complete

#### 7.3 Process Pending Channels
- **Steps**: Click "Process Pending" button if available
- **Expected**: 
  - Processing starts for queued channels
  - Status updates in real-time
  - Cannot exceed 1 channel limit

#### 7.4 Delete Channel
- **Steps**: 
  1. Click trash icon on channel
  2. Confirm deletion
- **Expected**: 
  - Confirmation prompt appears
  - Channel removed from list
  - Can add new channel after deletion

#### 7.5 Channel Chat
- **Steps**: 
  1. Click on ready channel
  2. Send messages about channel content
- **Expected**: 
  - Redirects to /chat/channel/[id]
  - Can ask about any video in channel
  - Referenced videos list updates
  - Video player shows relevant clips

### 8. Error Handling & Edge Cases

#### 8.1 Network Errors
- **Steps**: Simulate network failure
- **Expected**: 
  - Appropriate error messages
  - Retry options available
  - No data loss

#### 8.2 Invalid Video IDs
- **Steps**: Navigate to /watch/[invalid-id]
- **Expected**: Error page with option to return home

#### 8.3 Quota Exceeded
- **Steps**: Exceed 30 message limit
- **Expected**: 
  - Clear quota exceeded message
  - Suggests signing in or waiting
  - Shows when quota resets

#### 8.4 Rate Limiting
- **Steps**: Send many requests rapidly
- **Expected**: 
  - Rate limit messages appear
  - Graceful degradation
  - No crashes

### 9. Performance Testing

#### 9.1 Page Load Times
- **Measure**: Time to interactive for each page
- **Expected**: < 3 seconds on 3G connection

#### 9.2 Chat Response Time
- **Measure**: Time from message send to AI response start
- **Expected**: < 2 seconds for response initiation

#### 9.3 Video Processing
- **Measure**: Time to process new video transcript
- **Expected**: < 30 seconds for average video

#### 9.4 Memory Usage
- **Test**: Long chat sessions (50+ messages)
- **Expected**: No memory leaks, smooth performance

### 10. Accessibility Testing

#### 10.1 Keyboard Navigation
- **Test**: Navigate entire app with keyboard only
- **Expected**: All interactive elements accessible

#### 10.2 Screen Reader
- **Test**: Use screen reader on all pages
- **Expected**: 
  - Proper ARIA labels
  - Logical reading order
  - Form labels announced

#### 10.3 Color Contrast
- **Test**: Check all text/background combinations
- **Expected**: WCAG AA compliance minimum

### 11. Cross-Browser Testing

#### 11.1 Chrome (Latest)
- Run all test suites
- Check dev tools console for errors

#### 11.2 Firefox (Latest)
- Run all test suites
- Verify video player compatibility

#### 11.3 Safari (Latest)
- Run all test suites
- Check iOS specific behaviors

#### 11.4 Edge (Latest)
- Run all test suites
- Verify no IE11 legacy issues

### 12. Mobile Testing

#### 12.1 Responsive Design
- **Breakpoints**: 320px, 768px, 1024px, 1440px
- **Expected**: Proper layout at each size

#### 12.2 Touch Interactions
- **Test**: All buttons, inputs, gestures
- **Expected**: Appropriate touch targets (44x44px min)

#### 12.3 Mobile Video Player
- **Test**: Video controls on mobile
- **Expected**: Native controls work properly

### 13. Security Testing

#### 13.1 Authentication
- **Test**: Access protected routes without auth
- **Expected**: Redirects to sign in

#### 13.2 Input Validation
- **Test**: XSS attempts in chat messages
- **Expected**: Inputs sanitized, no execution

#### 13.3 API Security
- **Test**: Direct API calls without auth
- **Expected**: 401/403 responses as appropriate

### 14. Beta-Specific Testing

#### 14.1 Beta Messaging
- **Verify**: Beta badges and limits displayed
- **Expected**: Clear communication of beta status

#### 14.2 Channel Limits
- **Test**: Try to add 2nd channel
- **Expected**: Clear limit message, prevented

#### 14.3 Launch Date References
- **Verify**: "August 5th" pro plan mentions
- **Expected**: Consistent messaging

## Test Execution Checklist

### Pre-Release Testing
- [ ] All anonymous user flows
- [ ] Sign up and sign in flows  
- [ ] Video chat functionality
- [ ] Channel indexing and chat
- [ ] Dashboard features
- [ ] Mobile responsiveness
- [ ] Performance benchmarks
- [ ] Security validations

### Regression Testing
- [ ] After each deployment
- [ ] Focus on critical paths
- [ ] Verify quota tracking
- [ ] Check video player stability

### User Acceptance Testing
- [ ] Real user testing sessions
- [ ] Feedback collection
- [ ] Performance monitoring
- [ ] Error tracking

## Bug Reporting Template

**Title**: [Brief description]
**Severity**: Critical/High/Medium/Low
**User Type**: Anonymous/Signed-In
**Steps to Reproduce**:
1. 
2. 
3. 

**Expected Result**:
**Actual Result**:
**Screenshots/Videos**:
**Browser/Device**:
**Additional Notes**:

## Metrics to Track

- Sign-up conversion rate
- Video processing success rate
- Average chat session length
- Message quota usage patterns
- Channel indexing completion rate
- Error rates by feature
- Page load performance
- User retention metrics