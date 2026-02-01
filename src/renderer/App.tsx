/**
 * Main React application component
 */

import React, { useState, useEffect } from 'react';
import { MainTimer } from './components/MainTimer';
import { Statistics } from './components/Statistics';
import { Settings } from './components/Settings';
import './App.css';

type View = 'timer' | 'statistics' | 'settings';

function App() {
  const [currentView, setCurrentView] = useState<View>('timer');
  const [isWindowFocused, setIsWindowFocused] = useState(true);

  // Handle window focus/blur for opacity transitions
  useEffect(() => {
    const handleFocus = () => setIsWindowFocused(true);
    const handleBlur = () => setIsWindowFocused(false);

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  return (
    <div className={`app-container ${isWindowFocused ? 'window-focused' : 'window-blurred'}`}>
      <div className="floating-window bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20 overflow-hidden transition-all duration-300 hover:shadow-3xl">
        {/* Navigation */}
        <div className="nav-bar flex border-b border-gray-200 bg-white/50">
          <button
            onClick={() => setCurrentView('timer')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              currentView === 'timer'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            ⏱️ Timer
          </button>
          <button
            onClick={() => setCurrentView('statistics')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              currentView === 'statistics'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            📊 Stats
          </button>
          <button
            onClick={() => setCurrentView('settings')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              currentView === 'settings'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            ⚙️ Settings
          </button>
        </div>

        {/* Content */}
        <div className="content-area">
          {currentView === 'timer' && <MainTimer />}
          {currentView === 'statistics' && <Statistics />}
          {currentView === 'settings' && <Settings />}
        </div>
      </div>
    </div>
  );
}

export default App;
