/**
 * Settings Component
 * Provides UI for application settings
 */

import React, { useState, useEffect } from 'react';
import type { AppSettings } from '../../shared/types';

const DEFAULT_SETTINGS: AppSettings = {
  alwaysOnTop: false,
  windowPosition: { x: 0, y: 0 },
  defaultDuration: 1500, // 25 minutes
  soundEnabled: true,
  opacity: 0.9,
};

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loadedSettings = await window.electronAPI.settings.load();
        setSettings(loadedSettings);
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);

    try {
      await window.electronAPI.settings.save(settings);
      
      // Apply window settings immediately
      await window.electronAPI.window.setAlwaysOnTop(settings.alwaysOnTop);
      await window.electronAPI.window.setOpacity(settings.opacity);
      
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveMessage('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleAlwaysOnTopChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({ ...settings, alwaysOnTop: e.target.checked });
  };

  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const opacity = parseFloat(e.target.value);
    setSettings({ ...settings, opacity });
  };

  const handleDefaultDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const minutes = parseInt(e.target.value, 10);
    if (!isNaN(minutes) && minutes > 0) {
      setSettings({ ...settings, defaultDuration: minutes * 60 });
    }
  };

  const handleSoundEnabledChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({ ...settings, soundEnabled: e.target.checked });
  };

  if (loading) {
    return (
      <div className="settings-container p-6 text-center text-gray-500">
        Loading settings...
      </div>
    );
  }

  const defaultDurationMinutes = Math.floor(settings.defaultDuration / 60);

  return (
    <div className="settings-container p-6 space-y-6">
      <div className="text-2xl font-bold text-gray-800 text-center">
        ⚙️ Settings
      </div>

      <div className="space-y-4">
        {/* Always On Top */}
        <div className="setting-item bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-800">Always On Top</div>
              <div className="text-sm text-gray-500">
                Keep window above other windows
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.alwaysOnTop}
                onChange={handleAlwaysOnTopChange}
                className="sr-only peer"
                aria-label="Always on top toggle"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Opacity */}
        <div className="setting-item bg-white rounded-lg p-4 border border-gray-200">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium text-gray-800">Window Opacity</div>
              <div className="text-sm text-gray-600 font-mono">
                {Math.round(settings.opacity * 100)}%
              </div>
            </div>
            <div className="text-sm text-gray-500 mb-3">
              Transparency when window is inactive
            </div>
            <input
              type="range"
              min="0.3"
              max="1.0"
              step="0.1"
              value={settings.opacity}
              onChange={handleOpacityChange}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              aria-label="Opacity slider"
            />
          </div>
        </div>

        {/* Default Duration */}
        <div className="setting-item bg-white rounded-lg p-4 border border-gray-200">
          <div>
            <div className="font-medium text-gray-800 mb-2">
              Default Timer Duration
            </div>
            <div className="text-sm text-gray-500 mb-3">
              Default focus session length in minutes
            </div>
            <input
              type="number"
              min="1"
              max="120"
              value={defaultDurationMinutes}
              onChange={handleDefaultDurationChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Default duration input"
            />
          </div>
        </div>

        {/* Sound Enabled */}
        <div className="setting-item bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-800">Sound Notifications</div>
              <div className="text-sm text-gray-500">
                Play sound when timer completes
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.soundEnabled}
                onChange={handleSoundEnabledChange}
                className="sr-only peer"
                aria-label="Sound enabled toggle"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Save settings"
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </button>

      {/* Save Message */}
      {saveMessage && (
        <div
          className={`text-center py-2 rounded-lg ${
            saveMessage.includes('success')
              ? 'bg-green-50 text-green-600'
              : 'bg-red-50 text-red-600'
          }`}
        >
          {saveMessage}
        </div>
      )}
    </div>
  );
};
