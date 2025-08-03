import React, { useState, useEffect } from 'react';
import { HourglassScene } from './components/HourglassScene';
import { DateInput } from './components/DateInput';
import { CountdownDisplay } from './components/CountdownDisplay';
import NotificationControls from './components/NotificationControls';
import { useCountdown } from './hooks/useCountdown';
import { Hourglass, Sparkles } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

function App() {
  // Calculate default dates: June 27th, 2025 and 48 weeks later
  const getDefaultDates = () => {
    const startDate = new Date('2025-06-27T09:00');
    const endDate = new Date(startDate.getTime() + (48 * 7 * 24 * 60 * 60 * 1000)); // 48 weeks later
    
    return {
      start: startDate.toISOString().slice(0, 16),
      end: endDate.toISOString().slice(0, 16)
    };
  };

  const defaultDates = getDefaultDates();
  const [startDate, setStartDate] = useState(defaultDates.start);
  const [endDate, setEndDate] = useState(defaultDates.end);
  
  const { timeLeft, isActive, isExpired, progress } = useCountdown(startDate, endDate);

  // Sync dates with backend when they change
  useEffect(() => {
    if (startDate && endDate) {
      const syncDates = async () => {
        try {
          // Convert to ISO format for backend
          const startISO = new Date(startDate).toISOString();
          const endISO = new Date(endDate).toISOString();
          await invoke('set_timer_dates', { 
            startDate: startISO, 
            endDate: endISO 
          });
        } catch (error) {
          console.error('Failed to sync dates with backend:', error);
        }
      };
      syncDates();
    }
  }, [startDate, endDate]);

  // Get current datetime for min values
  const now = new Date();
  const nowString = now.toISOString().slice(0, 16);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Hourglass className="w-8 h-8 text-amber-400" />
            <h1 className="text-4xl font-bold text-white">Temporal Hourglass</h1>
            <Sparkles className="w-8 h-8 text-amber-400" />
          </div>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Visualize the passage of time with a beautiful 3D hourglass. 
            Watch as golden sand flows from future to past, marking every precious moment.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
          {/* Controls Section */}
          <div className="space-y-8">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50">
              <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <Hourglass className="w-5 h-5 text-amber-400" />
                Time Configuration
              </h3>
              
              <div className="space-y-6">
                <DateInput
                  label="Start Date & Time"
                  value={startDate}
                  onChange={setStartDate}
                  min={nowString}
                />
                <DateInput
                  label="End Date & Time"
                  value={endDate}
                  onChange={setEndDate}
                  min={startDate || nowString}
                />
              </div>

              {startDate && endDate && (
                <div className="mt-6 p-4 bg-gray-700/30 rounded-lg border border-gray-600/30">
                  <div className="text-sm text-gray-300">
                    <div className="flex justify-between items-center">
                      <span>Duration:</span>
                      <span className="text-amber-400 font-medium">
                        {Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))} days
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span>Progress:</span>
                      <span className="text-amber-400 font-medium">
                        {(progress * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 w-full bg-gray-600 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${progress * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            <CountdownDisplay 
              timeLeft={timeLeft}
              isActive={isActive}
              isExpired={isExpired}
            />

            <NotificationControls />
          </div>

          {/* Hourglass Scene */}
          <div className="flex flex-col items-center space-y-6">
            <HourglassScene 
              timeProgress={progress}
              isActive={isActive}
            />
            
            <div className="text-center text-gray-400 text-sm max-w-sm">
              The hourglass rotates gently as time flows. Golden sand particles 
              fall from top to bottom, representing the passage of time between your chosen dates.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-16 text-gray-500 text-sm">
          <p>Time flows like sand through an hourglass • Every moment counts</p>
        </div>
      </div>
    </div>
  );
}

export default App;