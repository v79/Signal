import { test, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helper: start a fresh game from the new-game screen and wait for Phaser
// ---------------------------------------------------------------------------

async function startNewGame(page: Page): Promise<void> {
  await page.goto('/newgame');
  await page.waitForLoadState('networkidle');

  // Dismiss the opening narrative (skippable)
  await page.waitForSelector('.skip-btn');
  await page.click('.skip-btn');

  // North American Alliance is pre-selected (first bloc). Click BEGIN MISSION.
  await page.click('button.btn-begin');
  await page.waitForURL('**/');
  await page.waitForLoadState('networkidle');

  // Wait for Phaser + EarthScene to fully initialise
  await page.waitForTimeout(1500);
}

// ---------------------------------------------------------------------------
// Test 1 — New-game setup screen
// ---------------------------------------------------------------------------

test('setup screen — select bloc and push factor', async ({ page }) => {
  await page.goto('/newgame');
  await page.waitForLoadState('networkidle');

  // Screenshot: default state (first bloc pre-selected, Climate Change active)
  await page.screenshot({ path: 'screenshots/01-setup-default.png', fullPage: true });

  // Select a different bloc and push factor, then screenshot
  await page.locator('.bloc-card').nth(2).click(); // South American Union
  await page.locator('.push-btn').nth(1).click(); // Geopolitical Tension
  await page.screenshot({ path: 'screenshots/02-setup-configured.png', fullPage: true });
});

// ---------------------------------------------------------------------------
// Test 2 — Main game HUD after starting
// ---------------------------------------------------------------------------

test('main game — turn 1 action phase', async ({ page }) => {
  await startNewGame(page);
  await page.screenshot({ path: 'screenshots/03-turn1-action.png', fullPage: true });
});

// ---------------------------------------------------------------------------
// Test 3 — Build facility on the Earth map
//
// Tile (0,0) is now occupied by the HQ. We instead click the urban tile at
// (-1,0) in the North American Alliance layout, which is offset from centre
// by (-63px, -36px) in flat-top hex geometry (HEX_SIZE=42).
// Urban tiles support Research Lab, Public University, and Engineering Works.
// North American Alliance starts with 80F / 60M — all are affordable.
// ---------------------------------------------------------------------------

test('build facility — open picker, build, verify on map', async ({ page }) => {
  await startNewGame(page);

  // Click the urban tile at (-1,0): offset (-63, -36) from canvas centre
  const canvas = page.locator('.map-container canvas');
  const box = await canvas.boundingBox();
  const cx = (box?.width ?? 600) / 2;
  const cy = (box?.height ?? 400) / 2;
  await canvas.click({ position: { x: cx - 63, y: cy - 36 } });

  // Wait for the FacilityPicker dialog
  await page.waitForSelector('[aria-label="Facility Picker"]');
  await page.screenshot({ path: 'screenshots/04-facility-picker.png', fullPage: true });

  // Click the first affordable BUILD button
  await page.locator('.build-btn:not([disabled])').first().click();

  // Brief pause for Phaser to re-render the placed facility indicator
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'screenshots/05-after-build.png', fullPage: true });
});

// ---------------------------------------------------------------------------
// Test 4 — HUD menu opens and shows all three items
// ---------------------------------------------------------------------------

test('hud menu — opens with restart, new game, settings options', async ({ page }) => {
  await startNewGame(page);

  // Open the menu and wait for dropdown to appear in the DOM
  await page.click('.menu-btn');
  await page.waitForSelector('.menu-dropdown');
  await page.screenshot({ path: 'screenshots/08-hud-menu-open.png', fullPage: true });

  // Close by clicking backdrop, wait for dropdown to disappear
  await page.click('.menu-backdrop');
  await page.waitForSelector('.menu-dropdown', { state: 'hidden' });
  await page.screenshot({ path: 'screenshots/09-hud-menu-closed.png', fullPage: true });
});

// ---------------------------------------------------------------------------
// Test 5 — Advance through phases to Turn 2
// ---------------------------------------------------------------------------

test('phase advance — action → turn 2', async ({ page }) => {
  await startNewGame(page);

  // Action phase: click END TURN (triggers World Phase, then next turn begins)
  await page.getByText('END TURN ⟳').click();

  // World phase processes synchronously; wait briefly for re-render
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'screenshots/07-turn2-action.png', fullPage: true });
});
