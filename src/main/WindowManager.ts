/**
 * WindowManager - Manages the main application window
 * 
 * This service manages:
 * - Creating and configuring the main browser window
 * - Window state (always-on-top, opacity, position)
 * - Saving and restoring window settings
 * 
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4
 */

import { BrowserWindow, app } from 'electron';
import { DataService } from './DataService';
import { getLogger } from './Logger';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class WindowManager {
  private window: BrowserWindow | null = null;
  private dataService: DataService;
  private _logger: ReturnType<typeof getLogger> | null = null;

  constructor(dataService: DataService) {
    this.dataService = dataService;
  }

  private get logger() {
    if (!this._logger) {
      this._logger = getLogger();
    }
    return this._logger;
  }

  /**
   * Create the main application window
   * Validates: Requirements 6.1, 6.3
   */
  async createMainWindow(): Promise<BrowserWindow> {
    try {
      this.logger.info('Creating main window');

      // Load settings to restore window position
      const settings = await this.dataService.loadSettings();

      // Create the browser window
      this.window = new BrowserWindow({
        width: 320,
        height: 480,
        minWidth: 280,
        minHeight: 400,
        x: settings.windowPosition.x >= 0 ? settings.windowPosition.x : undefined,
        y: settings.windowPosition.y >= 0 ? settings.windowPosition.y : undefined,
        frame: true,
        resizable: true,
        alwaysOnTop: settings.alwaysOnTop,
        opacity: settings.opacity,
        webPreferences: {
          preload: path.join(app.getAppPath(), 'dist-electron', 'preload.cjs'),
          contextIsolation: true,
          nodeIntegration: false,
        },
      });

      // Load the app
      if (process.env.VITE_DEV_SERVER_URL) {
        this.logger.info('Loading from dev server');
        await this.window.loadURL(process.env.VITE_DEV_SERVER_URL);
      } else {
        // In production, use app.getAppPath() to get the correct path
        const appPath = app.getAppPath();
        const indexPath = path.join(appPath, 'dist', 'index.html');
        this.logger.info(`App path: ${appPath}`);
        this.logger.info(`Loading index.html from: ${indexPath}`);
        
        try {
          await this.window.loadFile(indexPath);
          this.logger.info('Index.html loaded successfully');
        } catch (error) {
          this.logger.error('Failed to load index.html', error as Error);
          throw error;
        }
      }

      // Open DevTools in production for debugging
      if (!process.env.VITE_DEV_SERVER_URL) {
        this.window.webContents.openDevTools();
      }

      // Handle window events
      this.window.on('closed', () => {
        this.window = null;
      });

      // Save window position when moved
      this.window.on('moved', async () => {
        if (this.window && !this.window.isDestroyed()) {
          const [x, y] = this.window.getPosition();
          try {
            await this.saveWindowPosition(x, y);
          } catch (error) {
            this.logger.error('Failed to save window position on move', error as Error);
          }
        }
      });

      this.logger.info('Main window created successfully');
      return this.window;
    } catch (error) {
      this.logger.error('Failed to create main window', error as Error);
      throw error;
    }
  }

  /**
   * Set window always-on-top state
   * Validates: Requirements 6.2, 6.4
   */
  async setAlwaysOnTop(enabled: boolean): Promise<void> {
    if (!this.window) {
      throw new Error('Window not created');
    }

    try {
      this.logger.info(`Setting always-on-top: ${enabled}`);
      this.window.setAlwaysOnTop(enabled);

      // Save to settings
      const settings = await this.dataService.loadSettings();
      settings.alwaysOnTop = enabled;
      await this.dataService.saveSettings(settings);

      this.logger.info('Always-on-top setting saved');
    } catch (error) {
      this.logger.error('Failed to set always-on-top', error as Error);
      throw error;
    }
  }

  /**
   * Set window opacity
   * Validates: Requirements 6.2, 6.4
   */
  async setOpacity(opacity: number): Promise<void> {
    if (!this.window) {
      throw new Error('Window not created');
    }

    // Validate opacity range
    if (opacity < 0.3 || opacity > 1.0) {
      throw new Error('Opacity must be between 0.3 and 1.0');
    }

    try {
      this.logger.info(`Setting opacity: ${opacity}`);
      this.window.setOpacity(opacity);

      // Save to settings
      const settings = await this.dataService.loadSettings();
      settings.opacity = opacity;
      await this.dataService.saveSettings(settings);

      this.logger.info('Opacity setting saved');
    } catch (error) {
      this.logger.error('Failed to set opacity', error as Error);
      throw error;
    }
  }

  /**
   * Save window position
   * Validates: Requirements 6.3, 6.4
   */
  async saveWindowPosition(x: number, y: number): Promise<void> {
    try {
      this.logger.info(`Saving window position: (${x}, ${y})`);
      const settings = await this.dataService.loadSettings();
      settings.windowPosition = { x, y };
      await this.dataService.saveSettings(settings);
      this.logger.info('Window position saved');
    } catch (error) {
      this.logger.error('Failed to save window position', error as Error);
      throw error;
    }
  }

  /**
   * Restore window position from settings
   * Validates: Requirements 6.3
   */
  async restoreWindowPosition(): Promise<{ x: number; y: number }> {
    try {
      this.logger.info('Restoring window position');
      const settings = await this.dataService.loadSettings();
      return settings.windowPosition;
    } catch (error) {
      this.logger.error('Failed to restore window position', error as Error);
      throw error;
    }
  }

  /**
   * Get current always-on-top state
   */
  isAlwaysOnTop(): boolean {
    if (!this.window) {
      throw new Error('Window not created');
    }
    return this.window.isAlwaysOnTop();
  }

  /**
   * Get current opacity
   */
  getOpacity(): number {
    if (!this.window) {
      throw new Error('Window not created');
    }
    return this.window.getOpacity();
  }

  /**
   * Get the window instance
   */
  getWindow(): BrowserWindow | null {
    return this.window;
  }
}
