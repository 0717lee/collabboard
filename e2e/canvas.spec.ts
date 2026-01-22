import { test, expect } from '@playwright/test';

test.describe('Canvas Board', () => {
    test.beforeEach(async ({ page }) => {
        // Login and create a board
        await page.goto('/login');
        await page.evaluate(() => localStorage.clear());
        await page.getByPlaceholder('邮箱地址').fill('demo@collabboard.com');
        await page.getByPlaceholder('密码').fill('demo123');
        await page.getByRole('button', { name: '登录' }).click();
        await expect(page).toHaveURL(/.*dashboard/);

        await page.getByRole('button', { name: /新建白板/ }).click();
        await page.getByPlaceholder('输入白板名称').fill('画布测试');
        await page.getByRole('button', { name: '创建' }).click();
        await expect(page).toHaveURL(/.*board\/.+/);
    });

    test('should display canvas with toolbar', async ({ page }) => {
        // Check toolbar is visible
        await expect(page.locator('canvas#fabric-canvas')).toBeVisible();

        // Check some tools are present
        await expect(page.getByRole('button').filter({ has: page.locator('[aria-label="select"]') }).or(
            page.locator('[class*="toolbar"] button').first()
        )).toBeVisible();
    });

    test('should navigate back to dashboard', async ({ page }) => {
        await page.getByRole('button').first().click(); // Back button

        await expect(page).toHaveURL(/.*dashboard/);
    });

    test('should show export dropdown', async ({ page }) => {
        await page.getByRole('button', { name: /导出/ }).click();

        await expect(page.locator('text=导出为 PNG')).toBeVisible();
        await expect(page.locator('text=导出为 SVG')).toBeVisible();
    });

    test('should display zoom controls', async ({ page }) => {
        await expect(page.locator('text=100%')).toBeVisible();
    });

    test('should show collaborator avatars', async ({ page }) => {
        // Wait for mock collaborators to load
        await page.waitForTimeout(1000);

        // Check for collaborator indicators
        await expect(page.locator('[class*="collaborator"]').first()).toBeVisible();
    });
});
