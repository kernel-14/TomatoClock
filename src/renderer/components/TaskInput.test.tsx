/**
 * Unit tests for TaskInput component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskInput } from './TaskInput';

describe('TaskInput', () => {
  it('should render input field with placeholder', () => {
    render(<TaskInput value="" onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText('What are you working on?')).toBeInTheDocument();
  });

  it('should display current value', () => {
    render(<TaskInput value="Test task" onChange={vi.fn()} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('Test task');
  });

  it('should call onChange when input changes', () => {
    const onChange = vi.fn();
    render(<TaskInput value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'New task' } });
    expect(onChange).toHaveBeenCalledWith('New task');
  });

  it('should show character count', () => {
    render(<TaskInput value="Test" onChange={vi.fn()} />);
    expect(screen.getByText('4/100')).toBeInTheDocument();
  });

  it('should show warning color when near character limit', () => {
    const longText = 'a'.repeat(85);
    render(<TaskInput value={longText} onChange={vi.fn()} />);
    const counter = screen.getByText('85/100');
    expect(counter).toHaveClass('text-yellow-600');
  });

  it('should show normal color when below 80% of limit', () => {
    render(<TaskInput value="Short text" onChange={vi.fn()} />);
    const counter = screen.getByText('10/100');
    expect(counter).toHaveClass('text-gray-400');
  });

  it('should show hint for empty input', () => {
    render(<TaskInput value="" onChange={vi.fn()} />);
    expect(screen.getByText('Empty task will be named "未命名任务"')).toBeInTheDocument();
  });

  it('should not show hint for non-empty input', () => {
    render(<TaskInput value="Task" onChange={vi.fn()} />);
    expect(screen.queryByText('Empty task will be named "未命名任务"')).not.toBeInTheDocument();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<TaskInput value="" onChange={vi.fn()} disabled={true} />);
    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });

  it('should not be disabled by default', () => {
    render(<TaskInput value="" onChange={vi.fn()} />);
    const input = screen.getByRole('textbox');
    expect(input).not.toBeDisabled();
  });

  it('should enforce max length', () => {
    const onChange = vi.fn();
    render(<TaskInput value="" onChange={onChange} maxLength={10} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '12345678901' } }); // 11 characters
    // Should not call onChange because it exceeds max length
    expect(onChange).not.toHaveBeenCalled();
  });

  it('should allow input up to max length', () => {
    const onChange = vi.fn();
    render(<TaskInput value="" onChange={onChange} maxLength={10} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '1234567890' } }); // exactly 10 characters
    expect(onChange).toHaveBeenCalledWith('1234567890');
  });

  it('should use custom max length when provided', () => {
    render(<TaskInput value="" onChange={vi.fn()} maxLength={50} />);
    expect(screen.getByText('0/50')).toBeInTheDocument();
  });

  it('should show hint for whitespace-only input', () => {
    render(<TaskInput value="   " onChange={vi.fn()} />);
    expect(screen.getByText('Empty task will be named "未命名任务"')).toBeInTheDocument();
  });
});
