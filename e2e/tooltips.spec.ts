import { test, expect, type Page, type Locator } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helper: navigate to a running game
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

// ---------------------------------------------------------------------------
// Helper: hover a tooltip host, assert the bubble is visible and fully
// within the viewport. Returns the bubble text for content assertions.
// ---------------------------------------------------------------------------

async function assertTooltipInViewport(page: Page, host: Locator): Promise<string> {
  await host.hover();

  const bubble = host.locator('.tooltip-bubble');
  await expect(bubble).toBeVisible({ timeout: 1000 });

  const bounds = await bubble.boundingBox();
  expect(bounds, 'tooltip bubble must have a bounding box').not.toBeNull();

  const viewport = page.viewportSize();
  expect(viewport, 'viewport size must be available').not.toBeNull();

  const tolerance = 2; // px — allow sub-pixel rounding
  expect(
    bounds!.x,
    `tooltip left edge (${bounds!.x.toFixed(1)}px) must be on screen`,
  ).toBeGreaterThanOrEqual(-tolerance);

  expect(
    bounds!.y,
    `tooltip top edge (${bounds!.y.toFixed(1)}px) must be on screen`,
  ).toBeGreaterThanOrEqual(-tolerance);

  expect(
    bounds!.x + bounds!.width,
    `tooltip right edge (${(bounds!.x + bounds!.width).toFixed(1)}px) must not exceed viewport width (${viewport!.width}px)`,
  ).toBeLessThanOrEqual(viewport!.width + tolerance);

  expect(
    bounds!.y + bounds!.height,
    `tooltip bottom edge (${(bounds!.y + bounds!.height).toFixed(1)}px) must not exceed viewport height (${viewport!.height}px)`,
  ).toBeLessThanOrEqual(viewport!.height + tolerance);

  // Verify the bubble has readable text (non-empty, non-whitespace)
  const text = (await bubble.textContent()) ?? '';
  expect(text.trim().length, 'tooltip text must not be empty').toBeGreaterThan(0);

  return text.trim();
}

// ---------------------------------------------------------------------------
// Tests — resource tooltips
// ---------------------------------------------------------------------------

test.describe('HUD resource tooltips', () => {
  test.beforeEach(async ({ page }) => {
    await startNewGame(page);
  });

  test('FUND tooltip is visible and on screen', async ({ page }) => {
    const host = page.locator('.tooltip-host:has(.res-label:text("FUND"))');
    const text = await assertTooltipInViewport(page, host);
    // HQ provides +5 funding/turn from game start, so the breakdown format is always shown.
    expect(text).toContain('Funding');
    expect(text).toContain('Headquarters');
    await page.screenshot({ path: 'screenshots/tooltips/fund-tooltip.png', fullPage: true });
  });

  test('MAT tooltip is visible and on screen', async ({ page }) => {
    const host = page.locator('.tooltip-host:has(.res-label:text("MAT"))');
    const text = await assertTooltipInViewport(page, host);
    expect(text).toBe('Raw materials. Gained from mines and industrial zones.');
    await page.screenshot({ path: 'screenshots/tooltips/mat-tooltip.png', fullPage: true });
  });

  test('WILL resource tooltip is visible and on screen', async ({ page }) => {
    const host = page.locator('.tooltip-host:has(.res-label:text("WILL"))');
    const text = await assertTooltipInViewport(page, host);
    expect(text).toContain('Political Will');
    expect(text).toMatch(/Natural (drift|recovery)/);
    await page.screenshot({ path: 'screenshots/tooltips/will-resource-tooltip.png', fullPage: true });
  });
});

// ---------------------------------------------------------------------------
// Tests — research field tooltips
// ---------------------------------------------------------------------------

