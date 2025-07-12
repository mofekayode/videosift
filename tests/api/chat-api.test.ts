import { test, expect } from '@playwright/test';

const API_BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Chat API Integration Tests', () => {
  test('POST /api/chat-simple - should handle missing parameters', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/chat-simple`, {
      data: {
        // Missing required fields
      }
    });
    
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('required');
  });

  test('POST /api/chat-simple - should handle video without vector store', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/chat-simple`, {
      data: {
        query: 'Test question',
        videoId: 'non_existent_video',
        messages: [],
        anonId: 'test_anon_123'
      }
    });
    
    expect([404, 503]).toContain(response.status());
    const body = await response.json();
    expect(body.error).toBeTruthy();
  });

  test('POST /api/chat-simple - should process valid request', async ({ request }) => {
    // This test requires a video with vector store in the database
    test.skip(!process.env.TEST_VIDEO_ID, 'Test video ID not configured');
    
    const response = await request.post(`${API_BASE}/api/chat-simple`, {
      data: {
        query: 'What is this video about?',
        videoId: process.env.TEST_VIDEO_ID,
        messages: [],
        anonId: 'test_anon_123'
      }
    });
    
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.response).toBeTruthy();
    expect(body.sessionId).toBeTruthy();
  });

  test('POST /api/video/transcript-quick - should handle invalid video ID', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/video/transcript-quick`, {
      data: {
        videoId: 'invalid_video_id_12345'
      }
    });
    
    expect([404, 500]).toContain(response.status());
    const body = await response.json();
    expect(body.error || body.success === false).toBeTruthy();
  });

  test('GET /api/user/message-count - should return count for anonymous', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/user/message-count`, {
      headers: {
        'x-anon-id': 'test_anon_123'
      }
    });
    
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('count');
    expect(typeof body.count).toBe('number');
  });

  test('Rate limiting should work', async ({ request }) => {
    test.skip(true, 'Rate limit testing requires special setup to avoid affecting other tests');
    
    // Would need to:
    // 1. Create a unique identifier
    // 2. Send requests up to the limit
    // 3. Verify 429 response after limit
    // 4. Clean up rate limit records
  });
});