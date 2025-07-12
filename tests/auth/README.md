# Authentication Testing with Clerk

## Overview
MindSift uses Clerk for authentication. Testing authenticated flows requires special handling because Clerk uses iframes and secure cookies.

## Test Structure

### Anonymous User Tests
These tests run without authentication and verify:
- Sign In button is visible
- Rate limits show "30 free questions"
- Channel search requires authentication
- Clerk modal/redirect works when clicking Sign In

### Authenticated User Tests
These tests require a saved authentication state and verify:
- User menu/avatar is shown instead of Sign In
- Higher rate limits are available
- Channel search is accessible
- Sign out functionality works

## Setting Up Authentication for Tests

### Option 1: Manual Setup (Recommended for local testing)
1. Set environment variables:
   ```bash
   export TEST_USER_EMAIL="your-test@email.com"
   export TEST_USER_PASSWORD="your-password"
   ```

2. Run the setup script:
   ```bash
   npx ts-node tests/auth/setup-auth.ts
   ```

3. Complete sign-in manually in the browser that opens

4. The script will save authentication state to `tests/auth/user.json`

5. Run authenticated tests:
   ```bash
   TEST_WITH_AUTH=true npm run test:e2e
   ```

### Option 2: Mock Authentication (For CI/CD)
For CI environments where real Clerk authentication isn't available, tests can be run with mocked auth:

```javascript
// In your test
import { mockClerkAuth } from '../helpers/auth-helpers';

test.beforeEach(async ({ page }) => {
  await mockClerkAuth(page, 'test-user-123');
});
```

## Running Tests

### Run only anonymous user tests:
```bash
npm run test:e2e -- tests/e2e/authentication.spec.ts --grep "Authentication Flow"
```

### Run authenticated user tests (requires setup):
```bash
TEST_WITH_AUTH=true npm run test:e2e -- tests/e2e/authentication.spec.ts --grep "Authenticated User Flow"
```

## Debugging Tips

1. **Clerk UI not appearing**: 
   - Check if Clerk publishable key is set in `.env.local`
   - Verify the Sign In button selector matches your UI

2. **Authentication state not persisting**:
   - Ensure cookies are being saved correctly
   - Check if Clerk session is valid

3. **Tests timing out**:
   - Increase timeout for Clerk UI to load
   - Check network requests in test videos

## CI/CD Considerations

For CI/CD pipelines:
1. Use mock authentication for most tests
2. Run a subset of real auth tests with dedicated test accounts
3. Store test credentials as secure environment variables
4. Consider using Clerk's test mode if available