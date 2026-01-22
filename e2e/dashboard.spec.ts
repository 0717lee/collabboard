import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
    test.beforeEach(async ({ page }) => {
        // Login before each test
        await page.goto('/login');
        await page.evaluate(() => localStorage.clear());
        await page.getByPlaceholder('邮箱地址').fill('demo@collabboard.com');
        await page.getByPlaceholder('密码').fill('demo123');
        await page.getByRole('button', { name: '登录' }).click();
        await expect(page).toHaveURL(/.*dashboard/);
    });

    test('should display dashboard with user info', async ({ page }) => {
        await expect(page.locator('text=CollabBoard')).toBeVisible();
        await expect(page.locator('text=我的白板')).toBeVisible();
        await expect(page.locator('text=Demo User')).toBeVisible();
    });

    test('should create a new board', async ({ page }) => {
        await page.getByRole('button', { name: /新建白板/ }).click();

        await expect(page.locator('text=新建白板')).toBeVisible();
        await page.getByPlaceholder('输入白板名称').fill('我的测试白板');
        await page.getByRole('button', { name: '创建' }).click();

        // Should navigate to board page
        await expect(page).toHaveURL(/.*board\/.+/);
    });

    test('should search boards', async ({ page }) => {
        // Create a board first
        await page.getByRole('button', { name: /新建白板/ }).click();
        await page.getByPlaceholder('输入白板名称').fill('搜索测试白板');
        await page.getByRole('button', { name: '创建' }).click();
        await page.goto('/dashboard');

        // Search for the board
        await page.getByPlaceholder('搜索白板...').fill('搜索测试');

        await expect(page.locator('text=搜索测试白板')).toBeVisible();
    });

    test('should navigate to settings', async ({ page }) => {
        await page.locator('[class*="userInfo"]').click();
        await page.getByText('设置').click();

        await expect(page).toHaveURL(/.*settings/);
        await expect(page.locator('text=外观')).toBeVisible();
    });
});
