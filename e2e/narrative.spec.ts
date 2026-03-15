import { test, expect, type Page } from '@playwright/test';
import { NARRATIVE_GAME_HELP } from '../src/data/loader';

// ---------------------------------------------------------------------------
// Helper: navigate to /newgame, skip the opening narrative, start a game
// ---------------------------------------------------------------------------

async function startNewGame(page: Page): Promise<void> {
  await page.goto('/newgame');
  await page.waitForLoadState('networkidle');

  // Dismiss the opening narrative (skippable — click Skip)
  await page.waitForSelector('.skip-btn');
  await page.click('.skip-btn');

  // BEGIN MISSION with default bloc
  await page.click('button.btn-begin');
  await page.waitForURL('**/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
}

// ---------------------------------------------------------------------------
// Test — Help? button opens NARRATIVE_GAME_HELP and can be paged through
// ---------------------------------------------------------------------------

test('Help button — open, page through all slides, close', async ({ page }) => {
  await startNewGame(page);

  // Help? button should be visible in the phase controls
  const helpBtn = page.locator('.help-btn');
  await expect(helpBtn).toBeVisible();

  // Open the help modal
  await helpBtn.click();

  // Modal should be visible with the correct title
  const modal = page.locator('[role="dialog"]');
  await expect(modal).toBeVisible();
  await expect(modal.locator('.modal-title')).toHaveText(NARRATIVE_GAME_HELP.title);

  // TRANSMISSION badge should be visible
  await expect(modal.locator('.modal-label')).toHaveText('TRANSMISSION');

  const slideCount = NARRATIVE_GAME_HELP.slides.length;

  // Page through all slides except the last using NEXT →
  for (let i = 0; i < slideCount - 1; i++) {
    const nextBtn = modal.locator('.nav-btn--next');
    await expect(nextBtn).toBeVisible();
    await nextBtn.click();
  }

  // On the final slide, NEXT is replaced by CLOSE
  await expect(modal.locator('.nav-btn--next')).not.toBeVisible();
  const closeBtn = modal.locator('.nav-btn--close');
  await expect(closeBtn).toBeVisible();
  await closeBtn.click();

  // Modal should be gone
  await expect(modal).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// Test — Skip button dismisses immediately on skippable narratives
// ---------------------------------------------------------------------------

test('opening narrative — Skip button dismisses immediately', async ({ page }) => {
  await page.goto('/newgame');
  await page.waitForLoadState('networkidle');

  // Opening narrative should appear
  const modal = page.locator('[role="dialog"]');
  await expect(modal).toBeVisible();
  await expect(modal.locator('.skip-btn')).toBeVisible();

  // Skip should dismiss without paging through
  await modal.locator('.skip-btn').click();
  await expect(modal).not.toBeVisible();

  // Bloc picker should now be accessible
  await expect(page.locator('button.btn-begin')).toBeVisible();
});

// ---------------------------------------------------------------------------
// Test — Keyboard navigation: arrow keys page through slides
// ---------------------------------------------------------------------------

test('Help modal — keyboard navigation (ArrowRight / ArrowLeft)', async ({ page }) => {
  await startNewGame(page);

  await page.locator('.help-btn').click();
  const modal = page.locator('[role="dialog"]');
  await expect(modal).toBeVisible();

  // ArrowRight should advance to slide 2 (PREV becomes enabled)
  await page.keyboard.press('ArrowRight');
  const prevBtn = modal.locator('button', { hasText: '← PREV' });
  await expect(prevBtn).not.toBeDisabled();

  // ArrowLeft should go back to slide 1 (PREV disabled again)
  await page.keyboard.press('ArrowLeft');
  await expect(prevBtn).toBeDisabled();
});