test.describe('HUD research field tooltips', () => {
  test.beforeEach(async ({ page }) => {
    await startNewGame(page);
  });

  const FIELD_CASES: Array<[label: string, expectedText: string]> = [
    ['PHY', 'Physics — drives signal detection and propulsion research.'],
    ['MATH', 'Mathematics — underpins cryptography, navigation, and signal decoding.'],
    ['ENG', 'Engineering — enables facility construction and hardware projects.'],
    ['BIO', 'Biochemistry — supports life sciences, habitat, and medical research.'],
    ['COMP', 'Computing — accelerates all research; essential for signal analysis.'],
    ['SOC', 'Social Science — improves Political Will generation and diplomacy.'],
  ];

  for (const [label, expectedText] of FIELD_CASES) {
    test(`${label} field tooltip is visible and on screen`, async ({ page }) => {
      const host = page.locator(`.tooltip-host:has(.field-label:text("${label}"))`);
      const text = await assertTooltipInViewport(page, host);
      expect(text).toBe(expectedText);
      await page.screenshot({
        path: `screenshots/tooltips/field-${label.toLowerCase()}-tooltip.png`,
        fullPage: true,
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Tests — climate and will bar tooltips
// ---------------------------------------------------------------------------

test.describe('HUD bar tooltips', () => {
  test.beforeEach(async ({ page }) => {
    await startNewGame(page);
  });

  test('CLIMATE bar tooltip is visible and on screen', async ({ page }) => {
    const host = page.locator('.hud-center .tooltip-host').first();
    const text = await assertTooltipInViewport(page, host);
    expect(text).toContain('Climate pressure');
    await page.screenshot({ path: 'screenshots/tooltips/climate-bar-tooltip.png', fullPage: true });
  });

  test('WILL bar tooltip is visible and on screen', async ({ page }) => {
    const host = page.locator('.hud-center .tooltip-host').last();
    const text = await assertTooltipInViewport(page, host);
    expect(text).toBe('Global political will level.');
    await page.screenshot({ path: 'screenshots/tooltips/will-bar-tooltip.png', fullPage: true });
  });
});

// ---------------------------------------------------------------------------
// Tests — HUD menu button tooltip
// ---------------------------------------------------------------------------

test.describe('HUD menu button tooltip', () => {
  test('menu button tooltip is visible and on screen', async ({ page }) => {
    await startNewGame(page);
    const host = page.locator('.tooltip-host:has(.menu-btn)');
    const text = await assertTooltipInViewport(page, host);
    expect(text).toBe('Game menu');
    await page.screenshot({ path: 'screenshots/tooltips/menu-btn-tooltip.png', fullPage: true });
  });
});

// ---------------------------------------------------------------------------
// Tests — map tab bar tooltips
// ---------------------------------------------------------------------------

test.describe('Map tab bar tooltips', () => {
  test.beforeEach(async ({ page }) => {
    await startNewGame(page);
  });

  test('EARTH tab tooltip is visible and on screen', async ({ page }) => {
    const host = page.locator('.tab-bar .tooltip-host').first();
    const text = await assertTooltipInViewport(page, host);
    expect(text).toContain('EARTH');
    await page.screenshot({ path: 'screenshots/tooltips/earth-tab-tooltip.png', fullPage: true });
  });

  test('locked tab tooltips mention unlocking', async ({ page }) => {
    // NEAR SPACE and ASTEROID BELT are locked in Era 1
    const hosts = page.locator('.tab-bar .tooltip-host');
    const count = await hosts.count();
    for (let i = 1; i < count; i++) {
      const text = await assertTooltipInViewport(page, hosts.nth(i));
      expect(text).toMatch(/unlock|switch/i);
      await page.screenshot({
        path: `screenshots/tooltips/locked-tab-${i}-tooltip.png`,
        fullPage: true,
      });
      await page.mouse.move(0, 0);
    }
  });
});

// ---------------------------------------------------------------------------
// Tests — ResearchFeed signal tooltip
// ---------------------------------------------------------------------------

test.describe('ResearchFeed signal tooltip', () => {
  test('signal label tooltip is visible and on screen', async ({ page }) => {
    await startNewGame(page);
    const host = page.locator('.tooltip-host:has(.signal-label)');
    const text = await assertTooltipInViewport(page, host);
    expect(text).toContain('signal');
    await page.screenshot({ path: 'screenshots/tooltips/signal-label-tooltip.png', fullPage: true });
  });
});

// ---------------------------------------------------------------------------
// Sweep — every tooltip host on the page is within the viewport
// ---------------------------------------------------------------------------

test('all tooltip hosts are within the viewport', async ({ page }) => {
  await startNewGame(page);

  const hosts = page.locator('.tooltip-host');
  const count = await hosts.count();
  expect(count, 'expected at least one tooltip host on the page').toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    await assertTooltipInViewport(page, hosts.nth(i));
    if (i === 0) {
      // Capture one representative active-tooltip state from the sweep
      await page.screenshot({ path: 'screenshots/tooltips/all-hosts-sweep.png', fullPage: true });
    }
    // Move mouse away between iterations so the next hover registers cleanly
    await page.mouse.move(0, 0);
  }
});
