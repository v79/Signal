import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function startNewGame(page: Page): Promise<void> {
  await page.goto('/newgame');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('.skip-btn');
  await page.click('.skip-btn');
  await page.click('button.btn-begin');
  await page.waitForURL('**/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
}

async function openBlocsTab(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'BLOCS' }).click();
  await expect(page.locator('.bloc-panel')).toBeVisible();
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

test.describe('Bloc Status Panel — navigation', () => {
  test('BLOCS tab opens the bloc panel', async ({ page }) => {
    await startNewGame(page);
    await openBlocsTab(page);
    await page.screenshot({ path: 'screenshots/blocs-01-open.png', fullPage: true });
  });

  test('panel heading reads GEOPOLITICAL STATUS', async ({ page }) => {
    await startNewGame(page);
    await openBlocsTab(page);
    await expect(page.locator('.bloc-panel .panel-header')).toHaveText('GEOPOLITICAL STATUS');
  });

  test('switching back to EARTH tab hides the panel', async ({ page }) => {
    await startNewGame(page);
    await openBlocsTab(page);
    await page.getByRole('button', { name: 'EARTH' }).click();
    await expect(page.locator('.bloc-panel')).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

test.describe('Bloc Status Panel — content', () => {
  test.beforeEach(async ({ page }) => {
    await startNewGame(page);
    await openBlocsTab(page);
  });

  test("player's bloc is shown at the top with a YOU label", async ({ page }) => {
    const playerRow = page.locator('.bloc-row.player-bloc');
    await expect(playerRow).toBeVisible();
    await expect(playerRow.locator('.player-label')).toHaveText('YOU');
    // Player row should appear before the separator
    const playerIndex = await page.locator('.bloc-list > *').evaluateAll((els) =>
      els.findIndex((el) => el.classList.contains('player-bloc')),
    );
    const separatorIndex = await page.locator('.bloc-list > *').evaluateAll((els) =>
      els.findIndex((el) => el.classList.contains('separator')),
    );
    expect(playerIndex).toBeLessThan(separatorIndex);
  });

  test('OTHER BLOCS separator is rendered between player and NPC blocs', async ({ page }) => {
    await expect(page.locator('.separator-label')).toHaveText('OTHER BLOCS');
  });

  test('multiple NPC bloc rows are shown below the separator', async ({ page }) => {
    // All .bloc-row elements that are NOT the player bloc
    const npcRows = page.locator('.bloc-row:not(.player-bloc)');
    await expect(npcRows).toHaveCount(7); // 8 blocs total minus 1 player
  });

  test('each visible bloc row shows a will bar', async ({ page }) => {
    const willBars = page.locator('.will-bar-fill');
    const count = await willBars.count();
    expect(count).toBeGreaterThanOrEqual(8);
  });
});
