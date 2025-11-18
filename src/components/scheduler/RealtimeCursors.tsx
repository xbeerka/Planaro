/**
 * Realtime Cursors Component
 * 
 * Отображает курсоры других пользователей в реальном времени
 * Использует Supabase Realtime Presence
 */

import { useEffect, useCallback } from 'react';
import { usePresence } from '../../contexts/PresenceContext';

export function RealtimeCursors() {
  const { cursors, isConnected, isAvailable, updateCursor } = usePresence();

  // Обработчик движения мыши
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isConnected) return;

      // Координаты относительно viewport
      const x = e.clientX;
      const y = e.clientY;

      updateCursor(x, y);
    },
    [isConnected, updateCursor]
  );

  // Подписка на движение мыши
  useEffect(() => {
    if (!isAvailable || !isConnected) {
      return;
    }

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isAvailable, isConnected, handleMouseMove]);

  // Не рендерим если Realtime недоступен
  if (!isAvailable) {
    return null;
  }

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

      {/* Индикатор подключения (для дебага) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 z-[9998] px-3 py-1 rounded-md text-xs bg-black/70 text-white">
          {isConnected ? '🟢 Realtime Connected' : '🔴 Realtime Disconnected'}
        </div>
      )}
    </>
  );
}
