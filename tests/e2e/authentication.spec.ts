import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show sign in button for anonymous users', async ({ page }) => {
    // Look for Sign In button in the header
    const signInButton = page.locator('button:has-text("Sign In")');
    await expect(signInButton).toBeVisible();
  });

  test('should handle Clerk authentication modal', async ({ page }) => {
    // Click Sign In button
    await page.click('button:has-text("Sign In")');
    
    // Wait for Clerk to load (it loads as a script)
    await page.waitForTimeout(2000);
    
    // Check if Clerk modal or redirect happened
    // Clerk can either show a modal or redirect to a sign-in page
    const clerkModal = page.locator('div[data-clerk-portal]');
    const clerkIframe = page.frameLocator('iframe[title*="Clerk"]');
    
    // Try to find either the portal div or iframe
    const hasClerkUI = await Promise.race([
      clerkModal.isVisible().catch(() => false),
      clerkIframe.locator('div').first().isVisible().catch(() => false),
      page.waitForURL(/sign-in|signin|clerk/i, { timeout: 5000 }).then(() => true).catch(() => false)
    ]);
    
    expect(hasClerkUI).toBeTruthy();
  });

  test('should show different UI elements for anonymous vs authenticated', async ({ page }) => {
    // Anonymous users should see rate limit for free questions
    const rateLimitText = await page.locator('text=/\\d+\\s*\\/\\s*\\d+.*free questions/i').textContent();
    expect(rateLimitText).toContain('30'); // 30 free questions for anonymous
  });

  test('should require authentication for channel search', async ({ page }) => {
    // Try to access a channel URL directly
    await page.goto('/channel/UCtest123');
    
    // Should either redirect to sign-in or show an auth prompt
    const needsAuth = await Promise.race([
      page.waitForURL(/sign-in|signin/, { timeout: 5000 }).then(() => true).catch(() => false),
      page.locator('text=/sign in|authenticate|login/i').isVisible().catch(() => false)
    ]);
    
    expect(needsAuth).toBeTruthy();
  });
});

test.describe('Authenticated User Flow', () => {
  test.use({
    storageState: 'tests/auth/user.json' // This would store authenticated session
  });

  test.beforeEach(async ({ page }) => {
    // Skip these tests if no auth state is available
    test.skip(!process.env.TEST_WITH_AUTH, 'Authenticated tests skipped - set TEST_WITH_AUTH=true');
  });

  test('should show user menu instead of sign in button', async ({ page }) => {
    await page.goto('/');
    
    // Should not see Sign In button
    await expect(page.locator('button:has-text("Sign In")')).not.toBeVisible();
    
    // Should see some indication of being signed in
    // This could be a user avatar, user menu, or sign out button
    const userIndicator = page.locator('button[aria-label*="User"], button:has-text("Sign Out")');
    await expect(userIndicator.first()).toBeVisible();
  });

  test('should allow searching channels when authenticated', async ({ page }) => {
    await page.goto('/');
    
    // Should be able to enter a channel URL
    const channelUrl = 'https://www.youtube.com/c/TestChannel';
    await page.fill('input[placeholder*="youtube.com"]', channelUrl);
    await page.click('button:has-text("Start Chatting")');
    
    // Should not get an authentication error
    await expect(page.locator('text=/sign in|authenticate/i')).not.toBeVisible();
  });

  test('should show higher rate limits for authenticated users', async ({ page }) => {
    await page.goto('/');
    
    // Look for rate limit text - authenticated users get more questions
    const rateLimitText = page.locator('text=/\\d+.*questions/i');
    const text = await rateLimitText.textContent();
    
    // Should not mention "free questions" for authenticated users
    expect(text).not.toContain('free');
  });
});