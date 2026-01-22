import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
    test.beforeEach(async ({ page }) => {
        // Clear local storage before each test
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
    });

    test('should display login page', async ({ page }) => {
        await page.goto('/login');

        await expect(page.locator('text=CollabBoard')).toBeVisible();
        await expect(page.locator('text=欢迎回来')).toBeVisible();
        await expect(page.getByPlaceholder('邮箱地址')).toBeVisible();
        await expect(page.getByPlaceholder('密码')).toBeVisible();
    });

    test('should login with demo account', async ({ page }) => {
        await page.goto('/login');

        await page.getByPlaceholder('邮箱地址').fill('demo@collabboard.com');
        await page.getByPlaceholder('密码').fill('demo123');
        await page.getByRole('button', { name: '登录' }).click();

        // Should redirect to dashboard
        await expect(page).toHaveURL(/.*dashboard/);
        await expect(page.locator('text=我的白板')).toBeVisible();
    });

    test('should show error for wrong password', async ({ page }) => {
        await page.goto('/login');

        await page.getByPlaceholder('邮箱地址').fill('demo@collabboard.com');
        await page.getByPlaceholder('密码').fill('wrongpassword');
        await page.getByRole('button', { name: '登录' }).click();

        await expect(page.locator('text=密码错误')).toBeVisible();
    });

    test('should navigate to register page', async ({ page }) => {
        await page.goto('/login');

        await page.getByRole('link', { name: '立即注册' }).click();

        await expect(page).toHaveURL(/.*register/);
        await expect(page.locator('text=创建账号')).toBeVisible();
    });

    test('should register a new user', async ({ page }) => {
        await page.goto('/register');

        await page.getByPlaceholder('用户名').fill('Test User');
        await page.getByPlaceholder('邮箱地址').fill('test@example.com');
        await page.getByPlaceholder('密码').first().fill('password123');
        await page.getByPlaceholder('确认密码').fill('password123');
        await page.getByRole('button', { name: '注册' }).click();

        // Should redirect to dashboard
        await expect(page).toHaveURL(/.*dashboard/);
    });

    test('should logout successfully', async ({ page }) => {
        // First login
        await page.goto('/login');
        await page.getByPlaceholder('邮箱地址').fill('demo@collabboard.com');
        await page.getByPlaceholder('密码').fill('demo123');
        await page.getByRole('button', { name: '登录' }).click();
        await expect(page).toHaveURL(/.*dashboard/);

        // Click user avatar to open dropdown
        await page.locator('[class*="userInfo"]').click();
        await page.getByText('退出登录').click();

        // Should redirect to login
        await expect(page).toHaveURL(/.*login/);
    });
});
