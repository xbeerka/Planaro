import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Upload,
  User,
  Loader2,
  Camera,
  Pencil,
} from "lucide-react";
import {
  updateProfile,
  uploadAvatar,
} from "../../services/api/profile";
import { useToast } from "../ui/ToastContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { resizeImageOnClient } from "../../utils/imageResize";
import {
  projectId,
  publicAnonKey,
} from "../../utils/supabase/info";
import { getStorageItem } from "../../utils/storage";

const getUserInitials = (
  displayName?: string,
  email?: string,
) => {
  if (displayName) {
    const parts = displayName.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    } else if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
  }
  if (email) {
    return email.substring(0, 2).toUpperCase();
  }
  return "??";
};

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  accessToken?: string | null;
  currentDisplayName?: string;
  currentEmail?: string;
  currentAvatarUrl?: string;
  onTokenRefresh: (newToken: string) => Promise<void>;
  onProfileUpdated: () => void;
}

export function ProfileModal({
  isOpen,
  onClose,
  accessToken,
  currentDisplayName,
  currentEmail,
  currentAvatarUrl,
  onTokenRefresh,
  onProfileUpdated,
}: ProfileModalProps) {
  const [displayName, setDisplayName] = useState(
    currentDisplayName || "",
  );
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  // Local preview state
  const [avatarPreview, setAvatarPreview] = useState<
    string | null
  >(currentAvatarUrl || null);
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<
    string | null
  >(null);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setDisplayName(currentDisplayName || "");
      setAvatarPreview(currentAvatarUrl || null);
      setUploadedAvatarUrl(null);
    }
  }, [isOpen, currentDisplayName, currentAvatarUrl]);

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith("image/")) {
      showToast({
        type: "error",
        message: "Ошибка",
        description: "Пожалуйста, выберите изображение",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      // 5MB
      showToast({
        type: "error",
        message: "Ошибка",
        description: "Размер файла не должен превышать 5MB",
      });
      return;
    }

    setIsUploading(true);
    try {
      // Client-side resize
      console.log("🖼️ Сжатие изображения на клиенте...");
      const resizedFile = await resizeImageOnClient(file);

      // Show preview
      const objectUrl = URL.createObjectURL(resizedFile);
      setAvatarPreview(objectUrl);

      // Upload immediately
      const url = await uploadAvatar(resizedFile);
      setUploadedAvatarUrl(url);

      // Убрали toast "Успешно" по просьбе пользователя
      console.log("✅ Аватар загружен:", url);
    } catch (error) {
      console.error("Upload failed:", error);
      showToast({
        type: "error",
        message: "Ошибка загрузки",
        description: "Не удалось загрузить аватар",
      });
      // Revert preview
      setAvatarPreview(currentAvatarUrl || null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("💾 Saving profile...");
    setIsSaving(true);

    try {
      const payload: {
        display_name?: string;
        avatar_url?: string;
      } = {};
      let hasChanges = false;

      // Нормализуем значения для сравнения (undefined -> '')
      const normalizedCurrentDisplayName =
        currentDisplayName || "";
      const normalizedDisplayName = displayName || "";

      if (
        normalizedDisplayName !== normalizedCurrentDisplayName
      ) {
        payload.display_name = normalizedDisplayName;
        hasChanges = true;
      }

      if (uploadedAvatarUrl) {
        payload.avatar_url = uploadedAvatarUrl;
        hasChanges = true;
      }

      console.log(
        "📝 Payload:",
        payload,
        "Has changes:",
        hasChanges,
      );

      if (!hasChanges) {
        console.log("🚫 No changes detected, closing");
        onClose();
        return;
      }

      await updateProfile(payload);
      console.log("✅ Profile updated on server");

      // Force refresh token to get new metadata
      if (onTokenRefresh) {
        console.log(
          "🔄 Обновление токена для получения свежих user_metadata...",
        );

        try {
          const storedSessionId = await getStorageItem(
            "auth_session_id",
          );

          if (!storedSessionId) {
            console.warn(
              "⚠️ Session ID не найден - перезагрузка страницы",
            );
            showToast({
              type: "success",
              message: "Профиль обновлен",
              description: "Страница будет перезагружена...",
            });
            setTimeout(() => window.location.reload(), 2000);
            return;
          }

          console.log(
            "🔑 Session ID найден, запрос новой сессии...",
          );

          // Запросить новую сессию с обновленными user_metadata
          const sessionResponse = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-73d66528/auth/session`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${publicAnonKey}`,
              },
              body: JSON.stringify({
                session_id: storedSessionId,
                force_refresh: true,
              }),
            },
          );

          if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json();
            if (sessionData.session?.access_token) {
              console.log(
                "✅ Новый токен получен с обновленными user_metadata",
              );

              await onTokenRefresh(
                sessionData.session.access_token,
              );

              showToast({
                type: "success",
                message: "Профиль обновлен",
                description: "Изменения сохранены успешно",
              });

              onProfileUpdated();
              onClose();
            } else {
              throw new Error("No access token in response");
            }
          } else {
            throw new Error("Session refresh failed");
          }
        } catch (refreshError) {
          console.error(
            "❌ Ошибка обновления токена:",
            refreshError,
          );
          showToast({
            type: "success",
            message: "Профиль обновлен",
            description: "Страница будет перезагружена...",
          });
          setTimeout(() => window.location.reload(), 2000);
        }
      } else {
        // Fallback
        showToast({
          type: "success",
          message: "Профиль обновлен",
          description: "Страница будет перезагружена...",
        });
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch (error) {
      console.error("Update profile failed:", error);
      showToast({
        type: "error",
        message: "Ошибка",
        description: "Не удалось сохранить профиль",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Редактировать профиль</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 py-4"
        >
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-4">
            <div
              className="relative group cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-24 h-24 rounded-[20px] overflow-hidden bg-gray-100 border-2 border-gray-200 relative">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#f6f6f6] text-[#868789] text-3xl font-medium">
                    {getUserInitials(displayName, currentEmail)}
                  </div>
                )}

                {/* Overlay */}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-8 h-8 text-white" />
                </div>

                {isUploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  </div>
                )}
              </div>
              <div className="absolute bottom-0 right-0 bg-blue-600 text-white p-1.5 rounded-full border-2 border-white shadow-sm">
                <Pencil className="w-3 h-3" />
              </div>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
              disabled={isUploading}
            />

            <p className="text-xs text-gray-500">
              Нажмите на фото, чтобы изменить
            </p>
          </div>

          {/* Fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={currentEmail || ""}
                disabled
                className="bg-gray-50 text-gray-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">Имя и Фамилия</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ваше имя"
              />
              <p className="text-xs text-gray-500">
                Это имя будут видеть другие пользователи
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              type="button"
              onClick={onClose}
              disabled={isSaving}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={isSaving || isUploading}
            >
              {isSaving && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Сохранить
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}