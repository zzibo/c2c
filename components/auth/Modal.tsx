'use client';

import React, { useEffect, useRef } from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  size?: 'md' | 'lg' | 'xl';
}

export function Modal({ isOpen, onClose, children, title, size = 'md' }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  const sizeClasses = {
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center p-0 md:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm" />

      {/* Modal */}
      <div
        ref={modalRef}
        className={`relative z-10 w-full h-full md:h-auto ${sizeClasses[size]} bg-white rounded-none md:rounded-lg shadow-2xl md:border-2 md:border-gray-900`}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        {title && (
          <div className="border-b-2 border-gray-300 px-4 py-3 md:px-6 md:py-4 bg-c2c-base md:rounded-t-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-lg md:text-xl font-bold text-gray-900">{title}</h2>
              <button
                onClick={onClose}
                className="text-gray-700 hover:text-gray-900 transition-colors text-2xl leading-none font-bold min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-4 md:p-6 overflow-y-auto max-h-[calc(100vh-80px)] md:max-h-none">{children}</div>
      </div>
    </div>
  );
}
