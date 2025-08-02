import { useState, useEffect } from 'react';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

export const useCountdown = (startDate: string, endDate: string) => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    total: 0,
  });
  const [isActive, setIsActive] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!startDate || !endDate) {
      setIsActive(false);
      setIsExpired(false);
      setProgress(0);
      return;
    }

    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const totalDuration = end - start;

    if (totalDuration <= 0) {
      setIsActive(false);
      setIsExpired(false);
      setProgress(0);
      return;
    }

    const updateTimer = () => {
      const now = new Date().getTime();
      const timeRemaining = end - now;
      const elapsed = now - start;

      if (now < start) {
        // Before start time
        setIsActive(false);
        setIsExpired(false);
        setProgress(0);
        setTimeLeft({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          total: 0,
        });
      } else if (timeRemaining > 0) {
        // Active countdown
        setIsActive(true);
        setIsExpired(false);
        setProgress(Math.min(elapsed / totalDuration, 1));

        const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

        setTimeLeft({
          days,
          hours,
          minutes,
          seconds,
          total: timeRemaining,
        });
      } else {
        // Expired
        setIsActive(false);
        setIsExpired(true);
        setProgress(1);
        setTimeLeft({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          total: 0,
        });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [startDate, endDate]);

  return { timeLeft, isActive, isExpired, progress };
};