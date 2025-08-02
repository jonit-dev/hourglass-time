import React from 'react';
import { Calendar } from 'lucide-react';

interface DateInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
}

export const DateInput: React.FC<DateInputProps> = ({ label, value, onChange, min }) => {
  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-300 mb-2">
        {label}
      </label>
      <div className="relative">
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={min}
          className="w-full px-4 py-3 pl-12 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200"
        />
        <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
      </div>
    </div>
  );
};