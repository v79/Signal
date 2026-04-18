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

async function clickMapTile(page: Page, offsetX: number, offsetY: number): Promise<void> {
  const canvas = page.locator('.map-container canvas');
  const box = await canvas.boundingBox();
  const cx = (box?.width ?? 600) / 2;
  const cy = (box?.height ?? 400) / 2;
  await canvas.click({ position: { x: cx + offsetX, y: cy + offsetY } });
}

async function buildFacilityAndSave(page: Page): Promise<void> {
  const canvas = page.locator('.map-container canvas');
  const box = await canvas.boundingBox();
  const cx = (box?.width ?? 600) / 2;
  const cy = (box?.height ?? 400) / 2;
  await canvas.click({ position: { x: cx - 63, y: cy - 36 } });
  await page.waitForSelector('[aria-label="Facility Picker"]');
  await page.click('.open-build-btn');
  await page.locator('.build-btn:not([disabled])').first().click();
  await page.waitForTimeout(400);
}

async function patchNearSpaceState(page: Page): Promise<void> {
  await page.evaluate(() => {
    const raw = localStorage.getItem('signal-autosave');
    if (!raw) throw new Error('No autosave found');
    const envelope = JSON.parse(raw) as { version: number; savedAt: string; state: Record<string, unknown> };
    const state = envelope.state as Record<string, unknown>;
    state.era = 'nearSpace';
    state.launchCapacity = 5;
    state.launchAllocation = { leo: true };
    state.map = {
      ...(state.map as object),
      spaceNodes: [
        { id: 'leo', type: 'lowEarthOrbit', label: 'LEO', launchCost: 10, facilityId: 'orbitalModule' },
      ],
    };
    const facilities = (state.player as Record<string, unknown>).facilities as unknown[];
    (state.player as Record<string, unknown>).facilities = [
      ...facilities,
      { id: 'orbitalModule-leo-1', defId: 'orbitalModule', locationKey: 'leo', condition: 1.0, builtTurn: 1 },
    ];
    localStorage.setItem('signal-autosave', JSON.stringify(envelope));
  });
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
}

// ---------------------------------------------------------------------------
// HUD components
// ---------------------------------------------------------------------------

test.describe('Visual — HUD', () => {
  test.beforeEach(async ({ page }) => {
    await startNewGame(page);
  });

  test('HUD resource bar', async ({ page }) => {
    const hud = page.locator('.hud');
    await expect(hud).toBeVisible();
    await hud.screenshot({ path: 'screenshots/visual/hud-resource-bar.png' });
  });

  test('HUD research fields', async ({ page }) => {
    const fields = page.locator('.hud-right');
    await expect(fields).toBeVisible();
    await fields.screenshot({ path: 'screenshots/visual/hud-research-fields.png' });
  });

  test('HUD center bars (climate + will)', async ({ page }) => {
    const center = page.locator('.hud-center');
    await expect(center).toBeVisible();
    await center.screenshot({ path: 'screenshots/visual/hud-center-bars.png' });
  });

  test('HUD menu open state', async ({ page }) => {
    await page.click('.menu-btn');
    await page.waitForSelector('.menu-dropdown');
    const hud = page.locator('.hud');
    await hud.screenshot({ path: 'screenshots/visual/hud-menu-open.png' });
  });
});

// ---------------------------------------------------------------------------
// Phase controls
// ---------------------------------------------------------------------------

test.describe('Visual — PhaseControls', () => {
  test('phase controls — action phase', async ({ page }) => {
    await startNewGame(page);
    const controls = page.locator('.phase-controls');
    await expect(controls).toBeVisible();
    await controls.screenshot({ path: 'screenshots/visual/phase-controls-action.png' });
  });

  test('phase controls — after end turn (world phase processed)', async ({ page }) => {
    await startNewGame(page);
    await page.getByText('END TURN ⟳').click();
    await page.waitForTimeout(800);
    const controls = page.locator('.phase-controls');
    await expect(controls).toBeVisible();
    await controls.screenshot({ path: 'screenshots/visual/phase-controls-turn2.png' });
  });
});

// ---------------------------------------------------------------------------
// Card hand
// ---------------------------------------------------------------------------

test.describe('Visual — CardHand', () => {
  test('card hand — full hand on turn 1', async ({ page }) => {
    await startNewGame(page);
    const hand = page.locator('.card-hand');
    await expect(hand).toBeVisible();
    await hand.screenshot({ path: 'screenshots/visual/card-hand-full.png' });
  });

  test('card hand — after playing a card (end turn)', async ({ page }) => {
    await startNewGame(page);
    await page.getByText('END TURN ⟳').click();
    await page.waitForTimeout(800);
    const hand = page.locator('.card-hand');
    await expect(hand).toBeVisible();
    await hand.screenshot({ path: 'screenshots/visual/card-hand-turn2.png' });
  });
});

// ---------------------------------------------------------------------------
// Research feed + signal track
// ---------------------------------------------------------------------------

test.describe('Visual — ResearchFeed and SignalTrack', () => {
  test.beforeEach(async ({ page }) => {
    await startNewGame(page);
  });

  test('research feed panel', async ({ page }) => {
    const feed = page.locator('.right-column');
    await expect(feed).toBeVisible();
    await feed.screenshot({ path: 'screenshots/visual/research-feed.png' });
  });

  test('signal track bar', async ({ page }) => {
    const signal = page.locator('.signal-track');
    await expect(signal).toBeVisible();
    await signal.screenshot({ path: 'screenshots/visual/signal-track.png' });
  });
});

