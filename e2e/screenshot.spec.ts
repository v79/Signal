import { test } from '@playwright/test';
import path from 'path';

test('screenshot new-game screen', async ({ page }) => {
  await page.goto('/');
  // Wait for either redirect to /newgame or the game layout to appear
  await page.waitForURL(url => url.pathname === '/newgame' || url.pathname === '/', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join('screenshots', 'newgame.png'), fullPage: true });
});
