/**
 * NotificationService - Handles system notifications and sound alerts
 * 
 * Responsibilities:
 * - Display system notifications using Electron Notification API
 * - Play sound alerts for timer completion
 * - Check and request notification permissions
 */

import { Notification } from 'electron';
import * as path from 'path';

export type SoundType = 'complete' | 'warning';

export class NotificationService {
  private soundEnabled: boolean;

  constructor(soundEnabled: boolean = true) {
    this.soundEnabled = soundEnabled;
  }

  /**
   * Display a system notification
   * @param title - Notification title
   * @param body - Notification body text
   */
  showNotification(title: string, body: string): void {
    // Check if notifications are supported
    if (!Notification.isSupported()) {
      console.warn('Notifications are not supported on this system');
      return;
    }

    // Create and show notification
    const notification = new Notification({
      title,
      body,
      silent: !this.soundEnabled, // Don't play system sound if sound is disabled
    });

    notification.show();
  }

  /**
   * Play a sound alert
   * @param soundType - Type of sound to play ('complete' or 'warning')
   */
  playSound(soundType: SoundType): void {
    if (!this.soundEnabled) {
      return;
    }

    // In a real implementation, this would play an actual sound file
    // For now, we'll use the system beep as a placeholder
    // In production, you would use something like:
    // const soundPath = path.join(__dirname, '../../assets/sounds', `${soundType}.mp3`);
    // And play it using a library like node-sound-player or electron's shell.beep()
    
    // Placeholder: log the sound play action
    console.log(`Playing ${soundType} sound`);
    
    // Note: Electron doesn't have a built-in cross-platform sound player
    // In a production app, you would either:
    // 1. Use the HTML5 Audio API in the renderer process
    // 2. Use a Node.js sound library like 'play-sound' or 'node-wav-player'
    // 3. Use shell commands (platform-specific)
  }

  /**
   * Check if notification permission is granted
   * @returns Promise that resolves to true if permission is granted
   */
  async checkPermission(): Promise<boolean> {
    // On desktop platforms (Windows, macOS, Linux), Electron notifications
    // don't require explicit permission like web notifications do
    // They use the OS notification system directly
    return Notification.isSupported();
  }

  /**
   * Request notification permission
   * @returns Promise that resolves to true if permission is granted
   */
  async requestPermission(): Promise<boolean> {
    // On desktop platforms, there's no permission request needed
    // The OS handles notification permissions at the system level
    // Users can disable notifications for the app in their OS settings
    return Notification.isSupported();
  }

  /**
   * Enable or disable sound alerts
   * @param enabled - Whether sound should be enabled
   */
  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
  }

  /**
   * Get current sound enabled state
   * @returns Whether sound is currently enabled
   */
  isSoundEnabled(): boolean {
    return this.soundEnabled;
  }
}
