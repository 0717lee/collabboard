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
        if (testInfo.project.name === 'Mobile Chrome') {
            await page.getByRole('button', { name: /更多操作/ }).click();
            await expect(page.locator('text=导出 PNG')).toBeVisible();
            await expect(page.locator('text=导出 SVG')).toBeVisible();
            return;
        }

        await page.getByRole('button', { name: /导出/ }).click();

        await expect(page.locator('text=导出为 PNG')).toBeVisible();
        await expect(page.locator('text=导出为 SVG')).toBeVisible();
    });

    test('should lazy-load chart tools modal and add chart to canvas', async ({ page }) => {
        await page.getByRole('button', { name: /添加图表/ }).click();

        const chartDialog = page.getByRole('dialog', { name: '添加图表' });

        await expect(chartDialog).toBeVisible();
        await expect(page.getByText('图表类型')).toBeVisible();

        const addButton = page.getByRole('button', { name: '添加到画布' });
        await expect(addButton).toBeEnabled();
        await addButton.click();

        await expect(chartDialog).not.toBeVisible();
    });

    test('should display zoom controls', async ({ page }) => {
        await expect(page.locator('text=100%')).toBeVisible();
    });

    test('should show collaborator avatars', async ({ page }) => {
        await page.getByRole('button', { name: /邀请/ }).click();
        await expect(page.locator('text=当前在线 (1 人)')).toBeVisible();
        await expect(page.locator('text=我 (你)')).toBeVisible();
    });

    test('should open version history modal', async ({ page }, testInfo) => {
        if (testInfo.project.name === 'Mobile Chrome') {
            await page.getByRole('button', { name: /更多操作/ }).click();
            await page.getByText('版本历史').click();
        } else {
            await page.getByRole('button', { name: /版本历史/ }).click();
        }

        await expect(page.getByRole('dialog', { name: '版本历史' })).toBeVisible();
    });
});
