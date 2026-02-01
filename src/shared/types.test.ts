/**
 * Basic test to verify testing infrastructure is working
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateTaskName } from './types';

describe('Testing Infrastructure', () => {
  it('should run basic unit tests', () => {
    expect(true).toBe(true);
  });

  it('should run property-based tests with fast-check', () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        // Property: adding zero to any integer returns the same integer
        return n + 0 === n;
      }),
      { numRuns: 100 }
    );
  });

  it('should validate TypeScript types are available', () => {
    const session = {
      id: 'test-id',
      taskName: 'Test Task',
      duration: 1500,
      startTime: new Date(),
      endTime: new Date(),
      completed: true,
    };

    expect(session.taskName).toBe('Test Task');
    expect(session.duration).toBe(1500);
  });
});

describe('validateTaskName', () => {
  describe('empty and whitespace handling', () => {
    it('should return default value for empty string', () => {
      expect(validateTaskName('')).toBe('未命名任务');
    });

    it('should return default value for whitespace-only string (spaces)', () => {
      expect(validateTaskName('   ')).toBe('未命名任务');
    });

    it('should return default value for whitespace-only string (tabs)', () => {
      expect(validateTaskName('\t\t\t')).toBe('未命名任务');
    });

    it('should return default value for whitespace-only string (newlines)', () => {
      expect(validateTaskName('\n\n')).toBe('未命名任务');
    });

    it('should return default value for mixed whitespace', () => {
      expect(validateTaskName(' \t\n ')).toBe('未命名任务');
    });
  });

  describe('trimming behavior', () => {
    it('should trim leading whitespace', () => {
      expect(validateTaskName('  Task Name')).toBe('Task Name');
    });

    it('should trim trailing whitespace', () => {
      expect(validateTaskName('Task Name  ')).toBe('Task Name');
    });

    it('should trim both leading and trailing whitespace', () => {
      expect(validateTaskName('  Task Name  ')).toBe('Task Name');
    });

    it('should preserve internal whitespace', () => {
      expect(validateTaskName('Task  Name  With  Spaces')).toBe('Task  Name  With  Spaces');
    });
  });

  describe('length validation', () => {
    it('should accept task names under 100 characters', () => {
      const taskName = 'A'.repeat(50);
      expect(validateTaskName(taskName)).toBe(taskName);
    });

    it('should accept task names exactly 100 characters', () => {
      const taskName = 'A'.repeat(100);
      expect(validateTaskName(taskName)).toBe(taskName);
    });

    it('should truncate task names over 100 characters', () => {
      const taskName = 'A'.repeat(150);
      const expected = 'A'.repeat(100);
      expect(validateTaskName(taskName)).toBe(expected);
    });

    it('should truncate to 100 characters after trimming', () => {
      const taskName = '  ' + 'A'.repeat(150) + '  ';
      const expected = 'A'.repeat(100);
      expect(validateTaskName(taskName)).toBe(expected);
    });
  });

  describe('normal task names', () => {
    it('should accept simple task names', () => {
      expect(validateTaskName('Write code')).toBe('Write code');
    });

    it('should accept task names with numbers', () => {
      expect(validateTaskName('Task 123')).toBe('Task 123');
    });

    it('should accept task names with special characters', () => {
      expect(validateTaskName('Task #1: Review PR')).toBe('Task #1: Review PR');
    });

    it('should accept task names with Chinese characters', () => {
      expect(validateTaskName('编写代码')).toBe('编写代码');
    });

    it('should accept task names with emojis', () => {
      expect(validateTaskName('🍅 Pomodoro Task')).toBe('🍅 Pomodoro Task');
    });
  });
});
