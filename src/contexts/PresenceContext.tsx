import React, { createContext, useContext, useCallback, ReactNode, useState, useEffect, useRef, useMemo } from 'react';
import { supabaseClient, setSupabaseAuth } from '../utils/supabase/client';
import { getEmailFromToken, getDisplayNameFromToken, getUserIdFromToken, decodeSupabaseJWT } from '../utils/jwt';
import type { RealtimeChannel } from '@supabase/supabase-js';

// 🎨 Палитра HSL-оттенков для курсоров (hue values, насыщенные и контрастные)
const HUE_POOL = [0, 30, 60, 120, 180, 210, 240, 270, 300, 330];

/**
 * Генерирует HSL цвет, максимально отличающийся от уже занятых.
 * Если онлайн нет — рандомный hue. Если есть — выбирает максимально далёкий по hue.
 */
function pickContrastingColor(usedColors: string[]): string {
  const usedHues: number[] = [];
  for (const c of usedColors) {
    const m = c.match(/hsl\((\d+)/);
    if (m) usedHues.push(Number(m[1]));
  }

  if (usedHues.length === 0) {
    // Рандомный из пула
    const hue = HUE_POOL[Math.floor(Math.random() * HUE_POOL.length)];
    // Немного рандомизируем ±15°
    const jitter = Math.floor(Math.random() * 30) - 15;
    return `hsl(${(hue + jitter + 360) % 360}, 72%, 52%)`;
  }

  // Находим hue с максимальным минимальным расстоянием от всех занятых
  let bestHue = 0;
  let bestMinDist = -1;

  for (let h = 0; h < 360; h += 5) {
    let minDist = 360;
    for (const used of usedHues) {
      const d = Math.min(Math.abs(h - used), 360 - Math.abs(h - used));
      if (d < minDist) minDist = d;
    }
    if (minDist > bestMinDist) {
      bestMinDist = minDist;
      bestHue = h;
    }
  }

  // Добавляем маленький jitter для уникальности
  const jitter = Math.floor(Math.random() * 10) - 5;
  return `hsl(${(bestHue + jitter + 360) % 360}, 72%, 52%)`;
}

export interface CursorData {
  /** X позиция относительно контента scroll container */
  contentX: number;
  /** Y позиция относительно контента scroll container */
  contentY: number;
  /** Нормализованная позиция недели (float) — не зависит от weekPx */
  weekFloat?: number;
  /** Нормализованная позиция строки (float) — не зависит от eventRowH */
  rowFloat?: number;
  /** weekPx отправителя (для rescaling Y если нужно) */
  senderWeekPx?: number;
  /** ID ресурса, над которым находится курсор */
  resourceId?: string;
  /** Дробная позиция внутри строки ресурса (0-1) */
  resourceOffsetFraction?: number;
  userId: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  color: string;
  timestamp: number;
}

export interface OnlineUser {
  userId: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  color: string;
  lastSeen: number;
}

interface PresenceContextType {
  /** Курсоры других пользователей (координаты relative to grid content) */
  cursors: CursorData[];
  /** Обновить позицию курсора (content-relative координаты + настройки для нормализации) */
  updateCursor: (contentX: number, contentY: number, weekPx?: number, sidebarWidth?: number, eventRowH?: number, topHeight?: number, resourceId?: string, resourceOffsetFraction?: number) => void;
  /** Скрыть свой курсор (при уходе за пределы грида или открытии попапа) */
  hideCursor: () => void;
  /** Онлайн пользователи в текущем воркспейсе */
  onlineUsers: OnlineUser[];
  /** Realtime подключен */
  isAvailable: boolean;
  /** Цвет текущего пользователя */
  myColor: string;
  /** Прокрутить к позиции курсора пользователя по userId */
  scrollToUser: (userId: string) => void;
  /** Зарегистрировать scroll container для scroll-to-user */
  registerScrollContainer: (el: HTMLDivElement | null, sidebarWidth: number, topHeight: number) => void;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

interface PresenceProviderProps {
  children: ReactNode;
  workspaceId: string;
  accessToken?: string;
}

const CURSOR_THROTTLE_MS = 50;
const STALE_CURSOR_MS = 30000; // ✅ Изменено: 30 секунд бездействия (было 3000)

export function PresenceProvider({ children, workspaceId, accessToken }: PresenceProviderProps) {
  const [cursors, setCursors] = useState<CursorData[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [isAvailable, setIsAvailable] = useState(false);
  const [myColor, setMyColor] = useState('hsl(210, 72%, 52%)');
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastCursorSendRef = useRef(0);
  const cursorTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sidebarWidthRef = useRef(0);
  const topHeightRef = useRef(0);

  // Detect touch device — disable cursors
  const isTouchDevice = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }, []);

  const myUserId = useMemo(() => accessToken ? getUserIdFromToken(accessToken) : null, [accessToken]);
  const myEmail = useMemo(() => accessToken ? getEmailFromToken(accessToken) : null, [accessToken]);
  const myDisplayName = useMemo(() => accessToken ? getDisplayNameFromToken(accessToken) : null, [accessToken]);
  const myAvatarUrl = useMemo(() => {
    if (!accessToken) return undefined;
    const payload = decodeSupabaseJWT(accessToken);
    return payload?.user_metadata?.avatar_url as string | undefined;
  }, [accessToken]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Подписка на Realtime Presence
  useEffect(() => {
    if (!accessToken || !workspaceId || workspaceId === 'loading' || !myUserId) {
      return;
    }

    let channel: RealtimeChannel | null = null;

    const setup = async () => {
      await setSupabaseAuth(accessToken);

      const channelName = `presence:workspace:${workspaceId}`;


      // Генерируем цвет ДО подключения, обновим после sync
      const initialColor = pickContrastingColor([]);
      setMyColor(initialColor);

      channel = supabaseClient.channel(channelName, {
        config: {
          presence: { key: myUserId! },
        },
      });

      channel.on('presence', { event: 'sync' }, () => {
        if (!mountedRef.current || !channel) return;
        const state = channel.presenceState();
        const users: OnlineUser[] = [];
        const otherColors: string[] = [];

        Object.entries(state).forEach(([key, presences]) => {
          const latest = (presences as any[])?.[0];
          if (!latest) return;
          if (key === myUserId) return;
          const color = latest.color || 'hsl(0, 0%, 60%)';
          otherColors.push(color);
          users.push({
            userId: key,
            email: latest.email || '',
            displayName: latest.displayName,
            avatarUrl: latest.avatarUrl,
            color,
            lastSeen: Date.now(),
          });
        });

        setOnlineUsers(users);

        // Регенерируем свой цвет при изменении состава (тол��ко если нужно)
        // Проверяем, не слишком ли близок наш цвет к чужим
        setMyColor(prev => {
          const myHueMatch = prev.match(/hsl\((\d+)/);
          if (!myHueMatch) return pickContrastingColor(otherColors);
          const myHue = Number(myHueMatch[1]);

          for (const oc of otherColors) {
            const m = oc.match(/hsl\((\d+)/);
            if (!m) continue;
            const otherHue = Number(m[1]);
            const dist = Math.min(Math.abs(myHue - otherHue), 360 - Math.abs(myHue - otherHue));
            if (dist < 30) {
              // Слишком близко — перегенерируем
              const newColor = pickContrastingColor(otherColors);
              console.log(`🎨 Цвет курсора обновлён: ${prev} → ${newColor} (конфликт с ${oc})`);
              // Re-track с новым цветом
              channel?.track({
                email: myEmail,
                displayName: myDisplayName,
                avatarUrl: myAvatarUrl,
                color: newColor,
                online_at: new Date().toISOString(),
              });
              return newColor;
            }
          }
          return prev;
        });
      });

      // Broadcast cursor events
      channel.on('broadcast', { event: 'cursor' }, ({ payload }) => {
        if (!mountedRef.current) return;
        if (payload.userId === myUserId) return;

        if (payload.hidden) {
          // Удаляем курсор пользователя
          setCursors(prev => prev.filter(c => c.userId !== payload.userId));
          return;
        }

        setCursors(prev => {
          const filtered = prev.filter(c => c.userId !== payload.userId);
          return [...filtered, {
            contentX: payload.contentX,
            contentY: payload.contentY,
            weekFloat: payload.weekFloat,
            rowFloat: payload.rowFloat,
            senderWeekPx: payload.senderWeekPx,
            userId: payload.userId,
            email: payload.email || '',
            displayName: payload.displayName,
            avatarUrl: payload.avatarUrl,
            color: payload.color || 'hsl(0, 0%, 60%)',
            timestamp: Date.now(),
            resourceId: payload.resourceId,
            resourceOffsetFraction: payload.resourceOffsetFraction,
          }];
        });
      });

      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {

          setIsAvailable(true);

          const color = pickContrastingColor([]);
          setMyColor(color);

          await channel!.track({
            email: myEmail,
            displayName: myDisplayName,
            avatarUrl: myAvatarUrl,
            color,
            online_at: new Date().toISOString(),
          });
        } else if (status === 'CHANNEL_ERROR') {
          console.debug('Presence: канал недоступен (нет подключения к Supabase)');
          setIsAvailable(false);
        }
      });

      channelRef.current = channel;
    };

    setup();

    // Cleanup stale cursors
    cursorTimerRef.current = setInterval(() => {
      if (!mountedRef.current) return;
      const now = Date.now();
      setCursors(prev => {
        const filtered = prev.filter(c => now - c.timestamp < STALE_CURSOR_MS);
        return filtered.length !== prev.length ? filtered : prev;
      });
    }, 1000);

    return () => {
      if (cursorTimerRef.current) {
        clearInterval(cursorTimerRef.current);
        cursorTimerRef.current = null;
      }
      if (channel) {
        console.log('🔌 Presence: отключение...');
        supabaseClient.removeChannel(channel);
        channelRef.current = null;
      }
      setCursors([]);
      setOnlineUsers([]);
      setIsAvailable(false);
    };
  }, [accessToken, workspaceId, myUserId, myEmail, myDisplayName, myAvatarUrl]);

  // Throttled cursor broadcast
  const updateCursor = useCallback((contentX: number, contentY: number, weekPx?: number, sidebarWidth?: number, eventRowH?: number, topHeight?: number, resourceId?: string, resourceOffsetFraction?: number) => {
    if (isTouchDevice) return;
    const now = Date.now();
    if (now - lastCursorSendRef.current < CURSOR_THROTTLE_MS) return;
    lastCursorSendRef.current = now;

    const channel = channelRef.current;
    if (!channel || !myUserId) return;

    // Нормализуем X в weekFloat (не зависит от weekPx получателя)
    const GAP_OFFSET = 8;
    const sw = sidebarWidth ?? 284;
    const wp = weekPx ?? 120;
    const weekFloat = (contentX - sw - GAP_OFFSET) / wp;

    // Нормализуем Y в rowFloat (не зависит от eventRowH получателя)
    const rh = eventRowH ?? 40;
    const th = topHeight ?? 0;
    const rowFloat = (contentY - th) / rh;

    channel.send({
      type: 'broadcast',
      event: 'cursor',
      payload: {
        contentX,
        contentY,
        weekFloat,
        rowFloat,
        senderWeekPx: wp,
        senderSidebarWidth: sw,
        userId: myUserId,
        email: myEmail,
        displayName: myDisplayName,
        avatarUrl: myAvatarUrl,
        color: myColor,
        resourceId,
        resourceOffsetFraction,
      },
    });
  }, [myUserId, myEmail, myDisplayName, myAvatarUrl, myColor, isTouchDevice]);

  const hideCursor = useCallback(() => {
    const channel = channelRef.current;
    if (!channel || !myUserId) return;

    channel.send({
      type: 'broadcast',
      event: 'cursor',
      payload: { userId: myUserId, hidden: true },
    });
  }, [myUserId]);

  const scrollToUser = useCallback((userId: string) => {
    const cursor = cursors.find(c => c.userId === userId);
    if (!cursor || !scrollContainerRef.current) {
      console.log(`🔍 scrollToUser: курсор не найден для ${userId}`);
      return;
    }

    const el = scrollContainerRef.current;
    const sidebarWidth = sidebarWidthRef.current;
    const topHeight = topHeightRef.current;

    // Center the cursor in the viewport
    const viewportW = el.clientWidth - sidebarWidth;
    const viewportH = el.clientHeight - topHeight;

    // ✅ Используем weekFloat для пересчёта X если доступен (для корректного scroll при разных weekPx)
    // Если weekFloat нет (старый клиент) — используем contentX как fallback
    let cursorContentX = cursor.contentX;
    if (cursor.weekFloat != null) {
      // Пересчитываем contentX с учётом локального weekPx
      // Но у нас нет weekPx в PresenceContext. Используем senderWeekPx для масштабирования.
      // Это приблизительно — scrollToUser приведёт к нужной области
      cursorContentX = sidebarWidth + 8 + cursor.weekFloat * (cursor.senderWeekPx ?? 120);
    }

    const scrollLeft = cursorContentX - sidebarWidth - viewportW / 2;
    const scrollTop = cursor.contentY - topHeight - viewportH / 2;

    console.log(`🔍 scrollToUser: scrolling to (${Math.round(scrollLeft)}, ${Math.round(scrollTop)}) for cursor weekFloat=${cursor.weekFloat?.toFixed(2)}`);

    el.scrollTo({
      left: Math.max(0, scrollLeft),
      top: Math.max(0, scrollTop),
      behavior: 'smooth',
    });
  }, [cursors]);

  const registerScrollContainer = useCallback((el: HTMLDivElement | null, sidebarWidth: number, topHeight: number) => {
    scrollContainerRef.current = el;
    sidebarWidthRef.current = sidebarWidth;
    topHeightRef.current = topHeight;
  }, []);

  const value: PresenceContextType = {
    cursors,
    updateCursor,
    hideCursor,
    onlineUsers,
    isAvailable,
    myColor,
    scrollToUser,
    registerScrollContainer,
  };

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error('usePresence must be used within PresenceProvider');
  }
  return context;
}

/** Safe version that returns null if PresenceProvider is not available */
export function usePresenceOptional() {
  return useContext(PresenceContext);
}