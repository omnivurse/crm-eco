import { test, expect } from '@playwright/test';

test.describe('Tickets @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('creates a ticket and adds note', async ({ page }) => {
    await page.fill('[name="email"]', 'test@mpbhealth.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/);

    await page.click('a[href="/tickets"]');
    await page.click('a[href="/tickets/new"]');

    await page.fill('[name="subject"]', 'Test Ticket - Automated');
    await page.fill('[name="description"]', 'This is a test ticket created by automation');
    await page.selectOption('[name="priority"]', 'high');

    await page.click('button:has-text("Create Ticket")');

    await expect(page).toHaveURL(/\/tickets\/.+/);
    await expect(page.locator('h1')).toContainText('Test Ticket - Automated');

    await page.fill('textarea[placeholder*="comment"]', 'This is a test note');
    await page.click('button:has-text("Add Comment")');

    await expect(page.locator('text=This is a test note')).toBeVisible();
  });

  test('ticket status flow', async ({ page }) => {
    await page.fill('[name="email"]', 'agent@mpbhealth.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');

    await page.goto('/tickets');
    await page.click('tr:first-child a');

    await expect(page.locator('[data-status="new"]')).toBeVisible();

    await page.selectOption('[name="status"]', 'in_progress');
    await expect(page.locator('[data-status="in_progress"]')).toBeVisible();

    await page.selectOption('[name="status"]', 'resolved');
    await expect(page.locator('[data-status="resolved"]')).toBeVisible();

    await page.selectOption('[name="status"]', 'closed');
    await expect(page.locator('[data-status="closed"]')).toBeVisible();
  });

  test('SLA badge updates', async ({ page }) => {
    await page.fill('[name="email"]', 'agent@mpbhealth.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');

    await page.goto('/tickets/new');
    await page.fill('[name="subject"]', 'P1 Critical Issue');
    await page.fill('[name="description"]', 'Server down');
    await page.selectOption('[name="priority"]', 'urgent');
    await page.click('button:has-text("Create Ticket")');

    const slaBadge = page.locator('[data-testid="sla-timer"]');
    await expect(slaBadge).toBeVisible();

    const badgeText = await slaBadge.textContent();
    expect(badgeText).toMatch(/\d+h|\d+m/);
  });

  test('merges duplicate tickets', async ({ page }) => {
    await page.fill('[name="email"]', 'agent@mpbhealth.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');

    await page.goto('/tickets/new');
    await page.fill('[name="subject"]', 'Network Issue A');
    await page.fill('[name="description"]', 'Cannot connect to network');
    await page.click('button:has-text("Create Ticket")');

    const firstTicketUrl = page.url();

    await page.goto('/tickets/new');
    await page.fill('[name="subject"]', 'Network Issue B');
    await page.fill('[name="description"]', 'Network connection problem');
    await page.click('button:has-text("Create Ticket")');

    await page.click('button:has-text("Merge")');
    await page.fill('[placeholder*="ticket ID"]', firstTicketUrl.split('/').pop()!);
    await page.click('button:has-text("Confirm Merge")');

    await expect(page.locator('text=Merged into')).toBeVisible();
  });
});
