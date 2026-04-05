import { test, expect, type Page } from '@playwright/test';

const getCanvasCenter = async (page: Page) => {
    const box = await page.locator('canvas#fabric-canvas').boundingBox();
    if (!box) {
        throw new Error('Canvas not found');
    }

    return {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
    };
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const getFabricObjects = async (page: Page) => page.evaluate(() => {
    const fabricWindow = window as unknown as {
        __collabboardCanvas?: { getObjects: () => unknown[] };
    };
    const canvas = fabricWindow.__collabboardCanvas;
    if (!canvas) return [];

    return canvas.getObjects().map((object: any) => ({
        type: object.type,
        fill: object.fill,
        text: object.text,
        children: (object._objects || []).map((child: any) => ({
            type: child.type,
            text: child.text,
            fill: child.fill,
        })),
    }));
});

const getUndoDebugState = async (page: Page) => page.evaluate(() => {
    const ref = (window as unknown as {
        __collabboardUndoDebugRef?: { current?: any };
    }).__collabboardUndoDebugRef;

    return ref?.current || {};
});

const clickTool = async (page: Page, tool: 'draw' | 'stickyNote') => {
    const toolIndex = tool === 'draw' ? 1 : 7;
    await page.locator('[class*="toolbar"] button').nth(toolIndex).click();
};

const loginAndCreateBoard = async (page: Page) => {
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

    test('should draw a path with the brush tool', async ({ page }, testInfo) => {
        test.skip(testInfo.project.name === 'Mobile Chrome', 'Canvas interaction requires desktop pointer input.');

        const startCount = (await getFabricObjects(page)).length;
        const center = await getCanvasCenter(page);

        // Switch to draw tool
        await clickTool(page, 'draw');

        // Draw a stroke on the canvas
        await page.mouse.move(center.x - 80, center.y - 40);
        await page.mouse.down();
        await page.mouse.move(center.x + 80, center.y + 40, { steps: 12 });
        await page.mouse.up();

        // A new path object should appear
        await expect.poll(
            async () => (await getFabricObjects(page)).length,
            { timeout: 8000 },
        ).toBeGreaterThan(startCount);
    });

    test('should create a sticky note with default yellow background', async ({ page }, testInfo) => {
        test.skip(testInfo.project.name === 'Mobile Chrome', 'Canvas interaction requires desktop pointer input.');

        const center = await getCanvasCenter(page);

        // Switch to sticky note tool and click on canvas
        await clickTool(page, 'stickyNote');
        await page.mouse.click(center.x + 120, center.y - 80);

        // Wait a bit for the sticky note to be created and editable
        await page.waitForTimeout(500);

        // Click elsewhere to deselect / exit editing
        await page.mouse.click(center.x - 200, center.y - 200);
        await page.waitForTimeout(300);

        // Verify sticky note was created with default yellow background
        await expect.poll(async () => {
            const objects = await getFabricObjects(page);
            const sticky = objects.find((obj) => obj.children.length > 0 && obj.children.some((c) => c.type === 'rect'));
            const rect = sticky?.children.find((c) => c.type === 'rect');
            return rect?.fill || '';
        }, { timeout: 8000 }).toBe('#FFF3A3');
    });

    test('should support undo after drawing', async ({ page }, testInfo) => {
        test.skip(testInfo.project.name === 'Mobile Chrome', 'Canvas interaction requires desktop pointer input.');

        const center = await getCanvasCenter(page);

        // Draw a path
        await clickTool(page, 'draw');
        await page.mouse.move(center.x - 80, center.y - 40);
        await page.mouse.down();
        await page.mouse.move(center.x + 80, center.y + 40, { steps: 12 });
        await page.mouse.up();

        // Wait for history commit
        await page.waitForTimeout(600);

        const countAfterDraw = (await getFabricObjects(page)).length;
        expect(countAfterDraw).toBeGreaterThan(0);

        // Click empty area to deselect
        await page.mouse.click(center.x - 200, center.y + 200);
        await page.waitForTimeout(300);

        // Trigger undo via keyboard shortcut
        await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
        await page.waitForTimeout(500);

        const undoDebug = await getUndoDebugState(page);

        // Verify undo executed and actually reduced past
        expect(undoDebug.lastReason).toMatch(/^executed/);
        expect(undoDebug.pastBeforeUndo).toBeGreaterThan(0);
        expect(undoDebug.pastAfterUndo).toBeLessThan(undoDebug.pastBeforeUndo);
        expect(undoDebug.futureAfterUndo).toBeGreaterThan(0);
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
