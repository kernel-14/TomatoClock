/**
 * Unit tests for NotificationService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotificationService } from './NotificationService';
import { Notification } from 'electron';

// Mock Electron's Notification API
vi.mock('electron', () => ({
  Notification: vi.fn().mockImplementation((options) => ({
    show: vi.fn(),
    title: options.title,
    body: options.body,
    silent: options.silent,
  })),
}));

// Add static methods to the mocked Notification
const MockedNotification = Notification as unknown as {
  new (options: any): any;
  isSupported: () => boolean;
};

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let consoleWarnSpy: any;
  let consoleLogSpy: any;

  beforeEach(() => {
    notificationService = new NotificationService();
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    // Reset the mock and set default behavior
    vi.clearAllMocks();
    MockedNotification.isSupported = vi.fn().mockReturnValue(true);
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('Constructor', () => {
    it('should initialize with sound enabled by default', () => {
      const service = new NotificationService();
      expect(service.isSoundEnabled()).toBe(true);
    });

    it('should initialize with sound disabled when specified', () => {
      const service = new NotificationService(false);
      expect(service.isSoundEnabled()).toBe(false);
    });
  });

  describe('showNotification()', () => {
    it('should create and show notification with correct title and body', () => {
      const title = 'Timer Complete';
      const body = 'Your focus session has ended!';

      notificationService.showNotification(title, body);

      expect(Notification).toHaveBeenCalledWith({
        title,
        body,
        silent: false,
      });

      // Verify show was called on the notification instance
      const notificationInstance = vi.mocked(Notification).mock.results[0].value;
      expect(notificationInstance.show).toHaveBeenCalled();
    });

    it('should create silent notification when sound is disabled', () => {
      const service = new NotificationService(false);
      const title = 'Timer Complete';
      const body = 'Your focus session has ended!';

      service.showNotification(title, body);

      expect(Notification).toHaveBeenCalledWith({
        title,
        body,
        silent: true,
      });
    });

    it('should handle empty title and body', () => {
      notificationService.showNotification('', '');

      expect(Notification).toHaveBeenCalledWith({
        title: '',
        body: '',
        silent: false,
      });
    });

    it('should warn and not show notification when notifications are not supported', () => {
      MockedNotification.isSupported = vi.fn().mockReturnValue(false);

      notificationService.showNotification('Test', 'Test body');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Notifications are not supported on this system'
      );
      expect(Notification).not.toHaveBeenCalled();
    });

    it('should handle long notification text', () => {
      const longTitle = 'A'.repeat(100);
      const longBody = 'B'.repeat(500);

      notificationService.showNotification(longTitle, longBody);

      expect(Notification).toHaveBeenCalledWith({
        title: longTitle,
        body: longBody,
        silent: false,
      });
    });

    it('should handle special characters in notification text', () => {
      const title = 'Timer ⏰ Complete!';
      const body = 'Great work! 🎉\nTake a break.';

      notificationService.showNotification(title, body);

      expect(Notification).toHaveBeenCalledWith({
        title,
        body,
        silent: false,
      });
    });
  });

  describe('playSound()', () => {
    it('should log sound play action for complete sound', () => {
      notificationService.playSound('complete');

      expect(consoleLogSpy).toHaveBeenCalledWith('Playing complete sound');
    });

    it('should log sound play action for warning sound', () => {
      notificationService.playSound('warning');

      expect(consoleLogSpy).toHaveBeenCalledWith('Playing warning sound');
    });

    it('should not play sound when sound is disabled', () => {
      const service = new NotificationService(false);

      service.playSound('complete');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should respect sound enabled state changes', () => {
      notificationService.setSoundEnabled(false);
      notificationService.playSound('complete');
      expect(consoleLogSpy).not.toHaveBeenCalled();

      notificationService.setSoundEnabled(true);
      notificationService.playSound('complete');
      expect(consoleLogSpy).toHaveBeenCalledWith('Playing complete sound');
    });
  });

  describe('checkPermission()', () => {
    it('should return true when notifications are supported', async () => {
      MockedNotification.isSupported = vi.fn().mockReturnValue(true);

      const result = await notificationService.checkPermission();

      expect(result).toBe(true);
      expect(MockedNotification.isSupported).toHaveBeenCalled();
    });

    it('should return false when notifications are not supported', async () => {
      MockedNotification.isSupported = vi.fn().mockReturnValue(false);

      const result = await notificationService.checkPermission();

      expect(result).toBe(false);
      expect(MockedNotification.isSupported).toHaveBeenCalled();
    });
  });

  describe('requestPermission()', () => {
    it('should return true when notifications are supported', async () => {
      MockedNotification.isSupported = vi.fn().mockReturnValue(true);

      const result = await notificationService.requestPermission();

      expect(result).toBe(true);
      expect(MockedNotification.isSupported).toHaveBeenCalled();
    });

    it('should return false when notifications are not supported', async () => {
      MockedNotification.isSupported = vi.fn().mockReturnValue(false);

      const result = await notificationService.requestPermission();

      expect(result).toBe(false);
      expect(MockedNotification.isSupported).toHaveBeenCalled();
    });
  });

  describe('setSoundEnabled() and isSoundEnabled()', () => {
    it('should enable sound', () => {
      const service = new NotificationService(false);
      expect(service.isSoundEnabled()).toBe(false);

      service.setSoundEnabled(true);
      expect(service.isSoundEnabled()).toBe(true);
    });

    it('should disable sound', () => {
      const service = new NotificationService(true);
      expect(service.isSoundEnabled()).toBe(true);

      service.setSoundEnabled(false);
      expect(service.isSoundEnabled()).toBe(false);
    });

    it('should toggle sound multiple times', () => {
      notificationService.setSoundEnabled(false);
      expect(notificationService.isSoundEnabled()).toBe(false);

      notificationService.setSoundEnabled(true);
      expect(notificationService.isSoundEnabled()).toBe(true);

      notificationService.setSoundEnabled(false);
      expect(notificationService.isSoundEnabled()).toBe(false);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete timer notification workflow', () => {
      const title = 'Pomodoro Complete!';
      const body = 'Time for a break!';

      notificationService.showNotification(title, body);
      notificationService.playSound('complete');

      expect(Notification).toHaveBeenCalledWith({
        title,
        body,
        silent: false,
      });
      expect(consoleLogSpy).toHaveBeenCalledWith('Playing complete sound');
    });

    it('should handle warning notification workflow', () => {
      const title = 'Warning';
      const body = 'Timer interrupted';

      notificationService.showNotification(title, body);
      notificationService.playSound('warning');

      expect(Notification).toHaveBeenCalledWith({
        title,
        body,
        silent: false,
      });
      expect(consoleLogSpy).toHaveBeenCalledWith('Playing warning sound');
    });

    it('should handle silent mode for all operations', () => {
      const service = new NotificationService(false);

      service.showNotification('Test', 'Test body');
      expect(Notification).toHaveBeenCalledWith({
        title: 'Test',
        body: 'Test body',
        silent: true,
      });

      service.playSound('complete');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle rapid successive notifications', () => {
      for (let i = 0; i < 10; i++) {
        notificationService.showNotification(`Title ${i}`, `Body ${i}`);
      }

      expect(Notification).toHaveBeenCalledTimes(10);
    });

    it('should handle rapid successive sound plays', () => {
      for (let i = 0; i < 5; i++) {
        notificationService.playSound('complete');
      }

      expect(consoleLogSpy).toHaveBeenCalledTimes(5);
    });

    it('should handle permission check failures gracefully', async () => {
      MockedNotification.isSupported = vi.fn().mockImplementation(() => {
        throw new Error('Permission check failed');
      });

      await expect(notificationService.checkPermission()).rejects.toThrow(
        'Permission check failed'
      );
    });
  });
});
