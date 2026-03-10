import { test } from '@playwright/test';

test('screenshot new-game screen', async ({ page }) => {
  await page.goto('/newgame');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('.skip-btn');
  await page.click('.skip-btn');
  await page.screenshot({ path: 'screenshots/newgame-setup.png', fullPage: true });
});

test('screenshot main game HUD', async ({ page }) => {
  await page.goto('/newgame');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('.skip-btn');
  await page.click('.skip-btn');

  // Select first bloc (already pre-selected) and click BEGIN MISSION
  await page.click('button.btn-begin');

  // Wait for the main game page to load
  await page.waitForURL('**/');
  await page.waitForLoadState('networkidle');
  // Give Phaser a moment to render the hex map
  await page.waitForTimeout(1500);

  await page.screenshot({ path: 'screenshots/main-game.png', fullPage: true });
});
