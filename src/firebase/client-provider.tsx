'use client';

import React, { useMemo, useEffect, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase, initiateAnonymousSignIn } from '@/firebase';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

/**
 * Провайдер, который инициализирует Firebase на клиенте и обеспечивает 
 * автоматическую анонимную авторизацию для гостевых сессий.
 */
export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const firebaseServices = useMemo(() => {
    // Инициализация сервисов Firebase
    return initializeFirebase();
  }, []);

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
    >
      <AuthSessionEnforcer auth={firebaseServices.auth}>
        {children}
      </AuthSessionEnforcer>
    </FirebaseProvider>
  );
}

/**
 * Внутренний компонент для принудительной анонимной авторизации, 
 * если пользователь не вошел в систему.
 */
function AuthSessionEnforcer({ auth, children }: { auth: any, children: ReactNode }) {
  useEffect(() => {
    // Подписываемся на изменения состояния авторизации
    const unsubscribe = auth.onAuthStateChanged((user: any) => {
      if (!user) {
        // Если пользователя нет, инициируем анонимный вход
        initiateAnonymousSignIn(auth);
      }
    });
    return () => unsubscribe();
  }, [auth]);

  return <>{children}</>;
}
