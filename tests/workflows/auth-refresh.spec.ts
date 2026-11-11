
//import { test, expect } from '@playwright/test';
import { test, expect } from '../fixtures/auth.fixture';

test('Investigate NWK authentication lifecycle', async ({ page, context }) => {
  console.log('\n========== AUTHENTICATION INVESTIGATION ==========\n');

  // 1. Check whether the access token was loaded from storageState.json
  const initialCookies = await context.cookies(
    'https://lar-qa.nwk.co.za'
  );

  const initialToken = initialCookies.find(
    cookie => cookie.name === 'access_token'
  );

  console.log('Initial token exists:', !!initialToken);
  console.log('Initial token expiry:', initialToken?.expires);

  // 2. Monitor HTTP responses
  page.on('response', async response => {
    if (response.status() >= 400) {
      console.log(
        `[HTTP ERROR] ${response.status()} - ${response.url()}`
      );
    }

    if (
      response.url().includes('/auth/') ||
      response.url().includes('/backend/')
    ) {
      console.log(
        `[API] ${response.status()} - ${response.url()}`
      );

      // Inspect refresh response without printing the token
      if (response.url().includes('/auth/refresh')) {
        try {
          const responseBody = await response.json();

          console.log(
            '[REFRESH RESPONSE] Access token returned:',
            !!responseBody.access_token
          );

          console.log(
            '[REFRESH RESPONSE] Permissions returned:',
            Array.isArray(responseBody.permissions)
          );

          console.log(
            '[REFRESH RESPONSE] Permission count:',
            responseBody.permissions?.length ?? 0
          );
        } catch {
          console.log(
            '[REFRESH RESPONSE] Could not read JSON response'
          );
        }
      }
    }
  });

  // 3. Monitor failed network requests
  page.on('requestfailed', request => {
    console.log(
      '[REQUEST FAILED]',
      request.method(),
      request.url(),
      request.failure()?.errorText
    );
  });

  // 4. Monitor browser console messages
  page.on('console', message => {
    const messageText = message.text();

    if (
      message.type() === 'error' ||
      /auth|401|token|storage|clearing|unauthorized/i.test(messageText)
    ) {
      console.log(
        `[BROWSER ${message.type().toUpperCase()}]`,
        messageText
      );

      const location = message.location();

      if (location.url) {
        console.log(
          '[BROWSER MESSAGE LOCATION]',
          `${location.url}:${location.lineNumber}:${location.columnNumber}`
        );
      }
    }

    // Specifically identify authentication storage cleanup messages
    if (
      /clearing user state|persistent auth storage cleared|auth storage cleared/i.test(
        messageText
      )
    ) {
      console.log('[AUTH STORAGE EVENT]', messageText);
      console.log('[AUTH STORAGE SOURCE]', message.location());
    }
  });

  // 5. Monitor JavaScript errors
  page.on('pageerror', error => {
    console.log('[PAGE ERROR]', error.message);
  });

  // 6. Monitor page navigation
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) {
      console.log('[NAVIGATION]', frame.url());
    }
  });

  // 7. Navigate to NWK
  console.log('\n--- NAVIGATING TO NWK ---');

  await page.goto('https://lar-qa.nwk.co.za', {
    waitUntil: 'domcontentloaded'
  });

  // Allow the application and authentication requests to complete
  await page.waitForTimeout(10000);

  // 8. Check authentication token after navigation
  console.log('\n--- AUTHENTICATION STATE ---');

  const cookiesAfterNavigation = await context.cookies(
    'https://lar-qa.nwk.co.za'
  );

  const tokenAfterNavigation = cookiesAfterNavigation.find(
    cookie => cookie.name === 'access_token'
  );

  console.log(
    'Token exists after navigation:',
    !!tokenAfterNavigation
  );

  console.log(
    'Token changed:',
    initialToken?.value !== tokenAfterNavigation?.value
  );

  // 9. Inspect localStorage without exposing values
  const localStorageData = await page.evaluate(() => {
    return Object.keys(localStorage).map(key => ({
      key,
      valueExists: !!localStorage.getItem(key),
      valueLength: localStorage.getItem(key)?.length ?? 0
    }));
  });

  console.log('\n--- LOCAL STORAGE ---');
  console.log(JSON.stringify(localStorageData, null, 2));

  // 10. Inspect sessionStorage without exposing values
  const sessionStorageData = await page.evaluate(() => {
    return Object.keys(sessionStorage).map(key => ({
      key,
      valueExists: !!sessionStorage.getItem(key),
      valueLength: sessionStorage.getItem(key)?.length ?? 0
    }));
  });

  console.log('\n--- SESSION STORAGE ---');
  console.log(JSON.stringify(sessionStorageData, null, 2));

  // 11. Inspect the structure of sessionStorage.Auth
  // Actual values are deliberately not printed.
  const authStructure = await page.evaluate(() => {
    const authValue = sessionStorage.getItem('Auth');

    if (!authValue) {
      return {
        exists: false
      };
    }

    try {
      const parsedAuth = JSON.parse(authValue);

      return {
        exists: true,
        isJSON: true,
        type: typeof parsedAuth,
        properties: Object.keys(parsedAuth),

        nestedProperties: Object.fromEntries(
          Object.entries(parsedAuth).map(([key, value]) => [
            key,
            {
              type: Array.isArray(value)
                ? 'array'
                : typeof value,

              properties:
                value && typeof value === 'object'
                  ? Object.keys(value)
                  : undefined
            }
          ])
        )
      };
    } catch {
      return {
        exists: true,
        isJSON: false,
        type: typeof authValue,
        length: authValue.length
      };
    }
  });

  console.log('\n--- AUTH OBJECT STRUCTURE ---');
  console.log(JSON.stringify(authStructure, null, 2));

  // 12. Check whether the application is still authenticated
  console.log('\n--- FINAL PAGE STATE ---');

  console.log('Final URL:', page.url());

  const welcomeVisible = await page
    .getByText('Welcome to NWK,')
    .isVisible()
    .catch(() => false);

  console.log('Welcome visible:', welcomeVisible);

  const loginVisible = await page
    .getByRole('button', { name: 'Login' })
    .isVisible()
    .catch(() => false);

  console.log('Login button visible:', loginVisible);

  console.log(
    '\n========== INVESTIGATION COMPLETE ==========\n'
  );

  // Diagnostic test: report findings without failing
  // simply because authentication did not succeed.
  expect(page.url()).toContain('lar-qa.nwk.co.za');
});
