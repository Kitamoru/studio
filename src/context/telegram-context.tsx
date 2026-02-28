'use client';

import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  displayName: string;
}

interface TelegramContextState {
  user: TelegramUser | null;
  initData: string | null;
  isLoading: boolean;
}

const TelegramContext = createContext<TelegramContextState | undefined>(undefined);

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TelegramContextState>({
    user: null,
    initData: null,
    isLoading: true,
  });

  useEffect(() => {
    const tg = window.Telegram?.WebApp;

    if (!tg) {
      console.warn('Telegram WebApp not available. Are you running outside Telegram?');
      setState({ user: null, initData: null, isLoading: false });
      return;
    }

    tg.ready();

    const rawUser = tg.initDataUnsafe?.user;
    const initData = tg.initData;

    if (rawUser) {
      const displayName =
        rawUser.username ||
        [rawUser.first_name, rawUser.last_name].filter(Boolean).join(' ') ||
        'Аноним';

      setState({
        user: { ...rawUser, displayName },
        initData,
        isLoading: false,
      });
    } else {
      setState({ user: null, initData, isLoading: false });
    }
  }, []);

  return (
    <TelegramContext.Provider value={state}>
      {children}
    </TelegramContext.Provider>
  );
}

export function useTelegramUser(): TelegramContextState {
  const ctx = useContext(TelegramContext);
  if (!ctx) throw new Error('useTelegramUser must be used within TelegramProvider');
  return ctx;
}
