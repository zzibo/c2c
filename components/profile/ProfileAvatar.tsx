'use client';

import Image from 'next/image';

interface ProfileAvatarProps {
  photoUrl: string | null;
  username?: string;
  email?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap = {
  sm: { container: 'w-8 h-8', text: 'text-xs', border: 'border-2' },
  md: { container: 'w-12 h-12', text: 'text-base', border: 'border-2' },
  lg: { container: 'w-16 h-16', text: 'text-xl', border: 'border-2' },
  xl: { container: 'w-24 h-24', text: 'text-3xl', border: 'border-4' },
};

const sizePixels = {
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
};

/**
 * ProfileAvatar Component
 * Displays user profile photo or fallback initial letter
 *
 * @param photoUrl - URL of profile photo (null for fallback)
 * @param username - Username for fallback initial (optional)
 * @param email - Email for fallback initial (optional)
 * @param size - Avatar size (sm, md, lg, xl)
 * @param className - Additional CSS classes
 */
export function ProfileAvatar({
  photoUrl,
  username,
  email,
  size = 'md',
  className = '',
}: ProfileAvatarProps) {
  const sizeClasses = sizeMap[size];
  const pixels = sizePixels[size];

  // Get fallback initial from username or email
  const getFallbackInitial = () => {
    if (username) return username.charAt(0).toUpperCase();
    if (email) return email.charAt(0).toUpperCase();
    return '?';
  };

  return (
    <div
      className={`${sizeClasses.container} ${sizeClasses.border} rounded-full overflow-hidden bg-gray-200 border-gray-300 flex items-center justify-center ${className}`}
    >
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt={username ? `${username}'s profile` : 'Profile photo'}
          width={pixels}
          height={pixels}
          className="object-cover w-full h-full"
          unoptimized
        />
      ) : (
        <span className={`${sizeClasses.text} font-bold text-gray-600`}>
          {getFallbackInitial()}
        </span>
      )}
    </div>
  );
}
