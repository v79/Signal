import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helper: start a fresh game from the new-game screen and wait for Phaser
// ---------------------------------------------------------------------------

async function startNewGame(page: Page): Promise<void> {
  await page.goto('/newgame');
  await page.waitForLoadState('networkidle');
  await page.click('button.btn-begin');
  await page.waitForURL('**/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
}

// ---------------------------------------------------------------------------
// Helper: open the tech tree modal and wait for its canvas to mount
// ---------------------------------------------------------------------------

async function openTechTree(page: Page): Promise<void> {
  await page.click('.tree-btn');
  await page.waitForSelector('[aria-label="Tech Tree"]');
  // Allow Phaser to initialise its canvas inside the modal container
  await page.waitForTimeout(800);
}

// ---------------------------------------------------------------------------
// Test 1 — Button is present in the Research Feed panel
// ---------------------------------------------------------------------------

test('tech tree — TECH TREE button is visible in the research feed', async ({ page }) => {
  await startNewGame(page);
  const btn = page.locator('.tree-btn');
  await expect(btn).toBeVisible();
  await expect(btn).toHaveText('TECH TREE');
});

// ---------------------------------------------------------------------------
// Test 2 — Clicking the button opens the modal with a Phaser canvas
// ---------------------------------------------------------------------------

test('tech tree — modal opens with title and canvas on button click', async ({ page }) => {
  await startNewGame(page);
  await openTechTree(page);

  // Modal container is visible
  const modal = page.locator('[aria-label="Tech Tree"]');
  await expect(modal).toBeVisible();

  // Header title is rendered
  await expect(modal.locator('.modal-title')).toHaveText('RESEARCH DATABASE');

  // Phaser creates a <canvas> inside the container div
  const canvas = modal.locator('canvas');
  await expect(canvas).toBeVisible();

  await page.screenshot({ path: 'screenshots/tech-tree-open.png', fullPage: true });
});

// ---------------------------------------------------------------------------
// Test 3 — Close button dismisses the modal
// ---------------------------------------------------------------------------

test('tech tree — close button dismisses the modal', async ({ page }) => {
  await startNewGame(page);
  await openTechTree(page);

  await page.click('.close-btn');

  await expect(page.locator('[aria-label="Tech Tree"]')).toBeHidden();
});

// ---------------------------------------------------------------------------
// Test 4 — Escape key dismisses the modal
// ---------------------------------------------------------------------------

test('tech tree — Escape key dismisses the modal', async ({ page }) => {
  await startNewGame(page);
  await openTechTree(page);

  await page.keyboard.press('Escape');

  await expect(page.locator('[aria-label="Tech Tree"]')).toBeHidden();
});

// ---------------------------------------------------------------------------
// Test 5 — Clicking the backdrop dismisses the modal
// ---------------------------------------------------------------------------

test('tech tree — clicking the backdrop dismisses the modal', async ({ page }) => {
  await startNewGame(page);
  await openTechTree(page);

  // Click the very edge of the backdrop (outside the modal box)
  const backdrop = page.locator('.backdrop');
  const box = await backdrop.boundingBox();
  if (box) {
    // Click near the top-left corner of the backdrop, which is outside the modal box
    await backdrop.click({ position: { x: 10, y: 10 } });
  }

  await expect(page.locator('[aria-label="Tech Tree"]')).toBeHidden();
});

// ---------------------------------------------------------------------------
// Test 6 — Modal can be re-opened after closing
// ---------------------------------------------------------------------------

test('tech tree — modal can be reopened after closing', async ({ page }) => {
  await startNewGame(page);

  await openTechTree(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('[aria-label="Tech Tree"]')).toBeHidden();

  await openTechTree(page);
  await expect(page.locator('[aria-label="Tech Tree"]')).toBeVisible();
  await page.screenshot({ path: 'screenshots/tech-tree-reopened.png', fullPage: true });
});

// ---------------------------------------------------------------------------
// Test 7 — Game is still functional after closing the modal
// ---------------------------------------------------------------------------

test('tech tree — game phase controls still work after closing modal', async ({ page }) => {
  await startNewGame(page);

  await openTechTree(page);
  await page.click('.close-btn');

  // Should still be able to advance the turn
  await page.getByText('END TURN ⟳').click();
  await page.waitForTimeout(800);
  await expect(page.getByText('END TURN ⟳')).toBeVisible();
});
