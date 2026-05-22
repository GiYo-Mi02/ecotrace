// stores/HealthContext.tsx

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { UserPreferences } from '@/types/userPreferences';
import { DEFAULT_PREFERENCES } from '@/types/userPreferences';
import { loadUserPreferences, saveUserPreferences } from '@/services/storage';

interface HealthContextType {
  preferences: UserPreferences;
  isLoading: boolean;
  updatePreferences: (partial: Partial<UserPreferences>) => void;
  resetPreferences: () => void;
}

const HealthContext = createContext<HealthContextType | undefined>(undefined);

export function HealthProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUserPreferences().then(prefs => {
      setPreferences(prefs);
      setIsLoading(false);
    });
  }, []);

  const updatePreferences = useCallback((partial: Partial<UserPreferences>) => {
    setPreferences(prev => {
      const updated = { ...prev, ...partial };
      saveUserPreferences(updated);
      return updated;
    });
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
    saveUserPreferences(DEFAULT_PREFERENCES);
  }, []);

  return (
    <HealthContext.Provider value={{ preferences, isLoading, updatePreferences, resetPreferences }}>
      {children}
    </HealthContext.Provider>
  );
}

export function useHealth() {
  const context = useContext(HealthContext);
  if (!context) throw new Error('useHealth must be used within HealthProvider');
  return context;
}
