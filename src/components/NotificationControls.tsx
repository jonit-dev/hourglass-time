import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Bell, BellOff } from 'lucide-react';

export default function NotificationControls() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkNotificationStatus();
  }, []);

  const checkNotificationStatus = async () => {
    try {
      const status = await invoke<boolean>('get_notification_status');
      setIsEnabled(status);
    } catch (error) {
      console.error('Failed to check notification status:', error);
    }
  };

  const toggleNotifications = async () => {
    setLoading(true);
    try {
      if (isEnabled) {
        await invoke('stop_notifications');
        setIsEnabled(false);
      } else {
        await invoke('start_notifications');
        setIsEnabled(true);
      }
    } catch (error) {
      console.error('Failed to toggle notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2 p-4 bg-white/10 rounded-lg backdrop-blur-sm">
      <button
        onClick={toggleNotifications}
        disabled={loading}
        className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
          isEnabled
            ? 'bg-green-500 hover:bg-green-600 text-white'
            : 'bg-gray-500 hover:bg-gray-600 text-white'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isEnabled ? <Bell size={16} /> : <BellOff size={16} />}
        {loading ? 'Loading...' : isEnabled ? 'Notifications On' : 'Notifications Off'}
      </button>
      <span className="text-sm text-gray-300">
        {isEnabled ? 'You\'ll get reminders every 6 hours' : 'Click to enable 6-hour reminders'}
      </span>
    </div>
  );
}