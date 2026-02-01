/**
 * Test setup file for Vitest
 */

import '@testing-library/jest-dom';

// Mock electron API for renderer tests
global.window = global.window || {};
(global.window as any).electronAPI = {
  timer: {
    start: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn().mockResolvedValue(undefined),
    getState: vi.fn().mockResolvedValue({
      status: 'idle',
      remainingSeconds: 1500,
      totalSeconds: 1500,
      taskName: '',
      startTime: null,
    }),
    onTick: vi.fn(),
    onComplete: vi.fn(),
  },
  data: {
    saveSession: vi.fn().mockResolvedValue(undefined),
    getSessions: vi.fn().mockResolvedValue([]),
    getStatistics: vi.fn().mockResolvedValue({
      totalFocusTime: 0,
      sessionCount: 0,
      sessions: [],
    }),
  },
  settings: {
    save: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue({
      alwaysOnTop: false,
      windowPosition: { x: 0, y: 0 },
      defaultDuration: 1500,
      soundEnabled: true,
      opacity: 0.9,
    }),
  },
  window: {
    setAlwaysOnTop: vi.fn().mockResolvedValue(undefined),
    setOpacity: vi.fn().mockResolvedValue(undefined),
    savePosition: vi.fn().mockResolvedValue(undefined),
    getPosition: vi.fn().mockResolvedValue({ x: 0, y: 0 }),
  },
};
