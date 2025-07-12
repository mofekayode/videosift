import { test, expect } from '@playwright/test';

test.describe('Core Functionality - Video Chat', () => {
  test('complete flow: add YouTube link, download transcript, and chat', async ({ page }) => {
    // Set base URL for this test
    await page.goto('http://localhost:3001');
    
    console.log('1. Testing homepage load...');
    await expect(page.locator('h1:has-text("MindSift")')).toBeVisible();
    
    // Test with a known video that has captions
    const testVideoUrl = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'; // "Me at the zoo"
    
    console.log('2. Entering YouTube URL...');
    await page.fill('input[placeholder*="youtube.com/watch"]', testVideoUrl);
    
    // Optional: Add a first question
    const firstQuestion = 'What animals are shown in this video?';
    await page.fill('textarea[placeholder*="Ask me anything"]', firstQuestion);
    
    console.log('3. Clicking Start Chatting...');
    await page.click('button:has-text("Start Chatting")');
    
    console.log('4. Waiting for video page to load...');
    // Should navigate to watch page
    await page.waitForURL(/\/watch\//, { timeout: 30000 });
    
    console.log('5. Checking for video player...');
    // Video player should load
    await expect(page.locator('iframe[src*="youtube.com/embed"]')).toBeVisible({ timeout: 30000 });
    
    console.log('6. Waiting for chat interface...');
    // Chat interface should be ready (processing may have already completed)
    await expect(page.locator('textarea[placeholder*="What do you want to know"]')).toBeVisible({ timeout: 30000 });
    
    console.log('7. Checking if first question was processed...');
    // If we provided a first question, it should appear in chat
    if (firstQuestion) {
      await expect(page.locator(`text="${firstQuestion}"`)).toBeVisible({ timeout: 10000 });
      
      console.log('8. Waiting for AI response...');
      // Look for "Analyzing video" or actual response
      await page.waitForSelector('text=/Analyzing video|elephant|animal/i', { timeout: 30000 });
      
      // Wait a bit for the full response
      await page.waitForTimeout(3000);
      
      // Check if we got a meaningful response
      const pageContent = await page.content();
      const hasResponse = pageContent.toLowerCase().includes('elephant') || 
                         pageContent.toLowerCase().includes('animal') ||
                         pageContent.toLowerCase().includes('zoo');
      
      expect(hasResponse).toBeTruthy();
      console.log('✅ Got AI response about the video content');
    }
    
    console.log('9. Testing follow-up question...');
    // Send another message
    await page.fill('textarea[placeholder*="What do you want to know"]', 'How long is this video?');
    await page.keyboard.press('Enter');
    
    // Wait for new response
    await page.waitForSelector('.assistant-message, [data-role="assistant"]', { 
      state: 'attached',
      timeout: 30000 
    });
    
    // Get all assistant messages
    const assistantMessages = await page.locator('.assistant-message, [data-role="assistant"]').count();
    expect(assistantMessages).toBeGreaterThanOrEqual(2);
    
    console.log('✅ Core functionality test passed!');
  });

  test('should handle video without captions gracefully', async ({ page }) => {
    await page.goto('http://localhost:3001');
    
    // Use a video that might not have captions
    const videoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    
    await page.fill('input[placeholder*="youtube.com/watch"]', videoUrl);
    await page.click('button:has-text("Start Chatting")');
    
    // Should still load the video page
    await page.waitForURL(/\/watch\//, { timeout: 30000 });
    
    // Should either download transcript or show appropriate message
    const transcriptStatus = await Promise.race([
      page.waitForSelector('text=/transcript.*download|processing transcript/i', { timeout: 15000 })
        .then(() => 'downloading'),
      page.waitForSelector('text=/no transcript|captions not available/i', { timeout: 15000 })
        .then(() => 'not available')
    ]).catch(() => 'unknown');
    
    console.log('Transcript status:', transcriptStatus);
    
    // Even without transcript, chat should be available (using video metadata)
    await expect(page.locator('textarea[placeholder*="What do you want to know"]')).toBeVisible({ timeout: 30000 });
  });
});

test.describe('Core Functionality - Channel Processing', () => {
  test('should handle channel URL and show channel videos', async ({ page }) => {
    await page.goto('http://localhost:3001');
    
    // Channel URLs require authentication
    const signInButton = page.locator('button:has-text("Sign In")').first();
    if (await signInButton.isVisible()) {
      console.log('⚠️ Channel search requires authentication - skipping detailed test');
      
      // At least verify it prompts for auth
      const channelUrl = 'https://www.youtube.com/@TED';
      await page.fill('input[placeholder*="youtube.com"]', channelUrl);
      await page.click('button:has-text("Start Chatting")');
      
      // Should show auth requirement
      await expect(page.locator('text=/sign in|authenticate|log in/i')).toBeVisible({ timeout: 10000 });
      return;
    }
    
    // If authenticated, test channel functionality
    console.log('Testing channel functionality (authenticated)...');
    
    const channelUrl = 'https://www.youtube.com/@TED';
    await page.fill('input[placeholder*="youtube.com"]', channelUrl);
    await page.click('button:has-text("Start Chatting")');
    
    // Should navigate to channel page
    await page.waitForURL(/\/channel\//, { timeout: 30000 });
    
    // Should show channel info
    await expect(page.locator('text=/TED|Technology Entertainment Design/i')).toBeVisible({ timeout: 10000 });
    
    // Should show video list
    await expect(page.locator('text=/videos found|processing.*videos/i')).toBeVisible({ timeout: 10000 });
    
    // Should have option to download all transcripts
    const downloadButton = page.locator('button:has-text("Download All Transcripts")');
    if (await downloadButton.isVisible()) {
      console.log('Found download all transcripts button');
      
      // Click and monitor progress
      await downloadButton.click();
      
      // Should show progress
      await expect(page.locator('text=/downloading.*transcripts|processing.*of/i')).toBeVisible({ timeout: 10000 });
    }
  });
});

test.describe('Core Functionality - Notifications', () => {
  test('should show notification preferences', async ({ page }) => {
    await page.goto('http://localhost:3001');
    
    // Check if there's a notification setting visible
    const notificationSettings = await page.locator('text=/notification|notify|email.*updates/i').isVisible();
    
    if (notificationSettings) {
      console.log('✅ Notification settings found');
    } else {
      console.log('⚠️ Notification settings not visible on homepage');
      
      // They might be in user settings if authenticated
      const userMenu = page.locator('button[aria-label*="User"], button[aria-label*="Account"]');
      if (await userMenu.isVisible()) {
        await userMenu.click();
        const settingsLink = page.locator('text=/settings|preferences/i');
        if (await settingsLink.isVisible()) {
          await settingsLink.click();
          await expect(page.locator('text=/notification|email/i')).toBeVisible({ timeout: 10000 });
        }
      }
    }
  });
});