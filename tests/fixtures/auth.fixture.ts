import { test as base, expect, Page } from '@playwright/test';
import 'dotenv/config';

const SIGN_IN_URL = 'https://lar-qa.nwk.co.za/auth/sign-in';
const CLIENTS_URL = 'https://lar-qa.nwk.co.za/general/clients';

/**
 * Perform a real UI login. Called at the start of every test and whenever
 * the app redirects back to /auth/sign-in because the previous session
 * expired. Credentials come from .env (QA_Username / QA_Password).
 */
async function performLogin(page: Page): Promise<void> {
  const username = process.env.QA_Username ?? '';
  const password = process.env.QA_Password ?? '';

  if (!username || !password) {
    throw new Error(
      'QA_Username / QA_Password are missing. Check the .env file at the project root.'
    );
  }

  // Wait only for the initial HTML to be parsed, not for every subresource
  // ('load'). The NWK sign-in page keeps background network traffic alive, so
  // waiting for 'load' never resolves. timeout: 0 means wait forever - the
  // operator is expected to cancel manually if something is truly stuck.
  await page.goto(SIGN_IN_URL, { waitUntil: 'domcontentloaded', timeout: 0 });

  // Fill credentials and submit.
  await page.locator('#username').fill(username);
  await page.locator('#pv_id_0_11').fill(password);
  await page.getByRole('button', { name: 'Login' }).click({ timeout: 0 });

  // Wait until the app has actually left the sign-in page (i.e. the login POST
  // has completed and a session was issued). No timeout - waits forever.
  await page.waitForURL((url) => !/\/auth\/sign-in/i.test(url.href), { timeout: 0 });

  // Land every test on the Clients page, not the Welcome dashboard.
  await page.goto(CLIENTS_URL, { waitUntil: 'domcontentloaded', timeout: 0 });
}

/**
 * Fixture that guarantees every test starts with a freshly minted, non-expired
 * session. Also exposes `login` so a test can re-authenticate on demand (useful
 * after a long sub-flow that may have outlived the token).
 */
export const test = base.extend<{ login: () => Promise<void> }>({
  // Use a fresh storageState for every test so a stale session from a previous
  // test can't be inherited.
  storageState: async ({}, use) => {
    await use({ cookies: [], origins: [] });
  },

  page: async ({ page }, use) => {
    // Re-entrancy guard. While a login is in progress, the sign-in page's own
    // framenavigated events must NOT trigger another performLogin - that would
    // cancel the first goto and surface as "Test ended".
    let loginInProgress = false;

    const safeLogin = async () => {
      if (loginInProgress) return;
      loginInProgress = true;
      try {
        await performLogin(page);
      } catch {
        // Swallow - the test's own assertions will surface the failure.
      } finally {
        loginInProgress = false;
      }
    };

    // Auto-recover from mid-test session expiry: when the app bounces us back
    // to /auth/sign-in (typically with ?reason=session-expired), log in again
    // transparently. The guard above prevents recursion during the initial
    // login navigation.
    page.on('framenavigated', (frame) => {
      if (frame !== page.mainFrame()) return;
      if (loginInProgress) return;
      if (/\/auth\/sign-in/i.test(frame.url())) {
        void safeLogin();
      }
    });

    // Initial login before the test body runs.
    await safeLogin();

    await use(page);
  },

  login: async ({ page }, use) => {
    await use(() => performLogin(page));
  },
});

export { expect };