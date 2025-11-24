// Исправленная версия handleUndo и handleRedo с единым префиксом логов

const handleUndo_FIXED = `const handleUndo = useCallback(async () => {
    const state = historyUndo();
    if (!state) return;
    
    console.log('🔄 UNDO/REDO: ↩️ Undo начат - мгновенное восстановление из истории');
    
    // ✅ Сохраняем текущие события ДО undo (для синхронизации удалений)
    const previousEvents = events;
    
    // ✅ БЛОКИРУЕМ автосохранение при undo (это не пользовательское изменение)
    isUserProjectChangeRef.current = false;
    
    // ✅ БЛОКИРУЕМ очистку orphaned events на 5 секунд (защита от удаления восстановленных событий)
    lastUndoRedoTimeRef.current = Date.now();
    console.log('🔄 UNDO/REDO: 🛡️ Блокировка orphaned cleanup на 5 секунд');
    
    // ✅ КРИТИЧНО: СБРАСЫВАЕМ ТАЙМЕР ДЕЛЬТА-СИНКА!
    // Это локальное изменение, синхронизация должна быть заблокирована на 5 секунд
    // (увеличено с 2 до 5 сек для защиты от быстрых последовательных Undo/Redo)
    resetDeltaSyncTimer();
    console.log('🔄 UNDO/REDO: ⏸️ Сброс таймера дельта-синка (блокировка на 5 сек)');
    
    // ✅ Фильтруем дубликаты по ID (на случай если в истории есть дубликаты)
    const uniqueEvents = Array.from(
      new Map(state.events.map(e => [e.id, e])).values()
    );
    
    if (uniqueEvents.length !== state.events.length) {
      console.warn(\`🔄 UNDO/REDO: ⚠️ Обнаружены дубликаты в истории: \${state.events.length} → \${uniqueEvents.length}\`);
    }
    
    // ✅ МГНОВЕННО восстанавливаем события и проекты из истории
    setEvents(uniqueEvents);
    setEventZOrder(state.eventZOrder);
    setProjects(state.projects);
    
    console.log(\`🔄 UNDO/REDO: ↩️ Восстановлено \${uniqueEvents.length} событий, \${state.projects.length} проектов\`);
    
    // ✅ КРИТИЧНО: Блокируем синхронизацию проектов после Undo (на 5 секунд)
    resetProjectsSyncTimer();
    console.log('🔄 UNDO/REDO: 🔒 Синхронизация проектов заблокирована на 5 секунд');
    
    // ✅ КРИТИЧНО: Синхронизируем восстановленные события с сервером!
    // Это предотвратит их удаление Full Sync'ом через 30 секунд
    try {
      await syncRestoredEventsToServer(uniqueEvents, updateHistoryEventId);
      console.log('🔄 UNDO/REDO: ✅ События успешно синхронизированы с сервером');
    } catch (error) {
      console.error('🔄 UNDO/REDO: ❌ Ошибка синхронизации с сервером:', error);
      showToast({
        title: 'Ошибка восстановления',
        description: 'Не удалось синхронизировать события с сервером',
        variant: 'destructive'
      });
    }
    
    // ✅ КРИТИЧНО: Синхронизируем удалённые события с сервером!
    // Это предотвратит их возвращение Full Sync'ом через 30 секунд
    try {
      await syncDeletedEventsToServer(uniqueEvents, previousEvents);
      console.log('🔄 UNDO/REDO: ✅ Удалённые события успешно синхронизированы с сервером');
    } catch (error) {
      console.error('🔄 UNDO/REDO: ❌ Ошибка синхронизации удалённых событий:', error);
    }
    
    console.log('🔄 UNDO/REDO: ✅ Undo завершён успешно');
  }, [historyUndo, events, setEvents, setProjects, resetDeltaSyncTimer, resetProjectsSyncTimer, syncRestoredEventsToServer, syncDeletedEventsToServer, updateHistoryEventId, showToast]);`;

