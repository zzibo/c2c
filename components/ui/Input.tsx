import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  success?: boolean;
}

export function Input({
  label,
  error,
  success,
  className = '',
  ...props
}: InputProps) {
  const borderColor = error
    ? 'border-red-400 focus:border-red-600 focus:ring-red-500'
    : success
    ? 'border-green-400 focus:border-green-600 focus:ring-green-500'
    : 'border-gray-400 focus:border-c2c-orange focus:ring-c2c-orange';

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-900 mb-1">
          {label}
        </label>
      )}
      <input
        className={`
          w-full px-3 py-2
          text-sm text-gray-900
          placeholder-gray-400
          bg-white border ${borderColor}
          focus:outline-none focus:ring-2
          transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-700">{error}</p>
      )}
    </div>
  );
}
