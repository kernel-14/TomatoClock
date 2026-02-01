/**
 * Property-Based Tests for types module
 * Using fast-check library for property testing
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateTaskName } from './types';

describe('validateTaskName - Property-Based Tests', () => {
  /**
   * Feature: pomodoro-timer, Property 6: 空任务名称默认值
   * 
   * 对于任何由纯空白字符组成的任务名称（包括空字符串、空格、制表符等），
   * 系统应该将其替换为"未命名任务"
   * 
   * **Validates: Requirements 2.3**
   */
  it('Property 6: should replace any whitespace-only task name with default value', () => {
    fc.assert(
      fc.property(
        // Generate strings composed entirely of whitespace characters
        fc.oneof(
          // Empty string
          fc.constant(''),
          // Strings of spaces
          fc.integer({ min: 1, max: 100 }).map(n => ' '.repeat(n)),
          // Strings of tabs
          fc.integer({ min: 1, max: 100 }).map(n => '\t'.repeat(n)),
          // Strings of newlines
          fc.integer({ min: 1, max: 100 }).map(n => '\n'.repeat(n)),
          // Strings of carriage returns
          fc.integer({ min: 1, max: 100 }).map(n => '\r'.repeat(n)),
          // Mixed whitespace characters
          fc.array(
            fc.constantFrom(' ', '\t', '\n', '\r', '\v', '\f'),
            { minLength: 1, maxLength: 100 }
          ).map(chars => chars.join('')),
          // Unicode whitespace characters
          fc.array(
            fc.constantFrom(
              ' ',      // Space
              '\t',     // Tab
              '\n',     // Line feed
              '\r',     // Carriage return
              '\v',     // Vertical tab
              '\f',     // Form feed
              '\u00A0', // Non-breaking space
              '\u2000', // En quad
              '\u2001', // Em quad
              '\u2002', // En space
              '\u2003', // Em space
              '\u2004', // Three-per-em space
              '\u2005', // Four-per-em space
              '\u2006', // Six-per-em space
              '\u2007', // Figure space
              '\u2008', // Punctuation space
              '\u2009', // Thin space
              '\u200A', // Hair space
              '\u202F', // Narrow no-break space
              '\u205F', // Medium mathematical space
              '\u3000'  // Ideographic space
            ),
            { minLength: 1, maxLength: 50 }
          ).map(chars => chars.join(''))
        ),
        (whitespaceString) => {
          // Verify that any whitespace-only string is replaced with the default value
          const result = validateTaskName(whitespaceString);
          expect(result).toBe('未命名任务');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6 (Complementary): Non-whitespace strings should NOT be replaced
   * 
   * This property verifies that strings containing at least one non-whitespace
   * character are NOT replaced with the default value (they may be trimmed or truncated,
   * but they should retain their non-whitespace content).
   * 
   * **Validates: Requirements 2.3**
   */
  it('Property 6 (Complementary): should NOT replace strings with non-whitespace content', () => {
    fc.assert(
      fc.property(
        // Generate strings that contain at least one non-whitespace character
        fc.tuple(
          // Leading whitespace (optional)
          fc.oneof(
            fc.constant(''),
            fc.string({ minLength: 0, maxLength: 20 }).filter(s => s.trim().length === 0)
          ),
          // Non-whitespace content (required)
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          // Trailing whitespace (optional)
          fc.oneof(
            fc.constant(''),
            fc.string({ minLength: 0, maxLength: 20 }).filter(s => s.trim().length === 0)
          )
        ).map(([leading, content, trailing]) => leading + content + trailing),
        (taskName) => {
          // Verify that strings with non-whitespace content are NOT replaced with default
          const result = validateTaskName(taskName);
          expect(result).not.toBe('未命名任务');
          
          // The result should contain the trimmed non-whitespace content
          // (it may be truncated to 100 characters, but it should not be the default value)
          const trimmed = taskName.trim();
          if (trimmed.length <= 100) {
            expect(result).toBe(trimmed);
          } else {
            // If longer than 100 chars, should be truncated
            expect(result).toBe(trimmed.substring(0, 100));
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6 (Edge Case): Empty string should always return default value
   * 
   * **Validates: Requirements 2.3**
   */
  it('Property 6 (Edge Case): empty string should return default value', () => {
    expect(validateTaskName('')).toBe('未命名任务');
  });

  /**
   * Property 6 (Edge Case): Single space should return default value
   * 
   * **Validates: Requirements 2.3**
   */
  it('Property 6 (Edge Case): single space should return default value', () => {
    expect(validateTaskName(' ')).toBe('未命名任务');
  });

  /**
   * Property 6 (Edge Case): Multiple spaces should return default value
   * 
   * **Validates: Requirements 2.3**
   */
  it('Property 6 (Edge Case): multiple spaces should return default value', () => {
    expect(validateTaskName('     ')).toBe('未命名任务');
  });

  /**
   * Property 6 (Edge Case): Tab character should return default value
   * 
   * **Validates: Requirements 2.3**
   */
  it('Property 6 (Edge Case): tab character should return default value', () => {
    expect(validateTaskName('\t')).toBe('未命名任务');
  });

  /**
   * Property 6 (Edge Case): Newline character should return default value
   * 
   * **Validates: Requirements 2.3**
   */
  it('Property 6 (Edge Case): newline character should return default value', () => {
    expect(validateTaskName('\n')).toBe('未命名任务');
  });

  /**
   * Property 6 (Edge Case): Mixed whitespace should return default value
   * 
   * **Validates: Requirements 2.3**
   */
  it('Property 6 (Edge Case): mixed whitespace should return default value', () => {
    expect(validateTaskName(' \t\n\r ')).toBe('未命名任务');
  });

  /**
   * Property 6 (Invariant): Default value should never be modified
   * 
   * This property verifies that the default value "未命名任务" itself,
   * when passed through validateTaskName, remains unchanged.
   * 
   * **Validates: Requirements 2.3**
   */
  it('Property 6 (Invariant): default value should pass through unchanged', () => {
    const defaultValue = '未命名任务';
    expect(validateTaskName(defaultValue)).toBe(defaultValue);
  });

  /**
   * Property 6 (Boundary): Whitespace with single non-whitespace character
   * 
   * This property verifies that even a single non-whitespace character
   * prevents the default value from being used.
   * 
   * **Validates: Requirements 2.3**
   */
  it('Property 6 (Boundary): single non-whitespace character should not trigger default', () => {
    fc.assert(
      fc.property(
        // Generate a single non-whitespace character
        fc.char().filter(c => c.trim().length > 0),
        // Generate optional leading whitespace
        fc.string({ minLength: 0, maxLength: 10 }).filter(s => s.trim().length === 0),
        // Generate optional trailing whitespace
        fc.string({ minLength: 0, maxLength: 10 }).filter(s => s.trim().length === 0),
        (char, leading, trailing) => {
          const taskName = leading + char + trailing;
          const result = validateTaskName(taskName);
          
          // Should NOT be the default value
          expect(result).not.toBe('未命名任务');
          // Should be the trimmed character
          expect(result).toBe(char);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6 (Idempotence): Applying validateTaskName twice should give same result
   * 
   * This property verifies that validateTaskName is idempotent for whitespace-only strings:
   * validateTaskName(validateTaskName(x)) === validateTaskName(x)
   * 
   * **Validates: Requirements 2.3**
   */
  it('Property 6 (Idempotence): should be idempotent for whitespace strings', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(''),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length === 0)
        ),
        (whitespaceString) => {
          const firstPass = validateTaskName(whitespaceString);
          const secondPass = validateTaskName(firstPass);
          
          // Both passes should give the same result
          expect(secondPass).toBe(firstPass);
          expect(secondPass).toBe('未命名任务');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6 (Unicode): Unicode whitespace characters should trigger default value
   * 
   * This property specifically tests various Unicode whitespace characters
   * to ensure they are properly recognized as whitespace.
   * 
   * **Validates: Requirements 2.3**
   */
  it('Property 6 (Unicode): should handle Unicode whitespace characters', () => {
    const unicodeWhitespaceChars = [
      '\u00A0', // Non-breaking space
      '\u1680', // Ogham space mark
      '\u2000', // En quad
      '\u2001', // Em quad
      '\u2002', // En space
      '\u2003', // Em space
      '\u2004', // Three-per-em space
      '\u2005', // Four-per-em space
      '\u2006', // Six-per-em space
      '\u2007', // Figure space
      '\u2008', // Punctuation space
      '\u2009', // Thin space
      '\u200A', // Hair space
      '\u202F', // Narrow no-break space
      '\u205F', // Medium mathematical space
      '\u3000', // Ideographic space
    ];

    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...unicodeWhitespaceChars), { minLength: 1, maxLength: 20 }),
        (whitespaceChars) => {
          const whitespaceString = whitespaceChars.join('');
          const result = validateTaskName(whitespaceString);
          
          // Should be replaced with default value
          expect(result).toBe('未命名任务');
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 6 (Comprehensive): All whitespace-only strings map to same default
   * 
   * This property verifies that regardless of the type or combination of whitespace
   * characters, all whitespace-only strings map to the same default value.
   * 
   * **Validates: Requirements 2.3**
   */
  it('Property 6 (Comprehensive): all whitespace-only strings should map to same default', () => {
    fc.assert(
      fc.property(
        // Generate two different whitespace-only strings
        fc.tuple(
          fc.oneof(
            fc.constant(''),
            fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length === 0)
          ),
          fc.oneof(
            fc.constant(''),
            fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length === 0)
          )
        ),
        ([whitespace1, whitespace2]) => {
          const result1 = validateTaskName(whitespace1);
          const result2 = validateTaskName(whitespace2);
          
          // Both should map to the same default value
          expect(result1).toBe('未命名任务');
          expect(result2).toBe('未命名任务');
          expect(result1).toBe(result2);
        }
      ),
      { numRuns: 100 }
    );
  });
});
