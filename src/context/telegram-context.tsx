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

    // Приоритет 1: Telegram WebApp (обычный запуск)
    if (tg?.initDataUnsafe?.user) {
      tg.ready();

      const rawUser = tg.initDataUnsafe.user;
      const displayName =
        rawUser.username ||
        [rawUser.first_name, rawUser.last_name].filter(Boolean).join(' ') ||
        'Аноним';

      setState({
        user: { ...rawUser, displayName },
        initData: tg.initData,
        isLoading: false,
      });
      return;
    }

    // Приоритет 2: URL параметры (режим iframe из Moraleon)
    const params = new URLSearchParams(window.location.search);
    const telegramId = params.get('telegramId');
    const username = params.get('username');
    const firstName = params.get('firstName');

    if (telegramId) {
      const displayName = username || firstName || 'Аноним';
      setState({
        user: {
          id: Number(telegramId),
          username: username ?? undefined,
          first_name: firstName ?? undefined,
          displayName,
        },
        // В iframe режиме initData недоступен — передаём telegramId напрямую
        initData: null,
        isLoading: false,
      });
      return;
    }

    // Ничего не найдено
    console.warn('Telegram WebApp not available and no URL params provided.');
    setState({ user: null, initData: null, isLoading: false });
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
