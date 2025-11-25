'use client';

import React, { useEffect, useRef } from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export function Modal({ isOpen, onClose, children, title }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-amber-900/30 backdrop-blur-sm" />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative z-10 w-full max-w-md bg-white rounded-lg shadow-2xl border-2 border-amber-900"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        {title && (
          <div className="border-b-2 border-amber-300 px-6 py-4 bg-amber-50">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-amber-900">{title}</h2>
              <button
                onClick={onClose}
                className="text-amber-700 hover:text-amber-900 transition-colors text-2xl leading-none font-bold"
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
