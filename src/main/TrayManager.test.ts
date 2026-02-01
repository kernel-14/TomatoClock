/**
 * Unit Tests for TrayManager
 * 
 * These tests verify specific examples, edge cases, and error conditions
 * for the TrayManager class.
 * 
 * Validates: Requirement 8.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TrayManager } from './TrayManager';

// Mock Electron modules
const mockTrayInstance = {
  setToolTip: vi.fn(),
  setContextMenu: vi.fn(),
  on: vi.fn(),
  destroy: vi.fn(),
};

const mockMenuInstance = {};

vi.mock('electron', () => ({
  Tray: vi.fn(() => mockTrayInstance),
  Menu: {
    buildFromTemplate: vi.fn(() => mockMenuInstance),
  },
  app: {
    quit: vi.fn(),
  },
  nativeImage: {
    createFromPath: vi.fn(() => ({})),
  },
  BrowserWindow: vi.fn(),
}));

describe('TrayManager - Unit Tests', () => {
  let trayManager: TrayManager;
  let mockBrowserWindow: any;
  let electron: any;

  beforeEach(async () => {
    // Import electron to get mocked modules
    electron = await import('electron');
    
    // Create mock browser window
    mockBrowserWindow = {
      isVisible: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      focus: vi.fn(),
    };
    
    // Reset all mocks
    vi.clearAllMocks();
    
    // Create a new TrayManager instance
    trayManager = new TrayManager();
  });

  describe('createTray', () => {
    it('should create a tray icon with tooltip', () => {
      const tray = trayManager.createTray(mockBrowserWindow);

      expect(tray).toBeDefined();
      expect(mockTrayInstance.setToolTip).toHaveBeenCalledWith('番茄钟计时器');
    });

    it('should set up context menu on creation', () => {
      trayManager.createTray(mockBrowserWindow);

      expect(electron.Menu.buildFromTemplate).toHaveBeenCalled();
      expect(mockTrayInstance.setContextMenu).toHaveBeenCalled();
    });

    it('should register click event handler', () => {
      trayManager.createTray(mockBrowserWindow);

      expect(mockTrayInstance.on).toHaveBeenCalledWith('click', expect.any(Function));
    });

    it('should create icon from path', () => {
      trayManager.createTray(mockBrowserWindow);

      expect(electron.nativeImage.createFromPath).toHaveBeenCalled();
    });
  });

  describe('context menu', () => {
    it('should show "隐藏窗口" when window is visible', () => {
      mockBrowserWindow.isVisible.mockReturnValue(true);
      
      trayManager.createTray(mockBrowserWindow);

      // Get the menu template that was passed to buildFromTemplate
      const menuTemplate = vi.mocked(electron.Menu.buildFromTemplate).mock.calls[0][0];
      
      expect(menuTemplate[0].label).toBe('隐藏窗口');
    });

    it('should show "显示窗口" when window is hidden', () => {
      mockBrowserWindow.isVisible.mockReturnValue(false);
      
      trayManager.createTray(mockBrowserWindow);

      // Get the menu template that was passed to buildFromTemplate
      const menuTemplate = vi.mocked(electron.Menu.buildFromTemplate).mock.calls[0][0];
      
      expect(menuTemplate[0].label).toBe('显示窗口');
    });

    it('should include separator in menu', () => {
      mockBrowserWindow.isVisible.mockReturnValue(true);
      
      trayManager.createTray(mockBrowserWindow);

      const menuTemplate = vi.mocked(electron.Menu.buildFromTemplate).mock.calls[0][0];
      
      expect(menuTemplate[1].type).toBe('separator');
    });

    it('should include quit option in menu', () => {
      mockBrowserWindow.isVisible.mockReturnValue(true);
      
      trayManager.createTray(mockBrowserWindow);

      const menuTemplate = vi.mocked(electron.Menu.buildFromTemplate).mock.calls[0][0];
      
      expect(menuTemplate[2].label).toBe('退出');
    });

    it('should toggle window visibility when menu item clicked', () => {
      mockBrowserWindow.isVisible.mockReturnValue(true);
      
      trayManager.createTray(mockBrowserWindow);

      const menuTemplate = vi.mocked(electron.Menu.buildFromTemplate).mock.calls[0][0];
      
      // Click the show/hide menu item
      menuTemplate[0].click();

      expect(mockBrowserWindow.hide).toHaveBeenCalled();
    });

    it('should quit application when quit menu item clicked', () => {
      mockBrowserWindow.isVisible.mockReturnValue(true);
      
      trayManager.createTray(mockBrowserWindow);

      const menuTemplate = vi.mocked(electron.Menu.buildFromTemplate).mock.calls[0][0];
      
      // Click the quit menu item
      menuTemplate[2].click();

      expect(electron.app.quit).toHaveBeenCalled();
    });
  });

  describe('tray icon click', () => {
    it('should hide window when visible and tray clicked', () => {
      mockBrowserWindow.isVisible.mockReturnValue(true);
      
      trayManager.createTray(mockBrowserWindow);

      // Get the click handler
      const clickHandler = vi.mocked(mockTrayInstance.on).mock.calls.find(call => call[0] === 'click')[1];
      
      // Simulate tray click
      clickHandler();

      expect(mockBrowserWindow.hide).toHaveBeenCalled();
    });

    it('should show and focus window when hidden and tray clicked', () => {
      mockBrowserWindow.isVisible.mockReturnValue(false);
      
      trayManager.createTray(mockBrowserWindow);

      // Get the click handler
      const clickHandler = vi.mocked(mockTrayInstance.on).mock.calls.find(call => call[0] === 'click')[1];
      
      // Simulate tray click
      clickHandler();

      expect(mockBrowserWindow.show).toHaveBeenCalled();
      expect(mockBrowserWindow.focus).toHaveBeenCalled();
    });

    it('should update context menu after toggling visibility', () => {
      mockBrowserWindow.isVisible.mockReturnValue(true);
      
      trayManager.createTray(mockBrowserWindow);

      // Get the click handler before clearing mocks
      const clickHandler = vi.mocked(mockTrayInstance.on).mock.calls.find(call => call[0] === 'click')[1];
      
      // Clear previous calls
      vi.clearAllMocks();

      // Simulate tray click
      clickHandler();

      // Context menu should be rebuilt
      expect(electron.Menu.buildFromTemplate).toHaveBeenCalled();
      expect(mockTrayInstance.setContextMenu).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should destroy tray icon', () => {
      trayManager.createTray(mockBrowserWindow);
      
      trayManager.destroy();

      expect(mockTrayInstance.destroy).toHaveBeenCalled();
    });

    it('should set tray to null after destroy', () => {
      trayManager.createTray(mockBrowserWindow);
      
      trayManager.destroy();

      expect(trayManager.getTray()).toBeNull();
    });

    it('should not throw error if tray not created', () => {
      expect(() => trayManager.destroy()).not.toThrow();
    });
  });

  describe('getTray', () => {
    it('should return null before tray is created', () => {
      expect(trayManager.getTray()).toBeNull();
    });

    it('should return tray instance after creation', () => {
      trayManager.createTray(mockBrowserWindow);

      expect(trayManager.getTray()).toBe(mockTrayInstance);
    });
  });

  describe('setWindow', () => {
    it('should update window reference', () => {
      const newWindow = {
        isVisible: vi.fn().mockReturnValue(false),
        show: vi.fn(),
        hide: vi.fn(),
        focus: vi.fn(),
      };
      
      trayManager.createTray(mockBrowserWindow);
      
      // Clear previous calls
      vi.clearAllMocks();
      
      trayManager.setWindow(newWindow);

      // Context menu should be updated with new window state
      expect(electron.Menu.buildFromTemplate).toHaveBeenCalled();
      expect(mockTrayInstance.setContextMenu).toHaveBeenCalled();
    });

    it('should use new window for visibility toggle', () => {
      const newWindow = {
        isVisible: vi.fn().mockReturnValue(false),
        show: vi.fn(),
        hide: vi.fn(),
        focus: vi.fn(),
      };
      
      trayManager.createTray(mockBrowserWindow);
      trayManager.setWindow(newWindow);

      // Get the click handler
      const clickHandler = vi.mocked(mockTrayInstance.on).mock.calls.find(call => call[0] === 'click')[1];
      
      // Simulate tray click
      clickHandler();

      // Should use new window
      expect(newWindow.show).toHaveBeenCalled();
      expect(newWindow.focus).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle multiple tray clicks in succession', () => {
      // Set up the window to toggle visibility states
      let visibleState = true;
      mockBrowserWindow.isVisible.mockImplementation(() => visibleState);
      
      trayManager.createTray(mockBrowserWindow);

      const clickHandler = vi.mocked(mockTrayInstance.on).mock.calls.find(call => call[0] === 'click')[1];
      
      // First click - hide (window is visible)
      visibleState = true;
      clickHandler();
      expect(mockBrowserWindow.hide).toHaveBeenCalledTimes(1);
      visibleState = false;
      
      // Second click - show (window is hidden)
      clickHandler();
      expect(mockBrowserWindow.show).toHaveBeenCalledTimes(1);
      visibleState = true;
      
      // Third click - hide again (window is visible)
      clickHandler();
      expect(mockBrowserWindow.hide).toHaveBeenCalledTimes(2);
    });

    it('should not throw if window is null during toggle', () => {
      trayManager.createTray(mockBrowserWindow);
      
      // Set window to null (simulating window closed)
      trayManager.setWindow(null as any);

      const clickHandler = vi.mocked(mockTrayInstance.on).mock.calls.find(call => call[0] === 'click')[1];
      
      // Should not throw
      expect(() => clickHandler()).not.toThrow();
    });
  });
});
