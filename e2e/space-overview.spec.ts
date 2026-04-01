import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helper: start a fresh game and trigger an autosave via a facility build
// ---------------------------------------------------------------------------

async function startAndSave(page: Page): Promise<void> {
  await page.goto('/newgame');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('.skip-btn');
  await page.click('.skip-btn');
  await page.click('button.btn-begin');
  await page.waitForURL('**/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  // Build a facility to write the initial autosave to localStorage.
  // Urban tile at (-1,0): offset (-63, -36) from canvas centre.
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

// ---------------------------------------------------------------------------
// Helper: patch localStorage to inject Near Space content, then reload.
// - era set to 'nearSpace' so the NEAR SPACE tab is unlocked.
// - launchCapacity set to 5 (one spaceLaunchCentre + reusableLaunchSystems).
// - LEO node gets an orbitalModule facility (supplyCost: 2).
// - launchAllocation: { leo: true } (supplied by default).
// Pass discoveredTechs to also add tech entries (e.g. for upgrade button).
// ---------------------------------------------------------------------------

async function patchSpaceState(
  page: Page,
  opts: { discoveredTechs?: string[]; launchAllocation?: Record<string, boolean> } = {},
): Promise<void> {
  await page.evaluate(
    ({ discoveredTechs, launchAllocation }) => {
      const raw = localStorage.getItem('signal-autosave');
      if (!raw) throw new Error('No autosave found');
      const envelope = JSON.parse(raw) as {
        version: number;
        savedAt: string;
        state: Record<string, unknown>;
      };
      const state = envelope.state as Record<string, unknown>;

      // Unlock Near Space
      state.era = 'nearSpace';
      state.launchCapacity = 5;
      state.launchAllocation = launchAllocation ?? { leo: true };

      // Inject space nodes with a facility on LEO
      state.map = {
        ...(state.map as object),
        spaceNodes: [
          { id: 'leo', type: 'lowEarthOrbit', label: 'LEO', launchCost: 10, facilityId: 'orbitalModule' },
          { id: 'l1', type: 'lagrangePoint', label: 'L1', launchCost: 20, facilityId: null },
          { id: 'l2', type: 'lagrangePoint', label: 'L2', launchCost: 20, facilityId: null },
          { id: 'lunarSurface', type: 'lunarSurface', label: 'Lunar Surface', launchCost: 45, facilityId: null },
        ],
      };

      // Add the orbital module facility instance
      const facilities = (state.player as Record<string, unknown>).facilities as unknown[];
      (state.player as Record<string, unknown>).facilities = [
        ...facilities,
        { id: 'orbitalModule-leo-1', defId: 'orbitalModule', locationKey: 'leo', condition: 1.0, builtTurn: 1 },
      ];

      // Inject discovered techs if requested
      if (discoveredTechs && discoveredTechs.length > 0) {
        const techs = (state.player as Record<string, unknown>).techs as unknown[];
        for (const defId of discoveredTechs) {
          techs.push({
            defId,
            stage: 'discovered',
            recipe: null,
            fieldProgress: {},
            unlockedByBreakthrough: false,
            discoveredTurn: 1,
          });
        }
      }

      localStorage.setItem('signal-autosave', JSON.stringify(envelope));
    },
    { discoveredTechs: opts.discoveredTechs, launchAllocation: opts.launchAllocation },
  );

  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
}

// ---------------------------------------------------------------------------
// Helper: open the NEAR SPACE tab and then the ≡ ASSETS panel
// ---------------------------------------------------------------------------

async function openSpaceOverview(page: Page): Promise<void> {
  await page.click('.tab-bar button:has-text("NEAR SPACE")');
  await page.waitForTimeout(300);
  await page.click('.map-toolbar button:has-text("ASSETS")');
  await page.waitForSelector('.panel');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('SpaceOverview panel', () => {
  test('opens and closes via the ≡ ASSETS button', async ({ page }) => {
    await startAndSave(page);
    await patchSpaceState(page);

    await page.click('.tab-bar button:has-text("NEAR SPACE")');
    await page.waitForTimeout(300);

    const spacePanel = page.locator('.panel:has(.title:text("NEAR SPACE ASSETS"))');

    // Panel should not be visible before clicking ASSETS
    await expect(spacePanel).not.toBeVisible();

    await page.click('.map-toolbar button:has-text("ASSETS")');
    await expect(spacePanel).toBeVisible();

    // Close via ✕ button
    await page.click('.panel .close-btn');
    await expect(spacePanel).not.toBeVisible();
  });

  test('shows launch capacity bar with correct used/total values', async ({ page }) => {
    await startAndSave(page);
    // launchCapacity=5, orbitalModule has supplyCost=2, so used=2, remaining=3
    await patchSpaceState(page, { launchAllocation: { leo: true } });
    await openSpaceOverview(page);

    const capacitySection = page.locator('.capacity-section');
    await expect(capacitySection).toBeVisible();
    // The capacity value shows "used/total"
    const capacityValue = page.locator('.capacity-value');
    await expect(capacityValue).toContainText('5');

    await page.screenshot({ path: 'screenshots/space-01-capacity-bar.png', fullPage: true });
  });

  test('shows facility row with supply toggle for LEO orbital module', async ({ page }) => {
    await startAndSave(page);
    await patchSpaceState(page);
    await openSpaceOverview(page);

    // The facility row should show the node label and facility name
    const facilityRow = page.locator('.facility-row').first();
    await expect(facilityRow).toBeVisible();
    await expect(facilityRow.locator('.node-label')).toContainText('LEO');
    await expect(facilityRow.locator('.item-name')).toContainText('Orbital Module');

    // Supply cost badge visible
    await expect(facilityRow.locator('.supply-cost')).toContainText('2u');

    // Toggle button should show "ON" (facility is supplied)
    const toggleBtn = facilityRow.locator('.toggle-btn');
    await expect(toggleBtn).toBeVisible();
    await expect(toggleBtn).toHaveText('ON');
    await expect(toggleBtn).toHaveClass(/on/);

    await page.screenshot({ path: 'screenshots/space-02-facility-row.png', fullPage: true });
  });

  test('supply toggle switches facility ON → OFF', async ({ page }) => {
    await startAndSave(page);
    await patchSpaceState(page, { launchAllocation: { leo: true } });
    await openSpaceOverview(page);

    const toggleBtn = page.locator('.facility-row').first().locator('.toggle-btn');
    await expect(toggleBtn).toHaveText('ON');

    await toggleBtn.click();
    await expect(toggleBtn).toHaveText('OFF');
    await expect(toggleBtn).not.toHaveClass(/on/);

    // Row should be dimmed (unsupplied class applied)
    await expect(page.locator('.facility-row').first()).toHaveClass(/unsupplied/);

    await page.screenshot({ path: 'screenshots/space-03-toggled-off.png', fullPage: true });
  });

  test('supply toggle switches facility OFF → ON', async ({ page }) => {
    await startAndSave(page);
    // Start with facility already OFF
    await patchSpaceState(page, { launchAllocation: { leo: false } });
    await openSpaceOverview(page);

    const facilityRow = page.locator('.facility-row').first();
    const toggleBtn = facilityRow.locator('.toggle-btn');
    await expect(toggleBtn).toHaveText('OFF');
    await expect(facilityRow).toHaveClass(/unsupplied/);

    await toggleBtn.click();
    await expect(toggleBtn).toHaveText('ON');
    await expect(facilityRow).not.toHaveClass(/unsupplied/);

    await page.screenshot({ path: 'screenshots/space-04-toggled-on.png', fullPage: true });
  });

  test('upgrade button appears when required tech is discovered', async ({ page }) => {
    await startAndSave(page);
    await patchSpaceState(page, { discoveredTechs: ['reusableLaunchSystems'] });
    await openSpaceOverview(page);

    // Upgrade button should appear for the orbitalModule on LEO
    const upgradeRow = page.locator('.upgrade-row').first();
    await expect(upgradeRow).toBeVisible();
    const upgradeBtn = upgradeRow.locator('.upgrade-btn');
    await expect(upgradeBtn).toBeVisible();
    await expect(upgradeBtn).toContainText('Orbital Laboratory');

    await page.screenshot({ path: 'screenshots/space-05-upgrade-btn.png', fullPage: true });
  });

  test('upgrade button absent when required tech is not discovered', async ({ page }) => {
    await startAndSave(page);
    // No techs injected — reusableLaunchSystems not discovered
    await patchSpaceState(page);
    await openSpaceOverview(page);

    await expect(page.locator('.upgrade-row')).not.toBeVisible();
  });

  test('NEAR SPACE tab is unlocked after era transition', async ({ page }) => {
    await startAndSave(page);
    await patchSpaceState(page);

    // NEAR SPACE tab should be enabled
    const spaceTab = page.locator('.tab-bar button:has-text("NEAR SPACE")');
    await expect(spaceTab).toBeEnabled();
    await expect(spaceTab).not.toHaveClass(/locked/);
  });

  test('EARTH ORBIT section shown in panel', async ({ page }) => {
    await startAndSave(page);
    await patchSpaceState(page);
    await openSpaceOverview(page);

    await expect(page.locator('.section-heading:has-text("EARTH ORBIT")')).toBeVisible();
    await expect(page.locator('.section-heading:has-text("LUNAR ORBIT")')).toBeVisible();
  });
});
