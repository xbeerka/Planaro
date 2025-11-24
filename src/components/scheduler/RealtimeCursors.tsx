import React from 'react';
import { usePresence } from '../../contexts/PresenceContext';

/**
 * RealtimeCursors - отображение курсоров других пользователей в реальном времени
 * 
 * СТАТУС: Gracefully disabled (пакет @supabase/supabase-js недоступен в Figma Make)
 * 
 * Этот компонент готов к работе с Supabase Realtime Presence,
 * но сейчас просто не рендерит ничего так как Realtime недоступен.
 * 
 * См. документацию: /FINAL_STATUS_v3.4.0.md, /SUPABASE_REALTIME_INTEGRATION_v3.4.0.md
 */
export function RealtimeCursors() {
  const { cursors, isAvailable } = usePresence();

  // Если Realtime недоступен - ничего не рендерим
  if (!isAvailable) {
    return null;
  }

  // Если нет курсоров - ничего не рендерим
  if (cursors.length === 0) {
    return null;
  }

  // В будущем здесь будет рендеринг курсоров
  return null;
}
