import { test, expect } from '@playwright/test';

const loginAndCreateBoard = async (page: import('@playwright/test').Page) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.getByPlaceholder('邮箱地址').fill('demo@collabboard.com');
    await page.getByPlaceholder('密码').fill('demo123');
    await page.getByRole('button', { name: '登录' }).click();
    await expect(page).toHaveURL(/.*dashboard/);

    await page.getByRole('button', { name: /新建白板/ }).click();
    const createDialog = page.getByRole('dialog', { name: '新建白板' });
    await createDialog.getByPlaceholder('输入白板名称').fill('画布测试');
    await createDialog.getByRole('button', { name: /创\s*建/ }).click();
    await expect(page).toHaveURL(/.*board\/.+/);
};

test.describe('Canvas Board', () => {
    test.beforeEach(async ({ page }) => {
        await loginAndCreateBoard(page);
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
        await page.locator('[class*="headerLeft"] button').first().click();

        await expect(page).toHaveURL(/.*dashboard/);
    });

    test('should show export dropdown', async ({ page }, testInfo) => {
        test.skip(testInfo.project.name === 'Mobile Chrome', 'Export control is intentionally hidden on mobile header.');

        await page.getByRole('button', { name: /导出/ }).click();

        await expect(page.locator('text=导出为 PNG')).toBeVisible();
        await expect(page.locator('text=导出为 SVG')).toBeVisible();
    });

    test('should display zoom controls', async ({ page }) => {
        await expect(page.locator('text=100%')).toBeVisible();
    });

    test('should show collaborator avatars', async ({ page }) => {
        await page.getByRole('button', { name: /邀请/ }).click();
        await expect(page.locator('text=当前在线 (1 人)')).toBeVisible();
        await expect(page.locator('text=我 (你)')).toBeVisible();
    });

    test('should open version history modal', async ({ page }) => {
        await page.getByRole('button', { name: /版本历史/ }).click();
        await expect(page.getByRole('dialog', { name: '版本历史' })).toBeVisible();
    });
});
