/**
 * Unit tests for Settings component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Settings } from './Settings';

describe('Settings', () => {
  const mockSettings = {
    alwaysOnTop: false,
    windowPosition: { x: 0, y: 0 },
    defaultDuration: 1500,
    soundEnabled: true,
    opacity: 0.9,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementation
    (window.electronAPI.settings.load as any).mockResolvedValue(mockSettings);
    (window.electronAPI.settings.save as any).mockResolvedValue(undefined);
    (window.electronAPI.window.setAlwaysOnTop as any).mockResolvedValue(undefined);
    (window.electronAPI.window.setOpacity as any).mockResolvedValue(undefined);
  });

  it('should show loading state initially', () => {
    render(<Settings />);
    expect(screen.getByText('Loading settings...')).toBeInTheDocument();
  });

  it('should load and display settings', async () => {
    render(<Settings />);
    
    await waitFor(() => {
      expect(screen.getByText('⚙️ Settings')).toBeInTheDocument();
    });
    
    expect(window.electronAPI.settings.load).toHaveBeenCalled();
  });

  it('should display always on top toggle', async () => {
    render(<Settings />);
    
    await waitFor(() => {
      expect(screen.getByText('Always On Top')).toBeInTheDocument();
    });
    
    const toggle = screen.getByLabelText('Always on top toggle') as HTMLInputElement;
    expect(toggle).toBeInTheDocument();
    expect(toggle.checked).toBe(false);
  });

  it('should display opacity slider', async () => {
    render(<Settings />);
    
    await waitFor(() => {
      expect(screen.getByText('Window Opacity')).toBeInTheDocument();
    });
    
    const slider = screen.getByLabelText('Opacity slider') as HTMLInputElement;
    expect(slider).toBeInTheDocument();
    expect(slider.value).toBe('0.9');
  });

  it('should display default duration input', async () => {
    render(<Settings />);
    
    await waitFor(() => {
      expect(screen.getByText('Default Timer Duration')).toBeInTheDocument();
    });
    
    const input = screen.getByLabelText('Default duration input') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('25'); // 1500 seconds = 25 minutes
  });

  it('should display sound enabled toggle', async () => {
    render(<Settings />);
    
    await waitFor(() => {
      expect(screen.getByText('Sound Notifications')).toBeInTheDocument();
    });
    
    const toggle = screen.getByLabelText('Sound enabled toggle') as HTMLInputElement;
    expect(toggle).toBeInTheDocument();
    expect(toggle.checked).toBe(true);
  });

  it('should toggle always on top setting', async () => {
    render(<Settings />);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Always on top toggle')).toBeInTheDocument();
    });
    
    const toggle = screen.getByLabelText('Always on top toggle') as HTMLInputElement;
    fireEvent.click(toggle);
    
    expect(toggle.checked).toBe(true);
  });

  it('should change opacity value', async () => {
    render(<Settings />);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Opacity slider')).toBeInTheDocument();
    });
    
    const slider = screen.getByLabelText('Opacity slider') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '0.5' } });
    
    expect(slider.value).toBe('0.5');
  });

  it('should change default duration', async () => {
    render(<Settings />);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Default duration input')).toBeInTheDocument();
    });
    
    const input = screen.getByLabelText('Default duration input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '30' } });
    
    expect(input.value).toBe('30');
  });

  it('should toggle sound enabled setting', async () => {
    render(<Settings />);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Sound enabled toggle')).toBeInTheDocument();
    });
    
    const toggle = screen.getByLabelText('Sound enabled toggle') as HTMLInputElement;
    fireEvent.click(toggle);
    
    expect(toggle.checked).toBe(false);
  });

  it('should save settings when save button is clicked', async () => {
    render(<Settings />);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Save settings')).toBeInTheDocument();
    });
    
    const saveButton = screen.getByLabelText('Save settings');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(window.electronAPI.settings.save).toHaveBeenCalled();
    });
  });

  it('should apply window settings when saving', async () => {
    render(<Settings />);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Save settings')).toBeInTheDocument();
    });
    
    const saveButton = screen.getByLabelText('Save settings');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(window.electronAPI.window.setAlwaysOnTop).toHaveBeenCalled();
      expect(window.electronAPI.window.setOpacity).toHaveBeenCalled();
    });
  });

  it('should show success message after saving', async () => {
    render(<Settings />);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Save settings')).toBeInTheDocument();
    });
    
    const saveButton = screen.getByLabelText('Save settings');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText('Settings saved successfully!')).toBeInTheDocument();
    });
  });

  it('should show error message if save fails', async () => {
    (window.electronAPI.settings.save as any).mockRejectedValue(new Error('Save failed'));
    
    render(<Settings />);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Save settings')).toBeInTheDocument();
    });
    
    const saveButton = screen.getByLabelText('Save settings');
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to save settings. Please try again.')).toBeInTheDocument();
    });
  });

  it('should disable save button while saving', async () => {
    render(<Settings />);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Save settings')).toBeInTheDocument();
    });
    
    const saveButton = screen.getByLabelText('Save settings') as HTMLButtonElement;
    fireEvent.click(saveButton);
    
    // Button should be disabled immediately
    expect(saveButton.disabled).toBe(true);
  });

  it('should display opacity percentage', async () => {
    render(<Settings />);
    
    await waitFor(() => {
      expect(screen.getByText('90%')).toBeInTheDocument();
    });
  });
});
