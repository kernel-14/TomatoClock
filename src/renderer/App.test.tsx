/**
 * Unit and property tests for App component
 * Tests opacity state transitions based on window focus
 */

import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import App from './App';
import * as fc from 'fast-check';

describe('App', () => {
  it('should render navigation tabs', () => {
    const { getByText } = render(<App />);
    expect(getByText('⏱️ Timer')).toBeInTheDocument();
    expect(getByText('📊 Stats')).toBeInTheDocument();
    expect(getByText('⚙️ Settings')).toBeInTheDocument();
  });

  it('should start with timer view', () => {
    const { container } = render(<App />);
    // Timer view should be visible (contains task input)
    expect(container.querySelector('.main-timer')).toBeInTheDocument();
  });

  it('should switch to statistics view', () => {
    const { getByText, container } = render(<App />);
    fireEvent.click(getByText('📊 Stats'));
    expect(container.querySelector('.statistics-container')).toBeInTheDocument();
  });

  it('should switch to settings view', () => {
    const { getByText, container } = render(<App />);
    fireEvent.click(getByText('⚙️ Settings'));
    expect(container.querySelector('.settings-container')).toBeInTheDocument();
  });

  it('should apply window-focused class when window is focused', () => {
    const { container } = render(<App />);
    const appContainer = container.querySelector('.app-container');
    
    // Initially should be focused
    expect(appContainer).toHaveClass('window-focused');
  });

  it('should apply window-blurred class when window loses focus', () => {
    const { container } = render(<App />);
    const appContainer = container.querySelector('.app-container');
    
    // Simulate blur event
    fireEvent.blur(window);
    
    expect(appContainer).toHaveClass('window-blurred');
  });

  it('should switch back to window-focused class when window regains focus', () => {
    const { container } = render(<App />);
    const appContainer = container.querySelector('.app-container');
    
    // Blur then focus
    fireEvent.blur(window);
    fireEvent.focus(window);
    
    expect(appContainer).toHaveClass('window-focused');
  });
});

describe('App - Opacity State Transitions (Property Tests)', () => {
  /**
   * Property 16: Opacity state transition correctness
   * 
   * Feature: pomodoro-timer, Property 16: For any window, when focus state changes,
   * opacity should correctly switch between configured inactive opacity and 1.0 (fully opaque)
   * 
   * Validates: Requirements 5.5, 7.1, 7.2
   */
  it('Property 16: should correctly transition opacity classes based on focus state', () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { minLength: 1, maxLength: 20 }), // Sequence of focus states
        (focusStates) => {
          const { container } = render(<App />);
          const appContainer = container.querySelector('.app-container');
          
          // Apply each focus state in sequence
          for (const shouldFocus of focusStates) {
            if (shouldFocus) {
              fireEvent.focus(window);
            } else {
              fireEvent.blur(window);
            }
            
            // Verify the correct class is applied
            if (shouldFocus) {
              expect(appContainer).toHaveClass('window-focused');
              expect(appContainer).not.toHaveClass('window-blurred');
            } else {
              expect(appContainer).toHaveClass('window-blurred');
              expect(appContainer).not.toHaveClass('window-focused');
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Opacity class consistency
   * 
   * The window should never have both focused and blurred classes simultaneously
   */
  it('should never have both window-focused and window-blurred classes', () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { minLength: 5, maxLength: 15 }),
        (focusStates) => {
          const { container } = render(<App />);
          const appContainer = container.querySelector('.app-container');
          
          for (const shouldFocus of focusStates) {
            if (shouldFocus) {
              fireEvent.focus(window);
            } else {
              fireEvent.blur(window);
            }
            
            // Should never have both classes
            const hasFocused = appContainer?.classList.contains('window-focused');
            const hasBlurred = appContainer?.classList.contains('window-blurred');
            expect(hasFocused && hasBlurred).toBe(false);
            
            // Should always have exactly one class
            expect(hasFocused || hasBlurred).toBe(true);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Initial state is focused
   * 
   * The window should always start in the focused state
   */
  it('should always start with window-focused class', () => {
    fc.assert(
      fc.property(
        fc.constant(null), // No input needed, just test initial state
        () => {
          const { container } = render(<App />);
          const appContainer = container.querySelector('.app-container');
          
          expect(appContainer).toHaveClass('window-focused');
          expect(appContainer).not.toHaveClass('window-blurred');
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});
