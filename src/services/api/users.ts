import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { getStorageItem } from '../../utils/storage';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-73d66528`;

export const usersApi = {
  /**
   * Загружает аватар пользователя в Supabase Storage
   * @param userId - ID пользователя (может быть временным для новых пользователей)
   * @param file - Файл изображения
   * @returns URL загруженного аватара
   */
  async uploadAvatar(userId: string, file: File): Promise<string> {
    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('userId', userId);

    const accessToken = await getStorageItem('auth_access_token');
    if (!accessToken) {
      console.error('❌ Токен доступа не найден в IndexedDB');
      throw new Error('Не авторизован');
    }

    console.log('📤 Загрузка аватара для пользователя:', userId);

    const response = await fetch(`${API_BASE}/users/upload-avatar`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Ошибка от сервера:', error);
      throw new Error(`Failed to upload avatar: ${error}`);
    }

    const data = await response.json();
    console.log('✅ Аватар успешно загружен:', data.avatarUrl);
    return data.avatarUrl;
  },

  /**
   * Переключает видимость пользователя (скрыть/показать)
   * @param userId - ID пользователя (с префиксом 'r')
   * @returns Обновленные данные видимости
   */
  async toggleVisibility(userId: string): Promise<{ id: string; visible: boolean }> {
    const accessToken = await getStorageItem('auth_access_token');
    if (!accessToken) {
      console.error('❌ Токен доступа не найден в IndexedDB');
      throw new Error('Не авторизован');
    }

    console.log('👁️ Переключение видимости пользователя:', userId);

    const response = await fetch(`${API_BASE}/resources/${userId}/visibility`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Ошибка от сервера:', error);
      throw new Error(`Failed to toggle visibility: ${error}`);
    }

    const data = await response.json();
    console.log('✅ Видимость пользователя обновлена:', data);
    return data;
  },

  /**
   * Массовое обновление пользователей
   * @param updates - Массив обновлений { id, ...changes }
   */
  async batchUpdate(updates: Array<{ id: string; [key: string]: any }>): Promise<void> {
    if (updates.length === 0) return;

    const accessToken = await getStorageItem('auth_access_token');
    if (!accessToken) {
      console.error('❌ Токен доступа не найден в IndexedDB');
      throw new Error('Не авторизован');
    }

    console.log(`📤 Отправка пакета обновлений (${updates.length} пользователей)...`);

    const response = await fetch(`${API_BASE}/resources/batch`, {
      method: 'POST', // or PUT
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ updates }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Ошибка пакетного обновления:', error);
      throw new Error(`Failed to batch update users: ${error}`);
    }

    const result = await response.json();
    console.log('✅ Пакетное обновление успешно:', result);
    return result;
  },
};