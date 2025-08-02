import React from 'react';
import { Clock, AlertCircle, CheckCircle } from 'lucide-react';

interface CountdownDisplayProps {
  timeLeft: {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    total: number;
  };
  isActive: boolean;
  isExpired: boolean;
}

export const CountdownDisplay: React.FC<CountdownDisplayProps> = ({ 
  timeLeft, 
  isActive, 
  isExpired 
}) => {
  const getStatusColor = () => {
    if (isExpired) return 'text-red-400';
    if (timeLeft.total < 24 * 60 * 60 * 1000) return 'text-amber-400'; // Less than 1 day
    if (timeLeft.total < 7 * 24 * 60 * 60 * 1000) return 'text-yellow-400'; // Less than 1 week
    return 'text-green-400';
  };

  const getStatusIcon = () => {
    if (isExpired) return <CheckCircle className="w-6 h-6" />;
    if (timeLeft.total < 24 * 60 * 60 * 1000) return <AlertCircle className="w-6 h-6" />;
    return <Clock className="w-6 h-6" />;
  };

  const formatNumber = (num: number) => num.toString().padStart(2, '0');

  return (
    <div className="text-center space-y-6">
      <div className={`flex items-center justify-center gap-3 ${getStatusColor()}`}>
        {getStatusIcon()}
        <h2 className="text-2xl font-bold">
          {isExpired ? 'Time\'s Up!' : isActive ? 'Time Remaining' : 'Set Your Dates'}
        </h2>
      </div>

      {isActive && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className={`text-3xl font-bold ${getStatusColor()}`}>
              {formatNumber(timeLeft.days)}
            </div>
            <div className="text-gray-400 text-sm uppercase tracking-wide">Days</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className={`text-3xl font-bold ${getStatusColor()}`}>
              {formatNumber(timeLeft.hours)}
            </div>
            <div className="text-gray-400 text-sm uppercase tracking-wide">Hours</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className={`text-3xl font-bold ${getStatusColor()}`}>
              {formatNumber(timeLeft.minutes)}
            </div>
            <div className="text-gray-400 text-sm uppercase tracking-wide">Minutes</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className={`text-3xl font-bold ${getStatusColor()}`}>
              {formatNumber(timeLeft.seconds)}
            </div>
            <div className="text-gray-400 text-sm uppercase tracking-wide">Seconds</div>
          </div>
        </div>
      )}

      {!isActive && !isExpired && (
        <div className="text-gray-400 text-lg">
          Choose start and end dates to begin the countdown
        </div>
      )}
    </div>
  );
};