import { useEffect, useState, useRef, useCallback } from 'react';
import { projectId } from '../../utils/supabase/info';
import { getDisplayNameFromToken, getEmailFromToken } from '../../utils/jwt';

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

interface CursorPresenceProps {
  accessToken: string | null;
  workspaceId: number;
}

export function CursorPresence({ accessToken, workspaceId }: CursorPresenceProps) {
  const [cursors, setCursors] = useState<Map<string, CursorPosition>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const lastSentRef = useRef<{ x: number; y: number; timestamp: number }>({ x: 0, y: 0, timestamp: 0 });
  const currentUserEmailRef = useRef<string | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);

  // Throttle для отправки координат курсора (максимум каждые 50ms)
  const THROTTLE_MS = 50;
  
  // Таймаут для удаления неактивных курсоров (5 секунд без обновлений)
  const CURSOR_TIMEOUT_MS = 5000;
  
  // Максимум попыток переподключения
  const MAX_RECONNECT_ATTEMPTS = 5;
  
  // Задержка между попытками переподключения (exponential backoff)
  const getReconnectDelay = (attempt: number) => Math.min(1000 * Math.pow(2, attempt), 30000);

  // Генерация уникального цвета для пользователя на основе email
  const getUserColor = useCallback((email: string): string => {
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
      hash = email.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 50%)`;
  }, []);

  // WebSocket connection logic
  const connectWebSocket = useCallback(() => {
    if (!accessToken || !workspaceId) {
      console.log('🖱️ CursorPresence: нет токена или workspace ID');
      return;
    }

    const currentUserEmail = getEmailFromToken(accessToken);
    const displayName = getDisplayNameFromToken(accessToken);
    currentUserEmailRef.current = currentUserEmail;

    console.log('🖱️ Подключение к WebSocket Cursor Presence для workspace:', workspaceId);
    console.log('👤 Текущий пользователь:', displayName, currentUserEmail);

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      // Always use wss:// for Supabase Edge Functions (they're always served over HTTPS)
      const wsUrl = `wss://${projectId}.supabase.co/functions/v1/make-server-73d66528/cursors/${workspaceId}?token=${encodeURIComponent(accessToken)}`;
      
      console.log('🔌 Создание WebSocket соединения:', wsUrl.replace(/token=[^&]+/, 'token=***'));
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket соединение установлено');
        reconnectAttemptsRef.current = 0; // Reset reconnect counter
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'connected') {
            console.log('🎉 Подключено к workspace:', data.message, '- активных пользователей:', data.activeUsers);
          } else if (data.type === 'cursor') {
            // Don't show own cursor
            if (data.email === currentUserEmail) {
              return;
            }
            
            // Update cursor position
            setCursors(prev => {
              const next = new Map(prev);
              next.set(data.userId, {
                x: data.x,
                y: data.y,
                displayName: data.displayName,
                email: data.email,
                avatarUrl: data.avatarUrl,
                color: data.color,
                userId: data.userId,
                timestamp: data.timestamp
              });
              return next;
            });
          } else if (data.type === 'disconnected') {
            console.log('👋 Пользователь отключился:', data.email);
            setCursors(prev => {
              const next = new Map(prev);
              next.delete(data.userId);
              return next;
            });
          }
        } catch (err) {
          console.error('❌ Ошибка парсинга WebSocket сообщения:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('❌ WebSocket ошибка:', {
          type: event.type,
          target: event.target,
          readyState: ws.readyState,
          url: wsUrl.replace(/token=[^&]+/, 'token=***'),
          timestamp: new Date().toISOString()
        });
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket соединение закрыто:', {
          code: event.code,
          reason: event.reason || '(no reason provided)',
          wasClean: event.wasClean,
          timestamp: new Date().toISOString()
        });
        
        // Common WebSocket close codes:
        // 1000 = Normal closure
        // 1001 = Going away (page refresh/navigation)
        // 1006 = Abnormal closure (no close frame received)
        // 1008 = Policy violation
        // 1011 = Server error
        
        if (event.code === 1006) {
          console.warn('⚠️ Abnormal closure - возможно сервер недоступен или отклонил соединение');
        } else if (event.code === 1008) {
          console.error('❌ Policy violation - возможно проблема с авторизацией');
        }
        
        wsRef.current = null;
        
        // Attempt reconnection with exponential backoff
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = getReconnectDelay(reconnectAttemptsRef.current);
          console.log(`🔄 Попытка переподключения ${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS} через ${delay}ms...`);
          
          reconnectTimeoutRef.current = window.setTimeout(() => {
            reconnectAttemptsRef.current++;
            connectWebSocket();
          }, delay);
        } else {
          console.warn('⚠️ Достигнут лимит попыток переподключения');
        }
      };
    } catch (err) {
      console.error('❌ Ошибка создания WebSocket:', err);
    }
  }, [accessToken, workspaceId]);

  // Connect on mount
  useEffect(() => {
    connectWebSocket();

    // Cleanup
    return () => {
      console.log('🧹 Отключение от WebSocket Cursor Presence');
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connectWebSocket]);

  // Обработчик движения мыши с throttle
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const now = Date.now();
    const lastSent = lastSentRef.current;

    // Throttle: отправляем только если прошло больше THROTTLE_MS
    if (now - lastSent.timestamp < THROTTLE_MS) {
      return;
    }

    // Отправляем координаты относительно viewport
    const x = e.clientX;
    const y = e.clientY;

    lastSentRef.current = { x, y, timestamp: now };

    // Отправляем позицию курсора
    try {
      wsRef.current.send(JSON.stringify({
        type: 'cursor',
        x,
        y,
        timestamp: now
      }));
    } catch (err) {
      console.warn('⚠️ Ошибка отправки cursor position:', err);
    }
  }, []);

  // Подписываемся на движение мыши
  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [handleMouseMove]);

  // Периодическая очистка устаревших курсоров
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setCursors(prev => {
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
    }, 1000); // Проверяем каждую секунду

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {Array.from(cursors.values()).map((cursor) => (
        <div
          key={cursor.userId}
          className="pointer-events-none fixed z-[9999] transition-transform duration-100 ease-out"
          style={{
            left: `${cursor.x}px`,
            top: `${cursor.y}px`,
            transform: 'translate(-2px, -2px)',
          }}
        >
          {/* SVG курсор */}
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-lg"
          >
            <path
              d="M5.65376 12.3673L5.46026 12.4196L5.65376 12.3673L12.3167 3.50318L12.3196 3.49932L12.3225 3.49541C12.5206 3.23051 12.8804 3.12753 13.2068 3.23385C13.5331 3.34016 13.7556 3.63564 13.7556 3.97838V8.86051L18.6445 8.86051C18.9552 8.86051 19.235 9.0287 19.3767 9.29869C19.5184 9.56867 19.4997 9.89393 19.3267 10.1464L12.6637 19.0105C12.4657 19.2754 12.1059 19.3784 11.7795 19.2721C11.4532 19.1658 11.2307 18.8703 11.2307 18.5276V13.6455L6.34178 13.6455C6.03106 13.6455 5.75125 13.4773 5.60956 13.2073C5.46786 12.9373 5.48655 12.6121 5.65926 12.3596L5.65376 12.3673Z"
              fill={cursor.color}
              stroke="white"
              strokeWidth="1.5"
            />
          </svg>

          {/* Имя пользователя */}
          <div
            className="ml-6 -mt-1 px-2 py-1 rounded-md text-xs whitespace-nowrap shadow-lg border border-white/20"
            style={{
              backgroundColor: cursor.color,
              color: 'white',
            }}
          >
            {cursor.displayName}
          </div>
        </div>
      ))}
    </>
  );
}
