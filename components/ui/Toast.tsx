'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export interface ToastProps {
  id: string;
  message: string;
  duration?: number;
  onDismiss: (id: string) => void;
}

export function Toast({ id, message, duration = 3000, onDismiss }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        // Wait for animation to complete before removing
        setTimeout(() => onDismiss(id), 300);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, id, onDismiss]);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => onDismiss(id), 300);
  };

  return (
    <div
      className={`bg-c2c-orange border-2 border-c2c-orange-dark px-4 py-2 shadow-lg text-xs font-sans rounded-lg transition-all duration-300 ${
        isVisible
          ? 'opacity-100 translate-x-0'
          : 'opacity-0 translate-x-full pointer-events-none'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-white font-medium">{message}</span>
        <button
          onClick={handleDismiss}
          className="text-white hover:text-gray-200 transition-colors p-0.5 rounded"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

