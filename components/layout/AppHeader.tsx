'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthModal } from '@/components/auth/AuthModal';
import { ProfileModal } from './ProfileModal';
import { FilterModal } from '@/components/ui/FilterModal';
import { useAuth } from '@/lib/auth/AuthContext';
import { useAppStore } from '@/lib/store/AppStore';
import { Filter, Plus } from 'lucide-react';

export function AppHeader() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, profile, signOut } = useAuth();
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const { state, setSearchQuery, onSearch, setPanelCollapsed, setSearchFilters, setAddCafeMode } = useAppStore();
    const { searchQuery, activeSearchQuery, isPanelCollapsed, searchFilters, isAddCafeMode } = state;

    // Consider it "searching" if there's an active search query
    const isSearching = !!activeSearchQuery;

    const userInitial =
        (profile?.username && profile.username[0]?.toUpperCase()) ||
        (user?.email && user.email[0]?.toUpperCase()) ||
        'U';

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim() && !isSearching) {
            // Open sidebar when searching from top bar
            setPanelCollapsed(false);
            onSearch(searchQuery.trim());
        }
    };

    const handleSearchClick = () => {
        if (searchQuery.trim() && !isSearching) {
            // Open sidebar when searching from top bar
            setPanelCollapsed(false);
            onSearch(searchQuery.trim());
        }
    };

    // Hide header on onboarding page
    if (pathname === '/onboarding') {
        return null;
    }

    return (
        <>
            {/* Center pill header - Only show when sidebar is collapsed and NOT in add cafe mode */}
            <AnimatePresence>
                {isPanelCollapsed && !isAddCafeMode && (
                    <motion.header
                        initial={{ opacity: 0, y: -20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.9 }}
                        transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 30,
                            mass: 0.8
                        }}
                        className="fixed top-4 left-1/3 z-40 w-1/3"
                    >
                        <div className="flex justify-center items-center gap-4 px-5 py-3 bg-c2c-base backdrop-blur border border-c2c-orange/20 shadow-xl rounded-full">
                            {/* Logo */}
                            <div className="flex justify-center items-center gap-2">
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
                            <motion.div
                                initial={{ width: 0, opacity: 0 }}
                                animate={{ width: "100%", opacity: 1 }}
                                exit={{ width: 0, opacity: 0 }}
                                transition={{
                                    type: "spring",
                                    stiffness: 350,
                                    damping: 28,
                                    delay: 0.05
                                }}
                            >
                                <form onSubmit={handleSearchSubmit} className="flex justify-center items-center w-full relative">
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
                                        className="w-full px-3 py-2 pr-20 bg-transparent rounded-full font-bold text-c2c-orange placeholder-c2c-orange focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                    {/* Filter button - show when searching */}
                                    {isSearching && (
                                        <button
                                            type="button"
                                            onClick={() => setShowFilterModal(true)}
                                            className="absolute right-10 p-2 rounded-full bg-c2c-orange/10 hover:bg-c2c-orange/20 border border-c2c-orange/30 hover:border-c2c-orange text-c2c-orange transition-colors"
                                            aria-label="Filter"
                                            title="Filter results"
                                        >
                                            <Filter className="h-4 w-4" />
                                        </button>
                                    )}
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
                            </motion.div>
                        </div>
                    </motion.header>
                )}
            </AnimatePresence>

            {/* Top-right controls */}
            <div className="fixed top-8 right-16 z-50 flex items-center gap-3">
                {/* Add Cafe button */}
                <button
                    onClick={() => {
                        setAddCafeMode(!isAddCafeMode);
                    }}
                    className={`w-10 h-10 rounded-full ${
                        isAddCafeMode
                            ? 'bg-gray-700 text-white'
                            : 'bg-c2c-orange text-white hover:bg-c2c-orange-dark'
                    } flex items-center justify-center shadow-md transition-colors`}
                    title={isAddCafeMode ? 'Cancel adding cafe' : 'Add a new cafe'}
                >
                    <Plus className={`h-5 w-5 ${isAddCafeMode ? 'rotate-45' : ''} transition-transform`} />
                </button>
                
                {/* Auth control */}
                {user && profile ? (
                    <button
                        onClick={() => setShowProfileModal(true)}
                        className="w-10 h-10 rounded-full bg-c2c-orange text-white flex items-center justify-center text-sm font-semibold shadow-md hover:bg-c2c-orange-dark transition-colors"
                        title={`Signed in as @${profile.username}. Click to view profile options.`}
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

            <ProfileModal
                isOpen={showProfileModal}
                onClose={() => setShowProfileModal(false)}
                onChangeVibe={() => {
                    setShowProfileModal(false);
                    router.push('/onboarding?edit=true');
                }}
                onSignOut={signOut}
            />

            <FilterModal
                isOpen={showFilterModal}
                onClose={() => setShowFilterModal(false)}
                filters={searchFilters}
                onFiltersChange={setSearchFilters}
                onApply={() => {
                    // Trigger search refresh by updating active search query
                    if (activeSearchQuery) {
                        onSearch(activeSearchQuery);
                    }
                }}
            />
        </>
    );
}

