/**
 * Integration Tests for Settings Persistence
 * 
 * These tests verify the end-to-end settings persistence workflow:
 * 1. Settings save and load cycle
 * 2. Window position persistence
 * 3. Always-on-top state persistence
 * 4. Opacity persistence
 * 5. Default duration persistence
 * 6. Sound enabled persistence
 * 7. Settings restoration after app restart (simulated)
 * 
 * Validates: Requirements 6.3, 6.4, 5.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock Electron's BrowserWindow BEFORE importing modules that use it
const mockBrowserWindow = {
  loadURL: vi.fn(),
  loadFile: vi.fn(),
  on: vi.fn(),
  setAlwaysOnTop: vi.fn(),
  isAlwaysOnTop: vi.fn().mockReturnValue(true),
  setOpacity: vi.fn(),
  getOpacity: vi.fn().mockReturnValue(0.8),
  getPosition: vi.fn().mockReturnValue([100, 200]),
  setPosition: vi.fn(),
};

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(() => mockBrowserWindow),
  app: {
    getPath: vi.fn(() => '/mock/path'),
  },
}));

// Now import the modules
import { DataService } from './DataService';
import { WindowManager } from './WindowManager';
import { AppSettings } from '../shared/types';

describe('Settings Persistence Integration Tests', () => {
  let dataService: DataService;
  let windowManager: WindowManager;
  let testDbPath: string;
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for test database
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pomodoro-settings-test-'));
    testDbPath = path.join(tempDir, 'test.db');

    // Initialize services
    dataService = new DataService(testDbPath);
    await dataService.initialize();
    
    windowManager = new WindowManager(dataService);

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up
    dataService.close();

    // Clean up temp directory
    try {
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        files.forEach(file => {
          try {
            fs.unlinkSync(path.join(tempDir, file));
          } catch (e) {
            // Ignore cleanup errors
          }
        });
        fs.rmdirSync(tempDir);
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('Complete Settings Save and Load Cycle', () => {
    it('should save and restore all settings correctly', async () => {
      // Validates: Requirements 6.3, 6.4
      
      const originalSettings: AppSettings = {
        alwaysOnTop: false,
        windowPosition: { x: 500, y: 300 },
        defaultDuration: 2400, // 40 minutes
        soundEnabled: false,
        opacity: 0.7,
      };

      // Save settings
      await dataService.saveSettings(originalSettings);

      // Load settings
      const loadedSettings = await dataService.loadSettings();

      // Verify all settings match
      expect(loadedSettings.alwaysOnTop).toBe(originalSettings.alwaysOnTop);
      expect(loadedSettings.windowPosition.x).toBe(originalSettings.windowPosition.x);
      expect(loadedSettings.windowPosition.y).toBe(originalSettings.windowPosition.y);
      expect(loadedSettings.defaultDuration).toBe(originalSettings.defaultDuration);
      expect(loadedSettings.soundEnabled).toBe(originalSettings.soundEnabled);
      expect(loadedSettings.opacity).toBe(originalSettings.opacity);
    });

    it('should handle multiple save and load cycles', async () => {
      // Validates: Requirements 6.3, 6.4
      
      // First cycle
      const settings1: AppSettings = {
        alwaysOnTop: true,
        windowPosition: { x: 100, y: 100 },
        defaultDuration: 1500,
        soundEnabled: true,
        opacity: 0.8,
      };

      await dataService.saveSettings(settings1);
      let loaded = await dataService.loadSettings();
      expect(loaded.alwaysOnTop).toBe(true);
      expect(loaded.windowPosition.x).toBe(100);

      // Second cycle - update settings
      const settings2: AppSettings = {
        alwaysOnTop: false,
        windowPosition: { x: 200, y: 200 },
        defaultDuration: 1800,
        soundEnabled: false,
        opacity: 0.6,
      };

      await dataService.saveSettings(settings2);
      loaded = await dataService.loadSettings();
      expect(loaded.alwaysOnTop).toBe(false);
      expect(loaded.windowPosition.x).toBe(200);

      // Third cycle - update again
      const settings3: AppSettings = {
        alwaysOnTop: true,
        windowPosition: { x: 300, y: 300 },
        defaultDuration: 3600,
        soundEnabled: true,
        opacity: 0.9,
      };

      await dataService.saveSettings(settings3);
      loaded = await dataService.loadSettings();
      expect(loaded.alwaysOnTop).toBe(true);
      expect(loaded.windowPosition.x).toBe(300);
      expect(loaded.defaultDuration).toBe(3600);
    });

    it('should return default settings on first load', async () => {
      // Validates: Requirements 6.3, 6.4
      
      // Load settings without saving any first
      const settings = await dataService.loadSettings();

      // Should return default values
      expect(settings.alwaysOnTop).toBe(true);
      expect(settings.defaultDuration).toBe(1500); // 25 minutes
      expect(settings.soundEnabled).toBe(true);
      expect(settings.opacity).toBe(0.8);
      expect(settings.windowPosition).toBeDefined();
      expect(typeof settings.windowPosition.x).toBe('number');
      expect(typeof settings.windowPosition.y).toBe('number');
    });
  });

  describe('Window Position Persistence', () => {
    it('should persist window position across saves', async () => {
      // Validates: Requirement 5.3
      
      // Save initial position
      await windowManager.saveWindowPosition(150, 250);

      // Load position
      let position = await windowManager.restoreWindowPosition();
      expect(position.x).toBe(150);
      expect(position.y).toBe(250);

      // Update position
      await windowManager.saveWindowPosition(300, 400);

      // Load updated position
      position = await windowManager.restoreWindowPosition();
      expect(position.x).toBe(300);
      expect(position.y).toBe(400);
    });

    it('should persist negative window coordinates', async () => {
      // Validates: Requirement 5.3
      
      // Save negative coordinates (multi-monitor setup)
      await windowManager.saveWindowPosition(-100, -50);

      // Load position
      const position = await windowManager.restoreWindowPosition();
      expect(position.x).toBe(-100);
      expect(position.y).toBe(-50);
    });

    it('should persist large window coordinates', async () => {
      // Validates: Requirement 5.3
      
      // Save large coordinates (high-resolution or multi-monitor)
      await windowManager.saveWindowPosition(3840, 2160);

      // Load position
      const position = await windowManager.restoreWindowPosition();
      expect(position.x).toBe(3840);
      expect(position.y).toBe(2160);
    });

    it('should restore window position when creating window', async () => {
      // Validates: Requirement 5.3
      
      // Save a specific position
      await windowManager.saveWindowPosition(500, 300);

      // Create window - should use saved position
      await windowManager.createMainWindow();

      // Verify BrowserWindow was created with saved position
      const { BrowserWindow } = await import('electron');
      expect(BrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          x: 500,
          y: 300,
        })
      );
    });
  });

  describe('Always-On-Top State Persistence', () => {
    it('should persist always-on-top enabled state', async () => {
      // Validates: Requirements 6.3, 6.4
      
      await windowManager.createMainWindow();

      // Enable always-on-top
      await windowManager.setAlwaysOnTop(true);

      // Load settings and verify
      const settings = await dataService.loadSettings();
      expect(settings.alwaysOnTop).toBe(true);
    });

    it('should persist always-on-top disabled state', async () => {
      // Validates: Requirements 6.3, 6.4
      
      await windowManager.createMainWindow();

      // Disable always-on-top
      await windowManager.setAlwaysOnTop(false);

      // Load settings and verify
      const settings = await dataService.loadSettings();
      expect(settings.alwaysOnTop).toBe(false);
    });

    it('should restore always-on-top state when creating window', async () => {
      // Validates: Requirements 6.3, 6.4
      
      // Save settings with always-on-top disabled
      await dataService.saveSettings({
        alwaysOnTop: false,
        windowPosition: { x: 100, y: 100 },
        defaultDuration: 1500,
        soundEnabled: true,
        opacity: 0.8,
      });

      // Create window - should use saved always-on-top state
      await windowManager.createMainWindow();

      // Verify BrowserWindow was created with correct always-on-top state
      const { BrowserWindow } = await import('electron');
      expect(BrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          alwaysOnTop: false,
        })
      );
    });

    it('should handle multiple always-on-top state changes', async () => {
      // Validates: Requirements 6.3, 6.4
      
      await windowManager.createMainWindow();

      // Toggle always-on-top multiple times
      await windowManager.setAlwaysOnTop(true);
      let settings = await dataService.loadSettings();
      expect(settings.alwaysOnTop).toBe(true);

      await windowManager.setAlwaysOnTop(false);
      settings = await dataService.loadSettings();
      expect(settings.alwaysOnTop).toBe(false);

      await windowManager.setAlwaysOnTop(true);
      settings = await dataService.loadSettings();
      expect(settings.alwaysOnTop).toBe(true);
    });
  });

  describe('Opacity Persistence', () => {
    it('should persist opacity value', async () => {
      // Validates: Requirements 6.3, 6.4
      
      await windowManager.createMainWindow();

      // Set opacity
      await windowManager.setOpacity(0.6);

      // Load settings and verify
      const settings = await dataService.loadSettings();
      expect(settings.opacity).toBe(0.6);
    });

    it('should persist minimum valid opacity', async () => {
      // Validates: Requirements 6.3, 6.4
      
      await windowManager.createMainWindow();

      // Set minimum opacity (0.3)
      await windowManager.setOpacity(0.3);

      // Load settings and verify
      const settings = await dataService.loadSettings();
      expect(settings.opacity).toBe(0.3);
    });

    it('should persist maximum valid opacity', async () => {
      // Validates: Requirements 6.3, 6.4
      
      await windowManager.createMainWindow();

      // Set maximum opacity (1.0)
      await windowManager.setOpacity(1.0);

      // Load settings and verify
      const settings = await dataService.loadSettings();
      expect(settings.opacity).toBe(1.0);
    });

    it('should handle multiple opacity changes', async () => {
      // Validates: Requirements 6.3, 6.4
      
      await windowManager.createMainWindow();

      // Change opacity multiple times
      await windowManager.setOpacity(0.5);
      let settings = await dataService.loadSettings();
      expect(settings.opacity).toBe(0.5);

      await windowManager.setOpacity(0.7);
      settings = await dataService.loadSettings();
      expect(settings.opacity).toBe(0.7);

      await windowManager.setOpacity(0.9);
      settings = await dataService.loadSettings();
      expect(settings.opacity).toBe(0.9);
    });
  });

  describe('Default Duration Persistence', () => {
    it('should persist default duration', async () => {
      // Validates: Requirements 6.3, 6.4
      
      const settings: AppSettings = {
        alwaysOnTop: true,
        windowPosition: { x: 100, y: 100 },
        defaultDuration: 2400, // 40 minutes
        soundEnabled: true,
        opacity: 0.8,
      };

      await dataService.saveSettings(settings);

      const loaded = await dataService.loadSettings();
      expect(loaded.defaultDuration).toBe(2400);
    });

    it('should persist short duration', async () => {
      // Validates: Requirements 6.3, 6.4
      
      const settings: AppSettings = {
        alwaysOnTop: true,
        windowPosition: { x: 100, y: 100 },
        defaultDuration: 900, // 15 minutes
        soundEnabled: true,
        opacity: 0.8,
      };

      await dataService.saveSettings(settings);

      const loaded = await dataService.loadSettings();
      expect(loaded.defaultDuration).toBe(900);
    });

    it('should persist long duration', async () => {
      // Validates: Requirements 6.3, 6.4
      
      const settings: AppSettings = {
        alwaysOnTop: true,
        windowPosition: { x: 100, y: 100 },
        defaultDuration: 3600, // 60 minutes
        soundEnabled: true,
        opacity: 0.8,
      };

      await dataService.saveSettings(settings);

      const loaded = await dataService.loadSettings();
      expect(loaded.defaultDuration).toBe(3600);
    });

    it('should handle multiple duration changes', async () => {
      // Validates: Requirements 6.3, 6.4
      
      // First duration
      await dataService.saveSettings({
        alwaysOnTop: true,
        windowPosition: { x: 100, y: 100 },
        defaultDuration: 1500,
        soundEnabled: true,
        opacity: 0.8,
      });

      let loaded = await dataService.loadSettings();
      expect(loaded.defaultDuration).toBe(1500);

      // Second duration
      await dataService.saveSettings({
        alwaysOnTop: true,
        windowPosition: { x: 100, y: 100 },
        defaultDuration: 2400,
        soundEnabled: true,
        opacity: 0.8,
      });

      loaded = await dataService.loadSettings();
      expect(loaded.defaultDuration).toBe(2400);

      // Third duration
      await dataService.saveSettings({
        alwaysOnTop: true,
        windowPosition: { x: 100, y: 100 },
        defaultDuration: 1800,
        soundEnabled: true,
        opacity: 0.8,
      });

      loaded = await dataService.loadSettings();
      expect(loaded.defaultDuration).toBe(1800);
    });
  });

  describe('Sound Enabled Persistence', () => {
    it('should persist sound enabled state', async () => {
      // Validates: Requirements 6.3, 6.4
      
      const settings: AppSettings = {
        alwaysOnTop: true,
        windowPosition: { x: 100, y: 100 },
        defaultDuration: 1500,
        soundEnabled: true,
        opacity: 0.8,
      };

      await dataService.saveSettings(settings);

      const loaded = await dataService.loadSettings();
      expect(loaded.soundEnabled).toBe(true);
    });

    it('should persist sound disabled state', async () => {
      // Validates: Requirements 6.3, 6.4
      
      const settings: AppSettings = {
        alwaysOnTop: true,
        windowPosition: { x: 100, y: 100 },
        defaultDuration: 1500,
        soundEnabled: false,
        opacity: 0.8,
      };

      await dataService.saveSettings(settings);

      const loaded = await dataService.loadSettings();
      expect(loaded.soundEnabled).toBe(false);
    });

    it('should handle multiple sound state changes', async () => {
      // Validates: Requirements 6.3, 6.4
      
      // Enable sound
      await dataService.saveSettings({
        alwaysOnTop: true,
        windowPosition: { x: 100, y: 100 },
        defaultDuration: 1500,
        soundEnabled: true,
        opacity: 0.8,
      });

      let loaded = await dataService.loadSettings();
      expect(loaded.soundEnabled).toBe(true);

      // Disable sound
      await dataService.saveSettings({
        alwaysOnTop: true,
        windowPosition: { x: 100, y: 100 },
        defaultDuration: 1500,
        soundEnabled: false,
        opacity: 0.8,
      });

      loaded = await dataService.loadSettings();
      expect(loaded.soundEnabled).toBe(false);

      // Enable sound again
      await dataService.saveSettings({
        alwaysOnTop: true,
        windowPosition: { x: 100, y: 100 },
        defaultDuration: 1500,
        soundEnabled: true,
        opacity: 0.8,
      });

      loaded = await dataService.loadSettings();
      expect(loaded.soundEnabled).toBe(true);
    });
  });

  describe('Settings Restoration After App Restart (Simulated)', () => {
    it('should restore all settings after simulated restart', async () => {
      // Validates: Requirements 6.3, 6.4, 5.3
      
      // Simulate first app session - save settings
      const originalSettings: AppSettings = {
        alwaysOnTop: false,
        windowPosition: { x: 750, y: 450 },
        defaultDuration: 2700, // 45 minutes
        soundEnabled: false,
        opacity: 0.65,
      };

      await dataService.saveSettings(originalSettings);

      // Simulate app restart by closing and reopening database
      dataService.close();

      // Create new service instance (simulates app restart)
      const newDataService = new DataService(testDbPath);
      await newDataService.initialize();

      // Load settings in "new" session
      const restoredSettings = await newDataService.loadSettings();

      // Verify all settings were restored correctly
      expect(restoredSettings.alwaysOnTop).toBe(originalSettings.alwaysOnTop);
      expect(restoredSettings.windowPosition.x).toBe(originalSettings.windowPosition.x);
      expect(restoredSettings.windowPosition.y).toBe(originalSettings.windowPosition.y);
      expect(restoredSettings.defaultDuration).toBe(originalSettings.defaultDuration);
      expect(restoredSettings.soundEnabled).toBe(originalSettings.soundEnabled);
      expect(restoredSettings.opacity).toBe(originalSettings.opacity);

      // Clean up
      newDataService.close();
    });

    it('should restore window state after simulated restart', async () => {
      // Validates: Requirements 6.3, 6.4, 5.3
      
      // First session - create window and configure it
      await windowManager.createMainWindow();
      await windowManager.setAlwaysOnTop(false);
      await windowManager.setOpacity(0.5);
      await windowManager.saveWindowPosition(600, 400);

      // Close first session
      dataService.close();

      // Simulate restart - create new services
      const newDataService = new DataService(testDbPath);
      await newDataService.initialize();
      const newWindowManager = new WindowManager(newDataService);

      // Create window in new session - should restore settings
      await newWindowManager.createMainWindow();

      // Verify window was created with restored settings
      const { BrowserWindow } = await import('electron');
      const lastCall = vi.mocked(BrowserWindow).mock.calls[vi.mocked(BrowserWindow).mock.calls.length - 1];
      
      expect(lastCall[0]).toMatchObject({
        alwaysOnTop: false,
        x: 600,
        y: 400,
      });

      // Clean up
      newDataService.close();
    });

    it('should handle multiple restart cycles', async () => {
      // Validates: Requirements 6.3, 6.4, 5.3
      
      // First session
      await dataService.saveSettings({
        alwaysOnTop: true,
        windowPosition: { x: 100, y: 100 },
        defaultDuration: 1500,
        soundEnabled: true,
        opacity: 0.8,
      });
      dataService.close();

      // Second session - load and modify
      let service = new DataService(testDbPath);
      await service.initialize();
      let settings = await service.loadSettings();
      expect(settings.alwaysOnTop).toBe(true);
      
      await service.saveSettings({
        ...settings,
        alwaysOnTop: false,
        defaultDuration: 2400,
      });
      service.close();

      // Third session - load and verify
      service = new DataService(testDbPath);
      await service.initialize();
      settings = await service.loadSettings();
      expect(settings.alwaysOnTop).toBe(false);
      expect(settings.defaultDuration).toBe(2400);
      
      await service.saveSettings({
        ...settings,
        opacity: 0.6,
        soundEnabled: false,
      });
      service.close();

      // Fourth session - final verification
      service = new DataService(testDbPath);
      await service.initialize();
      settings = await service.loadSettings();
      expect(settings.alwaysOnTop).toBe(false);
      expect(settings.defaultDuration).toBe(2400);
      expect(settings.opacity).toBe(0.6);
      expect(settings.soundEnabled).toBe(false);
      
      service.close();
    });

    it('should maintain settings integrity across restart with concurrent changes', async () => {
      // Validates: Requirements 6.3, 6.4, 5.3
      
      // First session - save initial settings
      await dataService.saveSettings({
        alwaysOnTop: true,
        windowPosition: { x: 200, y: 200 },
        defaultDuration: 1500,
        soundEnabled: true,
        opacity: 0.8,
      });

      // Update window position
      await windowManager.saveWindowPosition(300, 300);

      // Verify settings were updated correctly
      let settings = await dataService.loadSettings();
      expect(settings.windowPosition.x).toBe(300);
      expect(settings.windowPosition.y).toBe(300);
      expect(settings.alwaysOnTop).toBe(true); // Other settings unchanged

      // Simulate restart
      dataService.close();

      // Second session - verify all settings persisted
      const newService = new DataService(testDbPath);
      await newService.initialize();
      settings = await newService.loadSettings();
      
      expect(settings.windowPosition.x).toBe(300);
      expect(settings.windowPosition.y).toBe(300);
      expect(settings.alwaysOnTop).toBe(true);
      expect(settings.defaultDuration).toBe(1500);
      expect(settings.soundEnabled).toBe(true);
      expect(settings.opacity).toBe(0.8);

      newService.close();
    });
  });

  describe('Settings Persistence Error Handling', () => {
    it('should handle database errors during settings save', async () => {
      // Validates: Requirements 6.3, 6.4
      
      const settings: AppSettings = {
        alwaysOnTop: true,
        windowPosition: { x: 100, y: 100 },
        defaultDuration: 1500,
        soundEnabled: true,
        opacity: 0.8,
      };

      // Close database to cause error
      dataService.close();

      // Attempt to save should fail
      await expect(dataService.saveSettings(settings)).rejects.toThrow('Database not initialized');

      // Re-initialize and verify we can save after recovery
      await dataService.initialize();
      await expect(dataService.saveSettings(settings)).resolves.not.toThrow();
    });

    it('should handle database errors during settings load', async () => {
      // Validates: Requirements 6.3, 6.4
      
      // Close database to cause error
      dataService.close();

      // Attempt to load should fail
      await expect(dataService.loadSettings()).rejects.toThrow('Database not initialized');

      // Re-initialize and verify we can load after recovery
      await dataService.initialize();
      await expect(dataService.loadSettings()).resolves.not.toThrow();
    });

    it('should handle window position save errors gracefully', async () => {
      // Validates: Requirement 5.3
      
      // Close database to cause error
      dataService.close();

      // Attempt to save position should fail
      await expect(windowManager.saveWindowPosition(100, 200)).rejects.toThrow('Database not initialized');

      // Re-initialize and verify we can save after recovery
      await dataService.initialize();
      await expect(windowManager.saveWindowPosition(100, 200)).resolves.not.toThrow();
    });

    it('should maintain data integrity when save fails', async () => {
      // Validates: Requirements 6.3, 6.4
      
      // Save initial settings
      const initialSettings: AppSettings = {
        alwaysOnTop: true,
        windowPosition: { x: 100, y: 100 },
        defaultDuration: 1500,
        soundEnabled: true,
        opacity: 0.8,
      };

      await dataService.saveSettings(initialSettings);

      // Close database
      dataService.close();

      // Try to save new settings - should fail
      const newSettings: AppSettings = {
        alwaysOnTop: false,
        windowPosition: { x: 200, y: 200 },
        defaultDuration: 2400,
        soundEnabled: false,
        opacity: 0.6,
      };

      await expect(dataService.saveSettings(newSettings)).rejects.toThrow();

      // Re-initialize and verify original settings are intact
      await dataService.initialize();
      const loaded = await dataService.loadSettings();
      
      expect(loaded.alwaysOnTop).toBe(initialSettings.alwaysOnTop);
      expect(loaded.windowPosition.x).toBe(initialSettings.windowPosition.x);
      expect(loaded.defaultDuration).toBe(initialSettings.defaultDuration);
    });
  });

  describe('Settings Persistence with Edge Cases', () => {
    it('should handle zero coordinates', async () => {
      // Validates: Requirement 5.3
      
      await windowManager.saveWindowPosition(0, 0);
      const position = await windowManager.restoreWindowPosition();
      
      expect(position.x).toBe(0);
      expect(position.y).toBe(0);
    });

    it('should handle extreme opacity values at boundaries', async () => {
      // Validates: Requirements 6.3, 6.4
      
      await windowManager.createMainWindow();

      // Test minimum boundary
      await windowManager.setOpacity(0.3);
      let settings = await dataService.loadSettings();
      expect(settings.opacity).toBe(0.3);

      // Test maximum boundary
      await windowManager.setOpacity(1.0);
      settings = await dataService.loadSettings();
      expect(settings.opacity).toBe(1.0);
    });

    it('should handle rapid setting changes', async () => {
      // Validates: Requirements 6.3, 6.4
      
      await windowManager.createMainWindow();

      // Rapidly change settings
      for (let i = 0; i < 10; i++) {
        await windowManager.setAlwaysOnTop(i % 2 === 0);
        await windowManager.setOpacity(0.3 + (i * 0.07));
      }

      // Verify final state is correct
      const settings = await dataService.loadSettings();
      expect(settings.alwaysOnTop).toBe(false); // Last value (9 % 2 === 1, so false)
      expect(settings.opacity).toBeCloseTo(0.93, 2); // 0.3 + (9 * 0.07)
    });

    it('should handle settings with all default values', async () => {
      // Validates: Requirements 6.3, 6.4
      
      // Load settings without saving any (should get defaults)
      const settings = await dataService.loadSettings();

      // Save the default settings explicitly
      await dataService.saveSettings(settings);

      // Load again and verify they match
      const reloaded = await dataService.loadSettings();
      
      expect(reloaded.alwaysOnTop).toBe(settings.alwaysOnTop);
      expect(reloaded.windowPosition.x).toBe(settings.windowPosition.x);
      expect(reloaded.windowPosition.y).toBe(settings.windowPosition.y);
      expect(reloaded.defaultDuration).toBe(settings.defaultDuration);
      expect(reloaded.soundEnabled).toBe(settings.soundEnabled);
      expect(reloaded.opacity).toBe(settings.opacity);
    });

    it('should handle partial settings updates', async () => {
      // Validates: Requirements 6.3, 6.4
      
      // Save initial settings
      await dataService.saveSettings({
        alwaysOnTop: true,
        windowPosition: { x: 100, y: 100 },
        defaultDuration: 1500,
        soundEnabled: true,
        opacity: 0.8,
      });

      // Update only window position
      await windowManager.saveWindowPosition(200, 200);

      // Verify other settings remain unchanged
      const settings = await dataService.loadSettings();
      expect(settings.windowPosition.x).toBe(200);
      expect(settings.windowPosition.y).toBe(200);
      expect(settings.alwaysOnTop).toBe(true);
      expect(settings.defaultDuration).toBe(1500);
      expect(settings.soundEnabled).toBe(true);
      expect(settings.opacity).toBe(0.8);
    });
  });
});
