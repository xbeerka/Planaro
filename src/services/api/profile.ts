import { apiRequest } from './base';
import { Profile } from '../../types/scheduler';

export interface UpdateProfilePayload {
  display_name?: string;
  avatar_url?: string;
}

export interface UploadAvatarResponse {
  avatarUrl: string;
}

// Ensure profile exists after login
export async function ensureProfile(token?: string): Promise<Profile> {
  return apiRequest<Profile>('/profile/ensure', {
    method: 'POST',
    body: {},
    token
  });
}

// Get current user profile
export async function getProfile(token?: string): Promise<Profile> {
  return apiRequest<Profile>('/profile', {
    method: 'GET',
    token
  });
}

export async function uploadAvatar(file: File): Promise<string> {
  // Create FormData
  const formData = new FormData();
  formData.append('avatar', file);

  // We need to handle multipart/form-data differently because apiRequest assumes JSON
  // So we'll implement a custom fetch here reusing the base URL logic if possible, 
  // or just use apiRequest but we need to handle content-type.
  // Actually, apiRequest sets Content-Type: application/json if body is present.
  // So we might need a specialized function or modify apiRequest. 
  // However, for simplicity and to follow patterns, let's check if we can use apiRequest.
  
  // apiRequest implementation:
  // if (body) { headers['Content-Type'] = 'application/json'; }
  // This prevents sending FormData correctly (browser should set Content-Type with boundary).
  
  // So we will use a custom implementation for this specific endpoint.
  const { projectId } = await import('../../utils/supabase/info');
  const { getStorageItem } = await import('../../utils/storage');
  
  const accessToken = await getStorageItem('auth_access_token');
  if (!accessToken) {
    throw new Error('Требуется авторизация');
  }

  const response = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-73d66528/profile/upload-avatar`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        // Do NOT set Content-Type, browser sets it for FormData
      },
      body: formData
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload avatar: ${errorText}`);
  }

  const data = await response.json();
  console.log('📦 Ответ сервера upload-avatar:', data);
  return data.avatarUrl || data.avatar_url; // Support both cases for robustness
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<void> {
  return apiRequest<void>('/profile/update', {
    method: 'POST',
    body: payload
  });
}