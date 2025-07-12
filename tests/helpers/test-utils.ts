import { Page } from '@playwright/test';

export const TEST_VIDEOS = {
  SHORT_WITH_CAPTIONS: 'jNQXAC9IVRw', // "Me at the zoo" - 18 seconds
  LONG_WITH_CAPTIONS: 'dQw4w9WgXcQ', // Rick Astley - full song
  NO_CAPTIONS: 'test_no_captions', // Placeholder for video without captions
};

export async function searchVideo(page: Page, videoUrl: string) {
  await page.fill('input[placeholder*="YouTube URL"]', videoUrl);
  await page.click('button:has-text("Search")');
  await page.waitForSelector('iframe', { timeout: 30000 });
}

export async function sendChatMessage(page: Page, message: string) {
  const chatInput = page.locator('textarea[placeholder*="What do you want to know"]');
  await chatInput.fill(message);
  await page.click('button[aria-label*="Send"]');
}

export async function waitForAssistantResponse(page: Page) {
  await page.waitForSelector('.assistant-message', { timeout: 30000 });
}

export async function signIn(page: Page, email: string, password: string) {
  await page.click('button:has-text("Sign in")');
  
  const clerkFrame = page.frameLocator('iframe[title*="Sign in"]');
  await clerkFrame.locator('input[name="identifier"]').fill(email);
  await clerkFrame.locator('button:has-text("Continue")').click();
  await clerkFrame.locator('input[name="password"]').fill(password);
  await clerkFrame.locator('button:has-text("Continue")').click();
  
  // Wait for redirect
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });
}

export async function mockAuthentication(page: Page, userId: string) {
  // This would require setting up proper auth mocking
  // For now, it's a placeholder
  await page.evaluate((id) => {
    // Set mock auth state in localStorage or cookies
    localStorage.setItem('mock_user_id', id);
  }, userId);
}

export function getTestVideoUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export async function checkRateLimit(page: Page): Promise<{ used: number; limit: number }> {
  const rateLimitText = await page.locator('text=/\d+\s*\/\s*\d+.*questions/').textContent();
  const match = rateLimitText?.match(/(\d+)\s*\/\s*(\d+)/);
  
  if (match) {
    return {
      used: parseInt(match[1]),
      limit: parseInt(match[2])
    };
  }
  
  throw new Error('Could not find rate limit information');
}