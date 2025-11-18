/**
 * Presence Context для Collaborative Cursors
 * 
 * Использует Supabase Realtime Broadcast для синхронизации курсоров
 * между пользователями в реальном времени
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { getSupabaseClient, isSupabaseRealtimeAvailable } from '../utils/supabase/client';
import { getDisplayNameFromToken, getEmailFromToken, getUserIdFromToken } from '../utils/jwt';
import { decodeSupabaseJWT } from '../utils/jwt';

interface CursorPosition {
  x: number;
  y: number;
  displayName: string;
  email: string;
  avatarUrl?: string;
  color: string;
  userId: string;
  timestamp: number;
}

interface PresenceContextType {
  cursors: Map<string, CursorPosition>;
  isConnected: boolean;
  isAvailable: boolean;
  updateCursor: (x: number, y: number) => void;
}

const PresenceContext = createContext<PresenceContextType | null>(null);

export function usePresence() {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error('usePresence must be used within PresenceProvider');
  }
  return context;
}

interface PresenceProviderProps {
  children: React.ReactNode;
  accessToken: string | null;
  workspaceId: number | null;
}

export function PresenceProvider({ children, accessToken, workspaceId }: PresenceProviderProps) {
  const [cursors, setCursors] = useState<Map<string, CursorPosition>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  
  const channelRef = useRef<any>(null);
  const supabaseRef = useRef<any>(null);
  const currentUserEmailRef = useRef<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const lastSentRef = useRef<{ x: number; y: number; timestamp: number }>({ x: 0, y: 0, timestamp: 0 });
  const cleanupTimeoutRef = useRef<number | null>(null);

  // Throttle для отправки координат (50ms)
  const THROTTLE_MS = 50;
  
  // Таймаут для удаления неактивных курсоров (5 секунд)
  const CURSOR_TIMEOUT_MS = 5000;

  // Генерация цвета для пользователя
  const getUserColor = useCallback((email: string): string => {
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
      hash = email.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 50%)`;
  }, []);

  // Обновление позиции курсора (throttled)
  const updateCursor = useCallback((x: number, y: number) => {
    if (!channelRef.current || !isConnected) {
      return;
    }

    const now = Date.now();
    const lastSent = lastSentRef.current;

    // Throttle
    if (now - lastSent.timestamp < THROTTLE_MS) {
      return;
    }

    lastSentRef.current = { x, y, timestamp: now };

    const payload = {
      type: 'cursor_update',
      user_id: currentUserIdRef.current,
      email: currentUserEmailRef.current,
      x,
      y,
      timestamp: now,
    };

    channelRef.current.send({
      type: 'broadcast',
      event: 'presence_update',
      payload,
    });
  }, [isConnected]);

  // Подключение к Realtime каналу
  useEffect(() => {
    if (!accessToken || !workspaceId) {
      return;
    }

    let mounted = true;
    let channel: any = null;

    async function connect() {
      try {
        // Проверяем доступность Realtime
        const available = await isSupabaseRealtimeAvailable();
        if (!mounted) return;
        
        setIsAvailable(available);
        
        if (!available) {
          console.warn('⚠️ Supabase Realtime недоступен - курсоры отключены');
          return;
        }

        const supabase = await getSupabaseClient();
        if (!mounted || !supabase) {
          console.warn('⚠️ Supabase клиент не инициализирован - курсоры отключены');
          setIsAvailable(false);
          return;
        }
        
        supabaseRef.current = supabase;

        // Получаем данные пользователя
        const payload = decodeSupabaseJWT(accessToken);
        const email = getEmailFromToken(accessToken);
        const displayName = getDisplayNameFromToken(accessToken);
        const userId = getUserIdFromToken(accessToken);
        const avatarUrl = payload?.user_metadata?.avatar_url;

        currentUserEmailRef.current = email;
        currentUserIdRef.current = userId;

        console.log('🖱️ Подключение к Realtime Presence для workspace:', workspaceId);
        console.log('👤 Пользователь:', displayName, email);

        // Создаём приватный канал
        const channelName = `workspace:${workspaceId}:presence`;
        channel = supabase.channel(channelName, {
          config: {
            presence: {
              key: userId, // Уникальный ключ пользователя
            },
          },
        });

        channelRef.current = channel;

        // Подписка на broadcast сообщения
        channel
          .on('broadcast', { event: 'presence_update' }, ({ payload }: any) => {
            // Не показываем свой курсор
            if (payload.email === email) {
              return;
            }

            // Обновляем курсор
            setCursors((prev) => {
              const next = new Map(prev);
              next.set(payload.user_id, {
                x: payload.x,
                y: payload.y,
                displayName: payload.displayName || payload.email,
                email: payload.email,
                avatarUrl: payload.avatarUrl,
                color: getUserColor(payload.email),
                userId: payload.user_id,
                timestamp: payload.timestamp,
              });
              return next;
            });
          })
          .on('presence', { event: 'join' }, ({ key, newPresences }: any) => {
            console.log('👋 Пользователь присоединился:', key, newPresences);
          })
          .on('presence', { event: 'leave' }, ({ key, leftPresences }: any) => {
            console.log('👋 Пользователь покинул канал:', key, leftPresences);
            // Удаляем курсор
            setCursors((prev) => {
              const next = new Map(prev);
              next.delete(key);
              return next;
            });
          })
          .subscribe(async (status: string) => {
            console.log('📡 Realtime статус:', status);
            if (status === 'SUBSCRIBED') {
              setIsConnected(true);
              console.log('✅ Подключено к Realtime Presence');

              // Отправляем join сообщение
              await channel.track({
                user_id: userId,
                email,
                displayName,
                avatarUrl,
                online_at: new Date().toISOString(),
              });
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              setIsConnected(false);
              console.error('❌ Ошибка подключения к Realtime:', status);
            }
          });
      } catch (error) {
        console.error('❌ Ошибка подключения к Presence:', error);
        setIsAvailable(false);
      }
    }

    connect();

    // Cleanup
    return () => {
      mounted = false;
      setIsConnected(false);

      if (channel) {
        console.log('🧹 Отключение от Realtime Presence');
        channel.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [accessToken, workspaceId, getUserColor]);

  // Периодическая очистка устаревших курсоров
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setCursors((prev) => {
        const next = new Map(prev);
        let hasChanges = false;

        next.forEach((cursor, userId) => {
          if (now - cursor.timestamp > CURSOR_TIMEOUT_MS) {
            next.delete(userId);
            hasChanges = true;
          }
        });

        return hasChanges ? next : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const value: PresenceContextType = {
    cursors,
    isConnected,
    isAvailable,
    updateCursor,
  };

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}
