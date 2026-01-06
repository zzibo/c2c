'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { AuthModal } from '@/components/auth/AuthModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSearch } from '@/lib/search/SearchContext';

export function AppHeader() {
    const pathname = usePathname();
    const { user, profile, signOut } = useAuth();
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
    const { searchQuery, setSearchQuery, onSearch, isSearching } = useSearch();

    const userInitial =
        (profile?.username && profile.username[0]?.toUpperCase()) ||
        (user?.email && user.email[0]?.toUpperCase()) ||
        'U';

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim() && !isSearching) {
            onSearch(searchQuery.trim());
        }
    };

    const handleSearchClick = () => {
        if (searchQuery.trim() && !isSearching) {
            onSearch(searchQuery.trim());
        }
    };

    // Hide header on onboarding page
    if (pathname === '/onboarding') {
        return null;
    }

    return (
        <>
            {/* Center pill header */}
            <header className="fixed top-4 left-1/2 -translate-x-1/2 z-40 w-1/3">
                <div className="flex items-center gap-4 px-5 py-3 bg-c2c-base backdrop-blur border border-c2c-orange/20 shadow-xl rounded-full">
                    {/* Logo */}
                    <div className="flex  justify-center items-center gap-2">
                        <Image
                            src="/assets/c2c-icon.webp"
                            alt="C2C"
                            width={32}
                            height={32}
                            className="w-8 h-8"
                            unoptimized
                            priority
                            fetchPriority="high"
                        />

                    </div>

                    {/* Search bar with icon button */}
                    <div className="flex-1  justify-center items-center">
                        <form onSubmit={handleSearchSubmit} className="relative flex justify-center items-center w-full">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSearchSubmit(e as unknown as React.FormEvent);
                                    }
                                }}
                                placeholder="Search cafes"
                                disabled={isSearching}
                                className="w-full pl-9 pr-12 py-2 bg-transparent rounded-full font-bold text-c2c-orange placeholder-c2c-orange focus:outline-none focus:ring-2 focus:ring-c2c-orange disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                                                      {/* Right submit button */}
                            <button
                                type="submit"
                                onClick={handleSearchClick}
                                disabled={isSearching || !searchQuery.trim()}
                                className="absolute right-2 p-2 rounded-full bg-transparent text-c2c-orange font-bold hover:bg-c2c-orange/20 hover:border hover:border-c2c-orange transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label="Search"
                            >
                                {isSearching ? (
                                    <svg
                                        className="animate-spin h-4 w-4"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        className="h-4 w-4"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </header>

            {/* Top-right auth control */}
            <div className="fixed top-8 right-16 z-50">
                {user && profile ? (
                    <button
                        onClick={() => setShowSignOutConfirm(true)}
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

            <ConfirmModal
                isOpen={showSignOutConfirm}
                onClose={() => setShowSignOutConfirm(false)}
                onConfirm={signOut}
                title="Sign Out"
                message={`Are you sure you want to sign out? You'll need to sign in again to access your account.`}
                confirmText="Sign Out"
                cancelText="Cancel"
                confirmVariant="danger"
            />
        </>
    );
}

