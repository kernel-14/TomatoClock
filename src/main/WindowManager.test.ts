/**
 * Unit Tests for WindowManager
 * 
 * These tests verify specific examples, edge cases, and error conditions
 * for the WindowManager class.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WindowManager } from './WindowManager';
import { DataService } from './DataService';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock Electron's BrowserWindow
const mockBrowserWindow = {
  loadURL: vi.fn(),
  loadFile: vi.fn(),
  on: vi.fn(),
  setAlwaysOnTop: vi.fn(),
  isAlwaysOnTop: vi.fn(),
  setOpacity: vi.fn(),
  getOpacity: vi.fn(),
  getPosition: vi.fn(),
  setPosition: vi.fn(),
};

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(() => mockBrowserWindow),
}));

describe('WindowManager - Unit Tests', () => {
  let testDbPath: string;
  let tempDir: string;
  let dataService: DataService;
  let windowManager: WindowManager;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pomodoro-wm-'));
    testDbPath = path.join(tempDir, 'test.db');

    // Initialize DataService
    dataService = new DataService(testDbPath);
    await dataService.initialize();

    // Create WindowManager
    windowManager = new WindowManager(dataService);

    // Reset mocks
    vi.clearAllMocks();
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

  describe('createMainWindow', () => {
    it('should create a window with correct configuration', async () => {
      const window = await windowManager.createMainWindow();

      expect(window).toBeDefined();
      // Check that the window has the expected methods
      expect(window.loadURL).toBeDefined();
      expect(window.on).toBeDefined();
    });

    it('should restore saved window position', async () => {
      // Save a specific position
      await dataService.saveSettings({
        alwaysOnTop: true,
        windowPosition: { x: 500, y: 300 },
        defaultDuration: 1500,
        soundEnabled: true,
        opacity: 0.8,
      });

      // Create window - it should use the saved position
      await windowManager.createMainWindow();

      // The BrowserWindow constructor should have been called with the saved position
      const { BrowserWindow } = await import('electron');
      expect(BrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          x: 500,
          y: 300,
        })
      );
    });
  });

  describe('setAlwaysOnTop', () => {
    it('should throw error if window not created', async () => {
      await expect(windowManager.setAlwaysOnTop(true)).rejects.toThrow('Window not created');
    });

    it('should set always-on-top state and save to settings', async () => {
      await windowManager.createMainWindow();
      
      await windowManager.setAlwaysOnTop(true);

      expect(mockBrowserWindow.setAlwaysOnTop).toHaveBeenCalledWith(true);

      // Verify settings were saved
      const settings = await dataService.loadSettings();
      expect(settings.alwaysOnTop).toBe(true);
    });

    it('should disable always-on-top when set to false', async () => {
      await windowManager.createMainWindow();
      
      await windowManager.setAlwaysOnTop(false);

      expect(mockBrowserWindow.setAlwaysOnTop).toHaveBeenCalledWith(false);

      // Verify settings were saved
      const settings = await dataService.loadSettings();
      expect(settings.alwaysOnTop).toBe(false);
    });
  });

  describe('setOpacity', () => {
    it('should throw error if window not created', async () => {
      await expect(windowManager.setOpacity(0.8)).rejects.toThrow('Window not created');
    });

    it('should set opacity and save to settings', async () => {
      await windowManager.createMainWindow();
      
      await windowManager.setOpacity(0.7);

      expect(mockBrowserWindow.setOpacity).toHaveBeenCalledWith(0.7);

      // Verify settings were saved
      const settings = await dataService.loadSettings();
      expect(settings.opacity).toBe(0.7);
    });

    it('should throw error for opacity below 0.3', async () => {
      await windowManager.createMainWindow();
      
      await expect(windowManager.setOpacity(0.2)).rejects.toThrow('Opacity must be between 0.3 and 1.0');
    });

    it('should throw error for opacity above 1.0', async () => {
      await windowManager.createMainWindow();
      
      await expect(windowManager.setOpacity(1.5)).rejects.toThrow('Opacity must be between 0.3 and 1.0');
    });

    it('should accept minimum valid opacity (0.3)', async () => {
      await windowManager.createMainWindow();
      
      await windowManager.setOpacity(0.3);

      expect(mockBrowserWindow.setOpacity).toHaveBeenCalledWith(0.3);
    });

    it('should accept maximum valid opacity (1.0)', async () => {
      await windowManager.createMainWindow();
      
      await windowManager.setOpacity(1.0);

      expect(mockBrowserWindow.setOpacity).toHaveBeenCalledWith(1.0);
    });
  });

  describe('saveWindowPosition and restoreWindowPosition', () => {
    it('should save and restore window position', async () => {
      await windowManager.saveWindowPosition(100, 200);

      const restored = await windowManager.restoreWindowPosition();

      expect(restored.x).toBe(100);
      expect(restored.y).toBe(200);
    });

    it('should handle negative coordinates', async () => {
      await windowManager.saveWindowPosition(-50, -100);

      const restored = await windowManager.restoreWindowPosition();

      expect(restored.x).toBe(-50);
      expect(restored.y).toBe(-100);
    });

    it('should handle large coordinates', async () => {
      await windowManager.saveWindowPosition(5000, 3000);

      const restored = await windowManager.restoreWindowPosition();

      expect(restored.x).toBe(5000);
      expect(restored.y).toBe(3000);
    });

    it('should return default position if no position saved', async () => {
      const restored = await windowManager.restoreWindowPosition();

      // Should return default position from settings
      expect(restored).toHaveProperty('x');
      expect(restored).toHaveProperty('y');
      expect(typeof restored.x).toBe('number');
      expect(typeof restored.y).toBe('number');
    });
  });

  describe('isAlwaysOnTop', () => {
    it('should throw error if window not created', () => {
      expect(() => windowManager.isAlwaysOnTop()).toThrow('Window not created');
    });

    it('should return always-on-top state', async () => {
      mockBrowserWindow.isAlwaysOnTop.mockReturnValue(true);
      await windowManager.createMainWindow();

      const result = windowManager.isAlwaysOnTop();

      expect(result).toBe(true);
      expect(mockBrowserWindow.isAlwaysOnTop).toHaveBeenCalled();
    });
  });

  describe('getOpacity', () => {
    it('should throw error if window not created', () => {
      expect(() => windowManager.getOpacity()).toThrow('Window not created');
    });

    it('should return current opacity', async () => {
      mockBrowserWindow.getOpacity.mockReturnValue(0.8);
      await windowManager.createMainWindow();

      const result = windowManager.getOpacity();

      expect(result).toBe(0.8);
      expect(mockBrowserWindow.getOpacity).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    describe('Window Creation Errors', () => {
      it('should handle errors during window creation', async () => {
        // Mock BrowserWindow to throw an error
        const { BrowserWindow } = await import('electron');
        vi.mocked(BrowserWindow).mockImplementationOnce(() => {
          throw new Error('Failed to create window');
        });

        await expect(windowManager.createMainWindow()).rejects.toThrow('Failed to create window');
      });

      it('should handle errors when loading settings during window creation', async () => {
        // Mock loadSettings to throw an error
        vi.spyOn(dataService, 'loadSettings').mockRejectedValueOnce(new Error('Settings load failed'));

        await expect(windowManager.createMainWindow()).rejects.toThrow('Settings load failed');
      });
    });

    describe('setAlwaysOnTop Error Handling', () => {
      it('should throw error when window not created', async () => {
        await expect(windowManager.setAlwaysOnTop(true)).rejects.toThrow('Window not created');
      });

      it('should handle errors when saving settings', async () => {
        await windowManager.createMainWindow();
        
        // Mock saveSettings to throw an error
        vi.spyOn(dataService, 'saveSettings').mockRejectedValueOnce(new Error('Save failed'));

        await expect(windowManager.setAlwaysOnTop(true)).rejects.toThrow('Save failed');
      });

      it('should handle errors from BrowserWindow.setAlwaysOnTop', async () => {
        await windowManager.createMainWindow();
        
        // Mock setAlwaysOnTop to throw an error
        mockBrowserWindow.setAlwaysOnTop.mockImplementationOnce(() => {
          throw new Error('Native error');
        });

        await expect(windowManager.setAlwaysOnTop(true)).rejects.toThrow('Native error');
      });
    });

    describe('setOpacity Error Handling', () => {
      it('should throw error when window not created', async () => {
        await expect(windowManager.setOpacity(0.8)).rejects.toThrow('Window not created');
      });

      it('should validate opacity range - too low', async () => {
        await windowManager.createMainWindow();
        
        await expect(windowManager.setOpacity(0.2)).rejects.toThrow('Opacity must be between 0.3 and 1.0');
      });

      it('should validate opacity range - too high', async () => {
        await windowManager.createMainWindow();
        
        await expect(windowManager.setOpacity(1.5)).rejects.toThrow('Opacity must be between 0.3 and 1.0');
      });

      it('should validate opacity range - exactly at minimum', async () => {
        await windowManager.createMainWindow();
        
        await expect(windowManager.setOpacity(0.3)).resolves.not.toThrow();
      });

      it('should validate opacity range - exactly at maximum', async () => {
        await windowManager.createMainWindow();
        
        await expect(windowManager.setOpacity(1.0)).resolves.not.toThrow();
      });

      it('should handle errors when saving opacity settings', async () => {
        await windowManager.createMainWindow();
        
        // Mock saveSettings to throw an error
        vi.spyOn(dataService, 'saveSettings').mockRejectedValueOnce(new Error('Save failed'));

        await expect(windowManager.setOpacity(0.7)).rejects.toThrow('Save failed');
      });

      it('should handle errors from BrowserWindow.setOpacity', async () => {
        await windowManager.createMainWindow();
        
        // Mock setOpacity to throw an error
        mockBrowserWindow.setOpacity.mockImplementationOnce(() => {
          throw new Error('Native error');
        });

        await expect(windowManager.setOpacity(0.7)).rejects.toThrow('Native error');
      });
    });

    describe('Window Position Error Handling', () => {
      it('should handle errors when saving window position', async () => {
        // Mock saveSettings to throw an error
        vi.spyOn(dataService, 'saveSettings').mockRejectedValueOnce(new Error('Save failed'));

        await expect(windowManager.saveWindowPosition(100, 200)).rejects.toThrow('Save failed');
      });

      it('should handle errors when restoring window position', async () => {
        // Mock loadSettings to throw an error
        vi.spyOn(dataService, 'loadSettings').mockRejectedValueOnce(new Error('Load failed'));

        await expect(windowManager.restoreWindowPosition()).rejects.toThrow('Load failed');
      });

      it('should handle negative coordinates', async () => {
        await expect(windowManager.saveWindowPosition(-100, -200)).resolves.not.toThrow();
        
        const position = await windowManager.restoreWindowPosition();
        expect(position.x).toBe(-100);
        expect(position.y).toBe(-200);
      });

      it('should handle very large coordinates', async () => {
        await expect(windowManager.saveWindowPosition(10000, 10000)).resolves.not.toThrow();
        
        const position = await windowManager.restoreWindowPosition();
        expect(position.x).toBe(10000);
        expect(position.y).toBe(10000);
      });

      it('should handle zero coordinates', async () => {
        await expect(windowManager.saveWindowPosition(0, 0)).resolves.not.toThrow();
        
        const position = await windowManager.restoreWindowPosition();
        expect(position.x).toBe(0);
        expect(position.y).toBe(0);
      });
    });

    describe('Window State Query Error Handling', () => {
      it('should throw error when querying always-on-top without window', () => {
        expect(() => windowManager.isAlwaysOnTop()).toThrow('Window not created');
      });

      it('should throw error when querying opacity without window', () => {
        expect(() => windowManager.getOpacity()).toThrow('Window not created');
      });

      it('should handle errors from BrowserWindow.isAlwaysOnTop', async () => {
        await windowManager.createMainWindow();
        
        mockBrowserWindow.isAlwaysOnTop.mockImplementationOnce(() => {
          throw new Error('Native error');
        });

        expect(() => windowManager.isAlwaysOnTop()).toThrow('Native error');
      });

      it('should handle errors from BrowserWindow.getOpacity', async () => {
        await windowManager.createMainWindow();
        
        mockBrowserWindow.getOpacity.mockImplementationOnce(() => {
          throw new Error('Native error');
        });

        expect(() => windowManager.getOpacity()).toThrow('Native error');
      });
    });

    describe('Window Lifecycle Error Handling', () => {
      it('should handle window closed event', async () => {
        await windowManager.createMainWindow();
        
        // Simulate window closed event
        const closedHandler = mockBrowserWindow.on.mock.calls.find(
          call => call[0] === 'closed'
        )?.[1];
        
        expect(closedHandler).toBeDefined();
        
        // Call the closed handler
        if (closedHandler) {
          closedHandler();
        }
        
        // Window should be null after closed
        expect(windowManager.getWindow()).toBeNull();
      });

      it('should handle errors during window move event', async () => {
        await windowManager.createMainWindow();
        
        // Mock saveSettings to throw an error
        vi.spyOn(dataService, 'saveSettings').mockRejectedValueOnce(new Error('Save failed'));
        
        // Mock getPosition to return valid coordinates
        mockBrowserWindow.getPosition.mockReturnValue([100, 200]);
        
        // Simulate window moved event
        const movedHandler = mockBrowserWindow.on.mock.calls.find(
          call => call[0] === 'moved'
        )?.[1];
        
        expect(movedHandler).toBeDefined();
        
        // Call the moved handler - should not throw even if save fails
        if (movedHandler) {
          await expect(movedHandler()).resolves.not.toThrow();
        }
      });

      it('should handle multiple window creation attempts', async () => {
        const window1 = await windowManager.createMainWindow();
        expect(window1).toBeDefined();
        
        // Create another window - should replace the first one
        const window2 = await windowManager.createMainWindow();
        expect(window2).toBeDefined();
        
        // Both should be the same instance (or the second replaces the first)
        expect(windowManager.getWindow()).toBe(window2);
      });
    });

    describe('Database Connection Error Handling', () => {
      it('should handle database errors when loading settings', async () => {
        // Close the database to simulate connection error
        dataService.close();
        
        await expect(windowManager.createMainWindow()).rejects.toThrow('Database not initialized');
        
        // Re-initialize for cleanup
        await dataService.initialize();
      });

      it('should handle database errors when saving always-on-top', async () => {
        await windowManager.createMainWindow();
        
        // Close the database
        dataService.close();
        
        await expect(windowManager.setAlwaysOnTop(true)).rejects.toThrow('Database not initialized');
        
        // Re-initialize for cleanup
        await dataService.initialize();
      });

      it('should handle database errors when saving opacity', async () => {
        await windowManager.createMainWindow();
        
        // Close the database
        dataService.close();
        
        await expect(windowManager.setOpacity(0.7)).rejects.toThrow('Database not initialized');
        
        // Re-initialize for cleanup
        await dataService.initialize();
      });
    });
  });
});
