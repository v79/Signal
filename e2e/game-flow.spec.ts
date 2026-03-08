import { test, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helper: start a fresh game from the new-game screen and wait for Phaser
// ---------------------------------------------------------------------------

async function startNewGame(page: Page): Promise<void> {
  await page.goto('/newgame');
  await page.waitForLoadState('networkidle');

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
  await page.locator('.bloc-card').nth(2).click();  // South American Union
  await page.locator('.push-btn').nth(1).click();   // Geopolitical Tension
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
// The center tile (0,0) is always 'urban' (deterministic in tileTypeForCoord).
// Urban tiles support Research Lab, Public University, and Engineering Works.
// North American Alliance starts with 80F / 60M — all are affordable.
// ---------------------------------------------------------------------------

test('build facility — open picker, build, verify on map', async ({ page }) => {
  await startNewGame(page);

  // Click the centre of the Phaser canvas — always hits the urban tile at (0,0)
  const canvas = page.locator('.map-container canvas');
  await canvas.click();  // Playwright clicks the element centre by default

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
// Test 4 — Advance through phases to Turn 2
// ---------------------------------------------------------------------------

test('phase advance — action → bank → turn 2', async ({ page }) => {
  await startNewGame(page);

  // Action phase: click END ACTION
  await page.getByText('END ACTION →').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'screenshots/06-bank-phase.png', fullPage: true });

  // Bank phase: click END TURN (triggers World Phase, then next turn begins)
  await page.getByText('END TURN ⟳').click();

  // World phase processes synchronously; wait briefly for re-render
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'screenshots/07-turn2-action.png', fullPage: true });
});
