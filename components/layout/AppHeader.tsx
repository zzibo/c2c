'use client';

import { useState } from 'react';
import Image from 'next/image';
import { AuthModal } from '@/components/auth/AuthModal';
import { useAuth } from '@/lib/auth/AuthContext';

export function AppHeader() {
    const { user, profile, signOut } = useAuth();
    const [showAuthModal, setShowAuthModal] = useState(false);

    const userInitial =
        (profile?.username && profile.username[0]?.toUpperCase()) ||
        (user?.email && user.email[0]?.toUpperCase()) ||
        'U';

    return (
        <>
            {/* Center pill header */}
            <header className="fixed top-4 left-1/2 -translate-x-1/2 z-40 w-1/3">
                <div className="flex items-center gap-4 px-5 py-3 bg-c2c-base backdrop-blur border border-c2c-orange/20 shadow-xl rounded-full">
                    {/* Logo */}
                    <div className="flex  justify-center items-center gap-2">
                        <Image
                            src="/assets/c2c-icon.png"
                            alt="C2C"
                            width={32}
                            height={32}
                            className="w-8 h-8"
                            unoptimized
                            priority
                        />

                    </div>

                    {/* Search bar with icon button */}
                    <div className="flex-1  justify-center items-center">
                        <div className="relative flex justify-center items-center">

                            <input
                                type="text"
                                placeholder="Search cafes"
                                className="w-full pl-9 pr-12 py-2 bg-transparent rounded-full font-bold text-c2c-orange placeholder-c2c-orange focus:outline-none focus:ring-2 focus:ring-c2c-orange"
                            />
                            <button
                                type="button"
                                className="p-2 rounded-full bg-transparent text-c2c-orange font-bold hover:bg-c2c-base transition-colors"
                                aria-label="Search"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-4 w-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Top-right auth control */}
            <div className="fixed top-8 right-16 z-50">
                {user && profile ? (
                    <button
                        onClick={signOut}
                        className="w-10 h-10 rounded-full bg-c2c-orange text-white flex items-center justify-center text-sm font-semibold shadow-md hover:bg-c2c-orange-dark transition-colors"
                        title={`Signed in as @${profile.username}. Click to sign out.`}
                    >
                        {userInitial}
                    </button>
                ) : (
                    <button
                        onClick={() => setShowAuthModal(true)}
                        className="px-4 py-2 text-sm bg-c2c-orange hover:bg-c2c-orange-dark text-white rounded-full shadow-md transition-colors"
                    >
                        Sign In
                    </button>
                )}
            </div>

            <AuthModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
            />
        </>
    );
}

