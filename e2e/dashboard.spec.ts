import { test, expect } from '@playwright/test';

const login = async (page: import('@playwright/test').Page) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.getByPlaceholder('邮箱地址').fill('demo@collabboard.com');
    await page.getByPlaceholder('密码').fill('demo123');
    await page.getByRole('button', { name: '登录' }).click();
    await expect(page).toHaveURL(/.*dashboard/);
};

test.describe('Dashboard', () => {
    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('should display dashboard with user info', async ({ page }, testInfo) => {
        await expect(page.locator('text=CollabBoard')).toBeVisible();
        await expect(page.locator('text=我的白板')).toBeVisible();

        if (testInfo.project.name === 'Mobile Chrome') {
            await expect(page.locator('[class*="userInfo"]')).toBeVisible();
        } else {
            await expect(page.locator('text=Demo User')).toBeVisible();
        }
    });

    test('should create a new board', async ({ page }) => {
        await page.getByRole('button', { name: /新建白板/ }).click();

        const createDialog = page.getByRole('dialog', { name: '新建白板' });
        await expect(createDialog).toBeVisible();
        await createDialog.getByPlaceholder('输入白板名称').fill('我的测试白板');
        await createDialog.getByRole('button', { name: /创\s*建/ }).click();

        // Should navigate to board page
        await expect(page).toHaveURL(/.*board\/.+/);
    });

    test('should search boards', async ({ page }, testInfo) => {
        test.skip(testInfo.project.name === 'Mobile Chrome', 'Search input is intentionally hidden on mobile.');

        // Create a board first
        await page.getByRole('button', { name: /新建白板/ }).click();
        const createDialog = page.getByRole('dialog', { name: '新建白板' });
        await createDialog.getByPlaceholder('输入白板名称').fill('搜索测试白板');
        await createDialog.getByRole('button', { name: /创\s*建/ }).click();
        await page.goto('/dashboard');

        // Search for the board
        await page.getByPlaceholder('搜索白板...').fill('搜索测试');

        await expect(page.locator('text=搜索测试白板')).toBeVisible();
    });

    test('should delete an owned board', async ({ page }, testInfo) => {
        test.skip(testInfo.project.name === 'Mobile Chrome', 'Delete action is not exposed in the mobile dashboard layout.');

        await page.getByRole('button', { name: /新建白板/ }).click();
        const createDialog = page.getByRole('dialog', { name: '新建白板' });
        await createDialog.getByPlaceholder('输入白板名称').fill('删除测试白板');
        await createDialog.getByRole('button', { name: /创\s*建/ }).click();
        await expect(page).toHaveURL(/.*board\/.+/);

        await page.goto('/dashboard');

        const boardCard = page.locator('[class*="boardCard"]').filter({ hasText: '删除测试白板' }).first();
        await expect(boardCard).toBeVisible();
        await boardCard.getByRole('button', { name: '删除白板' }).click();

        const deleteDialog = page.getByRole('dialog', { name: '删除白板' });
        await expect(deleteDialog).toBeVisible();
        await deleteDialog.getByRole('button', { name: /删\s*除/ }).click();

        await expect(boardCard).not.toBeVisible();
    });

    test('should navigate to settings', async ({ page }) => {
        await page.locator('[class*="userInfo"]').click();
        await page.getByText('设置').click();

        await expect(page).toHaveURL(/.*settings/);
        await expect(page.getByRole('heading', { name: '语言' })).toBeVisible();
    });
});
