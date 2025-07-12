import { test, expect } from '@playwright/test';

test.describe('Critical User Flows', () => {
  test('Complete flow: Search video → Ask questions → Get responses', async ({ page }) => {
    await page.goto('/');
    
    // 1. Search for a video
    const videoUrl = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
    await page.fill('input[placeholder*="YouTube URL"]', videoUrl);
    await page.click('button:has-text("Search")');
    
    // 2. Wait for video player
    await expect(page.locator('iframe')).toBeVisible({ timeout: 30000 });
    
    // 3. Check message count is displayed
    await expect(page.locator('text=/\d+\s*\/\s*30.*questions/i')).toBeVisible();
    
    // 4. Ask first question
    const chatInput = page.locator('textarea[placeholder*="What do you want to know"]');
    await chatInput.fill('What animals are shown in this video?');
    await page.click('button[aria-label*="Send"]');
    
    // 5. Wait for response
    await expect(page.locator('text=/analyzing video/i')).toBeVisible();
    const firstResponse = page.locator('.assistant-message').first();
    await expect(firstResponse).toBeVisible({ timeout: 30000 });
    
    // 6. Verify response quality
    const responseText = await firstResponse.textContent();
    expect(responseText).toContain(/elephant|zoo|animal/i);
    
    // 7. Ask follow-up question
    await chatInput.fill('How long is the video?');
    await page.click('button[aria-label*="Send"]');
    
    // 8. Wait for second response
    const responses = page.locator('.assistant-message');
    await expect(responses).toHaveCount(2, { timeout: 30000 });
    
    // 9. Check message count updated
    const messageCount = await page.locator('text=/\d+\s*\/\s*30/').textContent();
    expect(messageCount).toMatch(/[2-9]\s*\/\s*30/); // Should show at least 2 messages used
  });

  test('Channel search flow (authenticated)', async ({ page }) => {
    test.skip(true, 'Requires authentication setup');
    
    await page.goto('/dashboard');
    
    // 1. Click add channel
    await page.click('button:has-text("Add Channel")');
    
    // 2. Enter channel URL
    await page.fill('input[placeholder*="channel URL"]', 'https://www.youtube.com/@TestChannel');
    await page.click('button:has-text("Add")');
    
    // 3. Wait for processing
    await expect(page.locator('text=/processing|queued/i')).toBeVisible();
    
    // 4. Channel should appear in list
    await expect(page.locator('text=TestChannel')).toBeVisible({ timeout: 60000 });
  });

  test('Error recovery flow', async ({ page }) => {
    await page.goto('/');
    
    // 1. Try invalid video URL
    await page.fill('input[placeholder*="YouTube URL"]', 'not-a-valid-url');
    await page.click('button:has-text("Search")');
    
    // 2. Should show error
    await expect(page.locator('text=/invalid|error/i')).toBeVisible();
    
    // 3. Try again with valid URL
    await page.fill('input[placeholder*="YouTube URL"]', 'https://www.youtube.com/watch?v=jNQXAC9IVRw');
    await page.click('button:has-text("Search")');
    
    // 4. Should recover and load video
    await expect(page.locator('iframe')).toBeVisible({ timeout: 30000 });
  });

  test('Responsive design - Mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Check mobile layout
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('input[placeholder*="YouTube URL"]')).toBeVisible();
    
    // Navigation should be mobile-friendly
    const menuButton = page.locator('button[aria-label*="Menu"]');
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await expect(page.locator('nav')).toBeVisible();
    }
  });

  test('Performance - Page load time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    // Page should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
    
    // Critical elements should be visible quickly
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('input[placeholder*="YouTube URL"]')).toBeVisible();
  });
});