/**
 * TrayManager - Manages the system tray icon and menu
 * 
 * This service manages:
 * - Creating and configuring the system tray icon
 * - Tray context menu (show/hide window, quit application)
 * - Tray icon click event handling
 * 
 * Validates: Requirement 8.5
 */

import { Tray, Menu, BrowserWindow, nativeImage, app } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class TrayManager {
  private tray: Tray | null = null;
  private window: BrowserWindow | null = null;

  /**
   * Create the system tray icon
   * @param window - The main window to show/hide
   * @returns The created Tray instance
   */
  createTray(window: BrowserWindow): Tray {
    this.window = window;

    // Create tray icon
    // In production, you would use an actual icon file
    // For now, we'll create a simple placeholder icon
    const iconPath = this.getIconPath();
    const icon = nativeImage.createFromPath(iconPath);
    
    this.tray = new Tray(icon);
    this.tray.setToolTip('番茄钟计时器');

    // Set up context menu
    this.updateContextMenu();

    // Handle tray icon click (left click)
    this.tray.on('click', () => {
      this.handleTrayClick();
    });

    return this.tray;
  }

  /**
   * Update the tray context menu
   */
  private updateContextMenu(): void {
    if (!this.tray || !this.window) {
      return;
    }

    const isVisible = this.window.isVisible();

    const contextMenu = Menu.buildFromTemplate([
      {
        label: isVisible ? '隐藏窗口' : '显示窗口',
        click: () => {
          this.toggleWindowVisibility();
        },
      },
      {
        type: 'separator',
      },
      {
        label: '退出',
        click: () => {
          this.quitApplication();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  /**
   * Handle tray icon click event (left click)
   * Toggles window visibility
   */
  private handleTrayClick(): void {
    this.toggleWindowVisibility();
  }

  /**
   * Toggle window visibility
   */
  private toggleWindowVisibility(): void {
    if (!this.window) {
      return;
    }

    if (this.window.isVisible()) {
      this.window.hide();
    } else {
      this.window.show();
      this.window.focus();
    }

    // Update context menu to reflect new state
    this.updateContextMenu();
  }

  /**
   * Quit the application
   */
  private quitApplication(): void {
    // Quit the app
    app.quit();
  }

  /**
   * Get the path to the tray icon
   * @returns Path to the icon file
   */
  private getIconPath(): string {
    // In production, this would point to an actual icon file
    // For development, we'll use a placeholder path
    // The icon should be in the assets folder
    const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
    return path.join(__dirname, '../../assets', iconName);
  }

  /**
   * Destroy the tray icon
   */
  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }

  /**
   * Get the tray instance
   */
  getTray(): Tray | null {
    return this.tray;
  }

  /**
   * Update the window reference
   * Useful if the window is recreated
   */
  setWindow(window: BrowserWindow): void {
    this.window = window;
    this.updateContextMenu();
  }
}