// ---------------------------------------------------------------------------
// News ticker
// ---------------------------------------------------------------------------

test.describe('Visual — NewsTicker', () => {
  test('news ticker collapsed', async ({ page }) => {
    await startNewGame(page);
    const ticker = page.locator('.ticker-wrap');
    await expect(ticker).toBeVisible();
    await ticker.screenshot({ path: 'screenshots/visual/news-ticker-collapsed.png' });
  });

  test('news ticker expanded popup', async ({ page }) => {
    await startNewGame(page);
    // Advance a turn so there are news items, then open the popup
    await page.getByText('END TURN ⟳').click();
    await page.waitForTimeout(800);
    const ticker = page.locator('.ticker-wrap');
    await ticker.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: 'screenshots/visual/news-ticker-popup.png', fullPage: true });
  });
});

// ---------------------------------------------------------------------------
// Facility Picker
// ---------------------------------------------------------------------------

test.describe('Visual — FacilityPicker', () => {
  test.beforeEach(async ({ page }) => {
    await startNewGame(page);
  });

  test('facility picker — closed (tile info)', async ({ page }) => {
    await clickMapTile(page, -63, -36);
    await page.waitForSelector('[aria-label="Facility Picker"]');
    const picker = page.locator('[aria-label="Facility Picker"]');
    await picker.screenshot({ path: 'screenshots/visual/facility-picker-closed.png' });
  });

  test('facility picker — build list open', async ({ page }) => {
    await clickMapTile(page, -63, -36);
    await page.waitForSelector('[aria-label="Facility Picker"]');
    await page.click('.open-build-btn');
    await page.waitForTimeout(200);
    const picker = page.locator('[aria-label="Facility Picker"]');
    await picker.screenshot({ path: 'screenshots/visual/facility-picker-open.png' });
  });

  test('facility picker — after building a facility', async ({ page }) => {
    await clickMapTile(page, -63, -36);
    await page.waitForSelector('[aria-label="Facility Picker"]');
    await page.click('.open-build-btn');
    await page.locator('.build-btn:not([disabled])').first().click();
    await page.waitForTimeout(400);
    // Click the same tile again to see the placed facility
    await clickMapTile(page, -63, -36);
    await page.waitForSelector('[aria-label="Facility Picker"]');
    const picker = page.locator('[aria-label="Facility Picker"]');
    await picker.screenshot({ path: 'screenshots/visual/facility-picker-occupied.png' });
  });
});

// ---------------------------------------------------------------------------
// Map container (tab bar + map area)
// ---------------------------------------------------------------------------

test.describe('Visual — MapContainer', () => {
  test.beforeEach(async ({ page }) => {
    await startNewGame(page);
  });

  test('map container — EARTH tab active', async ({ page }) => {
    const map = page.locator('.map-container');
    await expect(map).toBeVisible();
    await map.screenshot({ path: 'screenshots/visual/map-earth-tab.png' });
  });

  test('map container — BLOCS tab', async ({ page }) => {
    await page.getByRole('button', { name: 'BLOCS' }).click();
    await expect(page.locator('.bloc-panel')).toBeVisible();
    const box = await page.locator('.map-container').boundingBox();
    await page.screenshot({
      path: 'screenshots/visual/map-blocs-tab.png',
      clip: box ?? undefined,
    });
  });

  test('map container — COMMITTEE tab', async ({ page }) => {
    await page.getByRole('button', { name: 'COMMITTEE' }).click();
    await expect(page.locator('.committee-panel')).toBeVisible();
    const box = await page.locator('.map-container').boundingBox();
    await page.screenshot({
      path: 'screenshots/visual/map-committee-tab.png',
      clip: box ?? undefined,
    });
  });
});

// ---------------------------------------------------------------------------
// SpaceNodePicker (Near Space era)
// ---------------------------------------------------------------------------

test.describe('Visual — SpaceNodePicker', () => {
  test('space node picker — panel open', async ({ page }) => {
    await startNewGame(page);
    await buildFacilityAndSave(page);
    await patchNearSpaceState(page);

    await page.click('.tab-bar button:has-text("NEAR SPACE")');
    await page.waitForTimeout(300);
    await page.click('.map-toolbar button:has-text("ASSETS")');
    await page.waitForSelector('.panel');

    const panel = page.locator('.panel').first();
    await expect(panel).toBeVisible();
    await panel.screenshot({ path: 'screenshots/visual/space-node-picker.png' });
  });
});

// ---------------------------------------------------------------------------
// Full-page snapshots — key game states
// ---------------------------------------------------------------------------

test.describe('Visual — Full-page states', () => {
  test('newgame screen', async ({ page }) => {
    await page.goto('/newgame');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.skip-btn');
    await page.click('.skip-btn');
    await page.screenshot({ path: 'screenshots/visual/full-newgame.png', fullPage: true });
  });

  test('main game turn 1', async ({ page }) => {
    await startNewGame(page);
    await page.screenshot({ path: 'screenshots/visual/full-turn1.png', fullPage: true });
  });

  test('main game turn 2', async ({ page }) => {
    await startNewGame(page);
    await page.getByText('END TURN ⟳').click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'screenshots/visual/full-turn2.png', fullPage: true });
  });

  test('summary screen', async ({ page }) => {
    await page.goto('/summary');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'screenshots/visual/full-summary.png', fullPage: true });
  });
});
