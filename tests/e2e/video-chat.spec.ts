import { test, expect } from '@playwright/test';

test.describe('Video Search and Chat Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the homepage', async ({ page }) => {
    // Check that the main elements are present
    await expect(page).toHaveTitle(/MindSift/);
    await expect(page.locator('h1')).toContainText('MindSift');
    await expect(page.locator('input[placeholder*="youtube.com/watch"]')).toBeVisible();
  });

  test('should search a video and start chat', async ({ page }) => {
    // Test video URL (use a short video with captions)
    const testVideoUrl = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'; // "Me at the zoo"
    
    // Enter video URL
    await page.fill('input[placeholder*="youtube.com/watch"]', testVideoUrl);
    await page.click('button:has-text("Start Chatting")');
    
    // Wait for video to load
    await expect(page.locator('iframe')).toBeVisible({ timeout: 30000 });
    
    // Wait for chat interface to be ready
    await expect(page.locator('textarea[placeholder*="What do you want to know"]')).toBeVisible({ timeout: 30000 });
    
    // Check if transcript is being processed
    const processingMessage = page.locator('text=/processing|loading transcript/i');
    if (await processingMessage.isVisible()) {
      await expect(processingMessage).toBeHidden({ timeout: 60000 });
    }
    
    // Send a test message
    await page.fill('textarea[placeholder*="What do you want to know"]', 'What is this video about?');
    await page.click('button[aria-label*="Send"]');
    
    // Wait for AI response
    await expect(page.locator('text=/analyzing video/i')).toBeVisible();
    await expect(page.locator('.assistant-message')).toBeVisible({ timeout: 30000 });
    
    // Verify response contains relevant content
    const response = await page.locator('.assistant-message').textContent();
    expect(response).toBeTruthy();
    expect(response?.length).toBeGreaterThan(10);
  });

  test('should handle video without transcript gracefully', async ({ page }) => {
    // Use a video that might not have captions
    const testVideoUrl = 'https://www.youtube.com/watch?v=invalid_video_id';
    
    await page.fill('input[placeholder*="youtube.com/watch"]', testVideoUrl);
    await page.click('button:has-text("Start Chatting")');
    
    // Should show error message
    await expect(page.locator('text=/error|failed|not found/i')).toBeVisible({ timeout: 10000 });
  });

  test('should show rate limit message for anonymous users', async ({ page }) => {
    // Check that rate limit indicator is visible - look for any rate limit text
    const rateLimitIndicator = page.locator('text=/\\d+\\s*(free questions|questions remaining|\\/ \\d+)/i');
    await expect(rateLimitIndicator).toBeVisible();
    
    // TODO: Test actual rate limiting by sending multiple messages
  });

  test('should persist chat session', async ({ page }) => {
    const testVideoUrl = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
    
    // Start a chat
    await page.fill('input[placeholder*="youtube.com/watch"]', testVideoUrl);
    await page.click('button:has-text("Start Chatting")');
    await page.waitForSelector('iframe', { timeout: 30000 });
    
    // Send first message
    await page.fill('textarea[placeholder*="What do you want to know"]', 'Hello');
    await page.click('button[aria-label*="Send"]');
    await page.waitForSelector('.assistant-message', { timeout: 30000 });
    
    // Reload page
    await page.reload();
    
    // Messages should still be visible
    await expect(page.locator('text=Hello')).toBeVisible();
    await expect(page.locator('.assistant-message')).toBeVisible();
  });
});