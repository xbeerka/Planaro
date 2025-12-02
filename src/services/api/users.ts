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
};