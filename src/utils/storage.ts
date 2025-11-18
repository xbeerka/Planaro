/**
 * Storage utilities that work in iframe environments (including Figma Make)
 * Uses IndexedDB as it's more reliable than localStorage/cookies in cross-origin iframes
 */

const DB_NAME = 'planaro_storage';
const DB_VERSION = 1;
const STORE_NAME = 'app_data';

// Open IndexedDB database
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

// Get value from IndexedDB
export async function getStorageItem(key: string): Promise<string | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result ?? null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('IndexedDB getItem error:', error);
    return null;
  }
}

// Set value in IndexedDB
export async function setStorageItem(key: string, value: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(value, key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('IndexedDB setItem error:', error);
    throw error;
  }
}

// Remove value from IndexedDB
export async function removeStorageItem(key: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('IndexedDB removeItem error:', error);
    throw error;
  }
}

// Store JSON object in IndexedDB
export async function setStorageJSON<T>(key: string, value: T): Promise<void> {
  try {
    const json = JSON.stringify(value);
    await setStorageItem(key, json);
  } catch (error) {
    console.error('IndexedDB setStorageJSON error:', error);
    throw error;
  }
}

// Get JSON object from IndexedDB
export async function getStorageJSON<T>(key: string): Promise<T | null> {
  try {
    const json = await getStorageItem(key);
    if (!json) return null;
    return JSON.parse(json) as T;
  } catch (error) {
    console.error('IndexedDB getStorageJSON error:', error);
    return null;
  }
}

// Legacy: Cookie utilities (fallback, kept for backwards compatibility)
export function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

export function setCookie(name: string, value: string, days: number = 365) {
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value};${expires};path=/`;
}

export function removeCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}
