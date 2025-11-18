import { useState, useRef } from 'react';
import { X, Upload, User } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';
import { resizeImageOnClient } from '../../utils/imageResize';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  accessToken: string | null;
  currentDisplayName?: string;
  currentEmail?: string;
  currentAvatarUrl?: string;
  onProfileUpdated: () => void;
  onTokenRefresh?: (newToken: string) => Promise<void>; // Функция для обновления токена в App.tsx
}

export function ProfileModal({
  isOpen,
  onClose,
  accessToken,
  currentDisplayName,
  currentEmail,
  currentAvatarUrl,
  onProfileUpdated,
  onTokenRefresh
}: ProfileModalProps) {
  const [displayName, setDisplayName] = useState(currentDisplayName || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(currentAvatarUrl);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Проверка размера (макс 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Размер файла не должен превышать 5MB');
      return;
    }

    // Проверка типа
    if (!file.type.startsWith('image/')) {
      toast.error('Можно загружать только изображения');
      return;
    }

    try {
      // 🎨 Клиентское сжатие до 200px по меньшей стороне
      console.log('🖼️ Сжатие изображения на клиенте...');
      const resizedFile = await resizeImageOnClient(file);
      
      setAvatarFile(resizedFile);

      // Создать preview из сжатого файла
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(resizedFile);
      
      // Логи в консоли - toast убрали чтобы не отвлекать пользователя
      console.log('✅ Изображение готово к загрузке');
    } catch (error: any) {
      console.error('❌ Ошибка обработки изображения:', error);
      toast.error('Ошибка обработки изображения');
    }
  };

  const handleSave = async () => {
    if (!accessToken) {
      toast.error('Ошибка авторизации');
      return;
    }

    const hasChanges = displayName !== (currentDisplayName || '') || avatarFile !== null;
    
    if (!hasChanges) {
      toast.info('Нет изменений для сохранения');
      onClose();
      return;
    }

    setIsSaving(true);

    try {
      console.log('💾 Сохранение профиля...');

      // 1. Загрузить аватар если есть
      let avatarUrl = currentAvatarUrl;
      
      if (avatarFile) {
        console.log('📤 Загрузка аватара на сервер...');
        
        const formData = new FormData();
        formData.append('avatar', avatarFile);

        const uploadResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-73d66528/profile/upload-avatar`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`
            },
            body: formData
          }
        );

        if (!uploadResponse.ok) {
          const error = await uploadResponse.json();
          throw new Error(error.error || 'Ошибка загрузки аватара');
        }

        const uploadData = await uploadResponse.json();
        avatarUrl = uploadData.avatar_url;
        console.log('✅ Аватар загружен:', avatarUrl);
      }

      // 2. Обновить профиль
      console.log('💾 Обновление профиля на сервере...');
      
      const updateResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-73d66528/profile/update`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            display_name: displayName.trim() || undefined,
            avatar_url: avatarUrl || undefined
          })
        }
      );

      if (!updateResponse.ok) {
        const error = await updateResponse.json();
        throw new Error(error.error || 'Ошибка обновления профиля');
      }

      const updateData = await updateResponse.json();
      console.log('✅ Профиль успешно обновлён');
      
      // ВАЖНО: После обновления user_metadata нужно получить свежий токен
      // чтобы OnlineUsers увидел обновленный avatarUrl
      if (onTokenRefresh) {
        console.log('🔄 Обновление токена для получения свежих user_metadata...');
        
        try {
          // Получаем session_id из IndexedDB
          const { getStorageItem } = await import('../../utils/storage');
          const storedSessionId = await getStorageItem('auth_session_id');
          
          if (!storedSessionId) {
            console.warn('⚠️ Session ID не найден - перезагрузка страницы');
            toast.success('Профиль обновлён! Страница будет перезагружена...', { duration: 2000 });
            setTimeout(() => window.location.reload(), 2000);
            return;
          }
          
          console.log('🔑 Session ID найден, запрос новой сессии...');
          
          // Запросить новую сессию с обновленными user_metadata
          const sessionResponse = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-73d66528/auth/session`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${publicAnonKey}`
              },
              body: JSON.stringify({ 
                session_id: storedSessionId,
                force_refresh: true  // ← КРИТИЧНО! Принудительное обновление для получения свежих user_metadata с avatar_url
              })
            }
          );
          
          if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json();
            if (sessionData.session?.access_token) {
              console.log('✅ Новый токен получен с обновленными user_metadata');
              
              // Обновить токен в App.tsx через callback
              await onTokenRefresh(sessionData.session.access_token);
              
              toast.success('Профиль обновлён!');
              
              // Закрыть модалку и обновить данные
              onClose();
              onProfileUpdated();
            } else {
              console.warn('⚠️ Сервер не вернул токен - перезагрузка');
              toast.success('Профиль обновлён! Страница будет перезагружена...', { duration: 2000 });
              setTimeout(() => window.location.reload(), 2000);
            }
          } else {
            console.warn('⚠️ Ошибка получения сессии - перезагрузка');
            toast.success('Профиль обновлён! Страница будет перезагружена...', { duration: 2000 });
            setTimeout(() => window.location.reload(), 2000);
          }
        } catch (refreshError: any) {
          console.error('❌ Ошибка обновления токена:', refreshError);
          toast.success('Профиль обновлён! Страница будет перезагружена...', { duration: 2000 });
          setTimeout(() => window.location.reload(), 2000);
        }
      } else {
        // Fallback - перезагрузка страницы
        toast.success('Профиль обновлён! Страница будет перезагружена через 2 секунды...', {
          duration: 2000
        });
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch (error: any) {
      console.error('❌ Ошибка сохранения профиля:', error);
      toast.error(error.message || 'Ошибка сохранения профиля');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    const hasChanges = displayName !== (currentDisplayName || '') || avatarFile !== null;
    
    if (hasChanges) {
      if (!confirm('У вас есть несохранённые изменения. Закрыть без сохранения?')) {
        return;
      }
    }
    
    onClose();
  };

  // Получаем инициалы
  const getInitials = () => {
    if (displayName) {
      const parts = displayName.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return displayName.substring(0, 2).toUpperCase();
    }
    if (currentEmail) {
      return currentEmail.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  return (
    <div className="fixed inset-0 bg-[rgba(0,0,0,0.5)] bg-opacity-50 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl">Редактировать профиль</h2>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCancel();
            }}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
              >
                {avatarPreview ? (
                  <img 
                    src={avatarPreview} 
                    alt="Avatar preview" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white text-2xl font-semibold">
                    {getInitials()}
                  </span>
                )}
              </div>
              
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors border-2 border-gray-200"
              >
                <Upload className="w-4 h-4 text-gray-600" />
              </button>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarSelect}
                className="hidden"
              />
            </div>
            
            <p className="text-sm text-gray-500 text-center">
              Нажмите на аватарку для загрузки фото<br />
              <span className="text-xs text-gray-400">(макс. 5MB, автоматически оптимизируется)</span>
            </p>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm mb-2 text-gray-700">
              Отображаемое имя
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Введите ваше имя"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="block text-sm mb-2 text-gray-700">
              Email
            </label>
            <input
              type="email"
              value={currentEmail || ''}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">
              Email нельзя изменить
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              handleCancel();
            }}
            disabled={isSaving}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              handleSave();
            }}
            disabled={isSaving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            )}
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}
