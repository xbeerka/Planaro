import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { getStorageItem } from '../../utils/storage';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-73d66528`;

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  token?: string;
  requireAuth?: boolean; // Требуется ли авторизация пользователя
}

export async function apiRequest<T>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const { method = 'GET', body, token, requireAuth = true } = options;
  
  const headers: HeadersInit = {};
  
  // Если требуется авторизация, используем access_token пользователя
  if (requireAuth) {
    const accessToken = token || await getStorageItem('auth_access_token');
    if (!accessToken) {
      throw new Error('Требуется авторизация');
    }
    headers['Authorization'] = `Bearer ${accessToken}`;
  } else {
    // Для публичных эндпоинтов используем publicAnonKey
    headers['Authorization'] = `Bearer ${publicAnonKey}`;
  }
  
  if (body) {
    headers['Content-Type'] = 'application/json';
  }
  
  const url = `${BASE_URL}${endpoint}`;
  
  // console.log(`🌐 API Request: ${method} ${url}`, body ? { body } : '');
  
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    
    // console.log(`📡 API Response: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error ${response.status}:`, errorText);
      
      // If we get a 401, token is invalid - clear auth and reload
      if (response.status === 401 && requireAuth) {
        console.error('❌ Токен невалиден (401), очистка сессии...');
        const { removeStorageItem } = await import('../../utils/storage');
        await removeStorageItem('auth_access_token');
        await removeStorageItem('auth_session_id');
        await removeStorageItem('cache_workspaces_list');
        
        // Reload page to force re-authentication
        window.location.reload();
      }
      
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    // console.log(`✅ API Success:`, data);
    return data;
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      console.error('❌ Failed to fetch - возможные причины:');
      console.error('   1. Edge Function не развернут на Supabase');
      console.error('   2. Проблемы с сетью');
      console.error('   3. CORS проблема');
      console.error(`   URL: ${url}`);
      console.error(`   Project ID: ${projectId}`);
      console.error(`   Method: ${method}`);
      console.error(`   Headers:`, headers);
      if (body) console.error(`   Body:`, body);
      throw new Error(`Сервер недоступен. Edge Function не развернут или URL неверный: ${url}`);
    }
    console.error(`❌ API Request Failed:`, error);
    throw error;
  }
}

export async function apiRequestNoResponse(
  endpoint: string,
  options: ApiOptions = {}
): Promise<void> {
  const { method = 'GET', body, token, requireAuth = true } = options;
  
  const headers: HeadersInit = {};
  
  // Если требуется авторизация, используем access_token пользователя
  if (requireAuth) {
    const accessToken = token || await getStorageItem('auth_access_token');
    if (!accessToken) {
      throw new Error('Требуется авторизация');
    }
    headers['Authorization'] = `Bearer ${accessToken}`;
  } else {
    // Для публичных эндпоинтов используем publicAnonKey
    headers['Authorization'] = `Bearer ${publicAnonKey}`;
  }
  
  if (body) {
    headers['Content-Type'] = 'application/json';
  }
  
  const url = `${BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error ${response.status}:`, errorText);
      
      // If we get a 401, token is invalid - clear auth and reload
      if (response.status === 401 && requireAuth) {
        console.error('❌ Токен невалиден (401), очистка сессии...');
        const { removeStorageItem } = await import('../../utils/storage');
        await removeStorageItem('auth_access_token');
        await removeStorageItem('auth_session_id');
        await removeStorageItem('cache_workspaces_list');
        
        // Reload page to force re-authentication
        window.location.reload();
      }
      
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      console.error('❌ Failed to fetch - возможные причины:');
      console.error('   1. Edge Function не развернут на Supabase');
      console.error('   2. Проблемы с сетью');
      console.error('   3. CORS проблема');
      console.error(`   URL: ${url}`);
      console.error(`   Project ID: ${projectId}`);
      throw new Error(`Сервер недоступен. Edge Function не развернут или URL неверный: ${url}`);
    }
    throw error;
  }
}