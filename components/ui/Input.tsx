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
    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
    : success
    ? 'border-green-300 focus:border-green-500 focus:ring-green-500'
    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500';

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <input
        className={`
          w-full px-3 py-2
          text-sm
          bg-white border rounded-lg ${borderColor}
          focus:outline-none focus:ring-2
          transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
