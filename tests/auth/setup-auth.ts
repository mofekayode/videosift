import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * This script sets up authentication state for E2E tests
 * Run this manually with test credentials to generate auth state
 * 
 * Usage: npx ts-node tests/auth/setup-auth.ts
 */
async function setupAuth() {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  
  if (!email || !password) {
    console.error('Please set TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables');
    process.exit(1);
  }
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Go to the app
    await page.goto('http://localhost:3001');
    
    // Click Sign In
    await page.click('button:has-text("Sign In")');
    
    // Wait for Clerk to load
    await page.waitForTimeout(3000);
    
    console.log('Please complete the sign-in process manually in the browser...');
    console.log(`Email: ${email}`);
    console.log('Password: [hidden]');
    
    // Wait for successful sign in (detect by URL change or UI element)
    await Promise.race([
      page.waitForURL(/dashboard/, { timeout: 60000 }),
      page.waitForSelector('button[aria-label*="User"]', { timeout: 60000 })
    ]);
    
    console.log('Sign in successful! Saving authentication state...');
    
    // Save storage state
    const authDir = path.join(__dirname);
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }
    
    await context.storageState({ path: path.join(authDir, 'user.json') });
    console.log('Authentication state saved to tests/auth/user.json');
    
  } catch (error) {
    console.error('Setup failed:', error);
  } finally {
    await browser.close();
  }
}

setupAuth().catch(console.error);