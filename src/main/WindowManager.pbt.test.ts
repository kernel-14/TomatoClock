/**
 * Property-Based Tests for WindowManager
 * 
 * These tests verify universal properties that should hold across all inputs
 * using the fast-check library for property-based testing.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { WindowManager } from './WindowManager';
import { DataService } from './DataService';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock Electron's BrowserWindow
vi.mock('electron', () => ({
  BrowserWindow: vi.fn().mockImplementation((options) => {
    const position = { x: options.x || 0, y: options.y || 0 };
    let alwaysOnTop = options.alwaysOnTop || false;
    let opacity = 1.0;

    return {
      loadURL: vi.fn(),
      loadFile: vi.fn(),
      on: vi.fn(),
      setAlwaysOnTop: vi.fn((enabled: boolean) => {
        alwaysOnTop = enabled;
      }),
      isAlwaysOnTop: vi.fn(() => alwaysOnTop),
      setOpacity: vi.fn((value: number) => {
        opacity = value;
      }),
      getOpacity: vi.fn(() => opacity),
      getPosition: vi.fn(() => [position.x, position.y]),
      setPosition: vi.fn((x: number, y: number) => {
        position.x = x;
        position.y = y;
      }),
    };
  }),
}));

describe('WindowManager - Property-Based Tests', () => {
  let testDbPath: string;
  let tempDir: string;
  let dataService: DataService;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pomodoro-wm-pbt-'));
    testDbPath = path.join(tempDir, 'test.db');

    // Initialize DataService
    dataService = new DataService(testDbPath);
    await dataService.initialize();
  });

  afterEach(() => {
    // Close database connection
    dataService.close();

    // Clean up all files in temp directory
    try {
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        files.forEach(file => {
          try {
            fs.unlinkSync(path.join(tempDir, file));
          } catch (e) {
            // Ignore errors on cleanup
          }
        });
        fs.rmdirSync(tempDir);
      }
    } catch (e) {
      // Ignore cleanup errors in tests
    }
  });

  /**
   * Property 13: 窗口位置往返一致性 (Window Position Round-Trip Consistency)
   * Feature: pomodoro-timer, Property 13: 对于任何有效的窗口位置坐标，保存后重新加载应该得到相同的坐标值
   * 
   * **Validates: Requirements 5.2, 5.3**
   * 
   * This property verifies that for ANY valid window position coordinates (x, y),
   * after saving the position and then restoring it, we should get back the exact
   * same coordinates. This ensures data persistence works correctly for window positions.
   */
  it('Property 13: Window position round-trip consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary window positions
        // x and y should be reasonable screen coordinates (-10000 to 10000)
        fc.record({
          x: fc.integer({ min: -10000, max: 10000 }),
          y: fc.integer({ min: -10000, max: 10000 }),
        }),
        async (position) => {
          // Create a fresh database for this iteration
          const iterationTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pomodoro-wm-pbt-iter-'));
          const iterationDbPath = path.join(iterationTempDir, 'test.db');
          const iterationDataService = new DataService(iterationDbPath);
          await iterationDataService.initialize();

          try {
            // Create WindowManager instance
            const windowManager = new WindowManager(iterationDataService);

            // Save the window position
            await windowManager.saveWindowPosition(position.x, position.y);

            // Restore the window position
            const restored = await windowManager.restoreWindowPosition();

            // Verify round-trip consistency
            expect(restored.x).toBe(position.x);
            expect(restored.y).toBe(position.y);
          } finally {
            // Clean up
            iterationDataService.close();
            try {
              const files = fs.readdirSync(iterationTempDir);
              files.forEach(file => {
                try {
                  fs.unlinkSync(path.join(iterationTempDir, file));
                } catch (e) {
                  // Ignore errors on cleanup
                }
              });
              fs.rmdirSync(iterationTempDir);
            } catch (e) {
              // Ignore cleanup errors
            }
          }
        }
      ),
      { numRuns: 100 } // Run 100 iterations as per design doc requirements
    );
  });

  /**
   * Property 15: 置顶状态设置正确性 (Always-On-Top State Setting Correctness)
   * Feature: pomodoro-timer, Property 15: 对于任何置顶状态值（true或false），设置后查询窗口的alwaysOnTop属性应该返回相同的值
   * 
   * **Validates: Requirements 6.1, 6.2**
   * 
   * This property verifies that for ANY always-on-top state value (true or false),
   * after setting the state on the window, querying the window's alwaysOnTop property
   * should return the same value. This ensures the always-on-top functionality works correctly.
   */
  it('Property 15: Always-on-top state setting correctness', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary boolean values for always-on-top state
        fc.boolean(),
        async (alwaysOnTopState) => {
          // Create a fresh database for this iteration
          const iterationTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pomodoro-wm-pbt-iter-'));
          const iterationDbPath = path.join(iterationTempDir, 'test.db');
          const iterationDataService = new DataService(iterationDbPath);
          await iterationDataService.initialize();

          try {
            // Create WindowManager instance
            const windowManager = new WindowManager(iterationDataService);

            // Create the window first
            await windowManager.createMainWindow();

            // Set the always-on-top state
            await windowManager.setAlwaysOnTop(alwaysOnTopState);

            // Query the always-on-top state
            const actualState = windowManager.isAlwaysOnTop();

            // Verify the state matches what we set
            expect(actualState).toBe(alwaysOnTopState);

            // Also verify that the setting was persisted
            const settings = await iterationDataService.loadSettings();
            expect(settings.alwaysOnTop).toBe(alwaysOnTopState);
          } finally {
            // Clean up
            iterationDataService.close();
            try {
              const files = fs.readdirSync(iterationTempDir);
              files.forEach(file => {
                try {
                  fs.unlinkSync(path.join(iterationTempDir, file));
                } catch (e) {
                  // Ignore errors on cleanup
                }
              });
              fs.rmdirSync(iterationTempDir);
            } catch (e) {
              // Ignore cleanup errors
            }
          }
        }
      ),
      { numRuns: 100 } // Run 100 iterations as per design doc requirements
    );
  });
});
