import crypto from 'crypto';
import { TelegramUser } from './types';

/**
 * Проверяет валидность Telegram initData
 * @param initData Строка initData из Telegram WebApp
 * @returns true если данные валидны, иначе false
 */
export const validateTelegramInitData = (initData: string): boolean => {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return false;
    params.delete('hash');

    // Проверка срока действия данных (не старше 1 часа)
    const authDate = params.get('auth_date');
    if (authDate) {
      const authTime = parseInt(authDate) * 1000;
      const now = Date.now();
      if (now - authTime > 3600000) {
        return false;
      }
    }

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(process.env.TOKEN!)
      .digest();

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    return hash === calculatedHash;
  } catch (err) {
    console.error('Telegram init data validation error:', err);
    return false;
  }
};

/**
 * Извлекает данные пользователя из initData
 * @param initData Строка initData из Telegram WebApp
 * @returns Объект пользователя или null
 */
export const extractTelegramUser = (initData: string): TelegramUser | null => {
  try {
    const params = new URLSearchParams(initData);
    const userJson = params.get('user');
    return userJson ? JSON.parse(userJson) : null;
  } catch (error) {
    console.error('Failed to extract Telegram user:', error);
    return null;
  }
};
