'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface SidebarContextType {
  isPanelCollapsed: boolean;
  setIsPanelCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  // Initialize from localStorage if available
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('mapState');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          return parsed.isPanelCollapsed ?? false;
        } catch {
          return false;
        }
      }
    }
    return false;
  });

  return (
    <SidebarContext.Provider value={{ isPanelCollapsed, setIsPanelCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within SidebarProvider');
  }
  return context;
}