const handleRedo_FIXED = `const handleRedo = useCallback(async () => {
    const state = historyRedo();
    if (!state) return;
    
    console.log('🔄 UNDO/REDO: ↪️ Redo начат - мгновенное восстановление из истории');
    
    // ✅ Сохраняем текущие события ДО redo (для синхронизации удалений)
    const previousEvents = events;
    
    // ✅ БЛОКИРУЕМ автосохранение при redo (это не пользовательское изменение)
    isUserProjectChangeRef.current = false;
    
    // ✅ БЛОКИРУЕМ очистку orphaned events на 5 секунд (защита от удаления восстановленных событий)
    lastUndoRedoTimeRef.current = Date.now();
    console.log('🔄 UNDO/REDO: 🛡️ Блокировка orphaned cleanup на 5 секунд');
    
    // ✅ КРИТИЧНО: СБРАСЫВАЕМ ТАЙМЕР ДЕЛЬТА-СИНКА!
    // Это локальное изменение, синхронизация должна быть заблокирована на 5 секунд
    // (увеличено с 2 до 5 сек для защиты от быстрых последовательных Undo/Redo)
    resetDeltaSyncTimer();
    console.log('🔄 UNDO/REDO: ⏸️ Сброс таймера дельта-синка (блокировка на 5 сек)');
    
    // ✅ Фильтруем дубликаты по ID (на случай если в истории есть дубликаты)
    const uniqueEvents = Array.from(
      new Map(state.events.map(e => [e.id, e])).values()
    );
    
    if (uniqueEvents.length !== state.events.length) {
      console.warn(\`🔄 UNDO/REDO: ⚠️ Обнаружены дубликаты в истории: \${state.events.length} → \${uniqueEvents.length}\`);
    }
    
    // ✅ МГНОВЕННО восстанавливаем события и проекты из истории
    setEvents(uniqueEvents);
    setEventZOrder(state.eventZOrder);
    setProjects(state.projects);
    
    console.log(\`🔄 UNDO/REDO: ↪️ Восстановлено \${uniqueEvents.length} событий, \${state.projects.length} проектов\`);
    
    // ✅ КРИТИЧНО: Блокируем синхронизацию проектов после Redo (на 5 секунд)
    resetProjectsSyncTimer();
    console.log('🔄 UNDO/REDO: 🔒 Синхронизация проектов заблокирована на 5 секунд');
    
    // ✅ КРИТИЧНО: Синхронизируем восстановленные события с сервером!
    // Это предотвратит их удаление Full Sync'ом через 30 секунд
    try {
      await syncRestoredEventsToServer(uniqueEvents, updateHistoryEventId);
      console.log('🔄 UNDO/REDO: ✅ События успешно синхронизированы с сервером');
    } catch (error) {
      console.error('🔄 UNDO/REDO: ❌ Ошибка синхронизации с сервером:', error);
      showToast({
        title: 'Ошибка восстановления',
        description: 'Не удалось синхронизировать события с сервером',
        variant: 'destructive'
      });
    }
    
    // ✅ КРИТИЧНО: Синхронизируем удалённые события с сервером!
    // Это предотвратит их возвращение Full Sync'ом через 30 секунд
    try {
      await syncDeletedEventsToServer(uniqueEvents, previousEvents);
      console.log('🔄 UNDO/REDO: ✅ Удалённые события успешно синхронизированы с сервером');
    } catch (error) {
      console.error('🔄 UNDO/REDO: ❌ Ошибка синхронизации удалённых событий:', error);
    }
    
    console.log('🔄 UNDO/REDO: ✅ Redo завершён успешно');
  }, [historyRedo, events, setEvents, setProjects, resetDeltaSyncTimer, resetProjectsSyncTimer, syncRestoredEventsToServer, syncDeletedEventsToServer, updateHistoryEventId, showToast]);`;

//  Также нужно обновить логи в SchedulerContext.tsx функции syncRestoredEventsToServer
