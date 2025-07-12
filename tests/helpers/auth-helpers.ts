import { Page } from '@playwright/test';

export async function mockClerkAuth(page: Page, userId: string = 'test-user-123') {
  // Inject Clerk session into the page
  await page.addInitScript(() => {
    // Mock __clerk_db_jwt cookie which Clerk uses for authentication
    document.cookie = `__clerk_db_jwt=mock-jwt-token; path=/; secure; samesite=strict`;
    
    // Mock Clerk's window properties
    (window as any).__clerk_loaded = true;
    (window as any).__clerk_session = {
      id: 'sess_mock',
      status: 'active',
      lastActiveAt: new Date().toISOString(),
      expireAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      user: {
        id: userId,
        emailAddresses: [{ emailAddress: 'test@example.com' }],
        firstName: 'Test',
        lastName: 'User',
      }
    };
  });
}

export async function signInWithClerk(
  page: Page, 
  email: string = 'test@example.com', 
  password: string = 'testpassword123'
) {
  // Click Sign In button
  await page.click('button:has-text("Sign In")');
  
  // Wait for Clerk UI to load
  await page.waitForTimeout(2000);
  
  // Try to interact with Clerk's sign-in form
  // This will vary based on how Clerk is configured
  try {
    // Check if it's an iframe-based flow
    const clerkFrame = page.frameLocator('iframe[title*="Sign in"], iframe[title*="Clerk"]').first();
    
    // Try to fill email
    await clerkFrame.locator('input[name="identifier"], input[type="email"]').fill(email);
    await clerkFrame.locator('button:has-text("Continue")').click();
    
    // Try to fill password
    await clerkFrame.locator('input[name="password"], input[type="password"]').fill(password);
    await clerkFrame.locator('button:has-text("Continue")').click();
  } catch (error) {
    // If iframe approach fails, try direct page interaction
    await page.fill('input[name="identifier"], input[type="email"]', email);
    await page.click('button:has-text("Continue")');
    
    await page.fill('input[name="password"], input[type="password"]', password);
    await page.click('button:has-text("Continue")');
  }
}

export async function waitForAuthRedirect(page: Page, timeout: number = 10000) {
  // Wait for either dashboard redirect or home page with authenticated state
  await Promise.race([
    page.waitForURL(/\/dashboard/, { timeout }),
    page.waitForURL(/\//, { timeout }).then(() => 
      page.waitForSelector('button[aria-label*="User menu"], button:has-text("Sign Out")', { timeout: 5000 })
    )
  ]);
}

export async function signOutWithClerk(page: Page) {
  // Try to find and click user menu or sign out button
  const userMenu = page.locator('button[aria-label*="User menu"], button[aria-label*="Account"]');
  const signOutButton = page.locator('button:has-text("Sign Out"), button:has-text("Sign out")');
  
  if (await userMenu.isVisible()) {
    await userMenu.click();
    await page.click('text=/sign out/i');
  } else if (await signOutButton.isVisible()) {
    await signOutButton.click();
  }
  
  // Wait for redirect to home
  await page.waitForURL('/');
}