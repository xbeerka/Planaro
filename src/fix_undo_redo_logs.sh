#!/bin/bash

# Скрипт для замены логов Undo/Redo на единый префикс

FILE="/components/scheduler/SchedulerMain.tsx"

# Handle Undo logs
sed -i "s/console\\.log('↩️ Undo: МГНОВЕННОЕ восстановление из истории')/console.log('🔄 UNDO\/REDO: ↩️ Undo начат - мгновенное восстановление из истории')/g" "$FILE"
sed -i "s/console\\.log('🛡️ Undo: блокировка orphaned cleanup на 5 секунд')/console.log('🔄 UNDO\/REDO: 🛡️ Блокировка orphaned cleanup на 5 секунд')/g" "$FILE"
sed -i "s/console\\.log('⏸️ Undo: сброс таймера дельта-синка (блокировка на 5 сек)')/console.log('🔄 UNDO\/REDO: ⏸️ Сброс таймера дельта-синка (блокировка на 5 сек)')/g" "$FILE"
sed -i "s/console\\.warn(\`⚠️ Обнаружены дубликаты в истории:/console.warn(\`🔄 UNDO\/REDO: ⚠️ Обнаружены дубликаты в истории:/g" "$FILE"
sed -i "s/console\\.log(\`↩️ Undo: восстановлено/console.log(\`🔄 UNDO\/REDO: ↩️ Восстановлено/g" "$FILE"
sed -i "s/console\\.log('🔒 Undo: синхронизация проектов заблокирована на 5 секунд')/console.log('🔄 UNDO\/REDO: 🔒 Синхронизация проектов заблокирована на 5 секунд')/g" "$FILE"
sed -i "s/console\\.log('✅ Undo: события успешно синхронизированы с сервером')/console.log('🔄 UNDO\/REDO: ✅ События успешно синхронизированы с сервером')/g" "$FILE"
sed -i "s/console\\.error('❌ Undo: ошибка синхронизации с сервером:', error)/console.error('🔄 UNDO\/REDO: ❌ Ошибка синхронизации с сервером:', error)/g" "$FILE"
sed -i "s/console\\.log('✅ Undo: удалённые события успешно синхронизированы с сервером')/console.log('🔄 UNDO\/REDO: ✅ Удалённые события успешно синхронизированы с сервером')/g" "$FILE"
sed -i "s/console\\.error('❌ Undo: ошибка синхронизации удалённых событий:', error)/console.error('🔄 UNDO\/REDO: ❌ Ошибка синхронизации удалённых событий:', error)/g" "$FILE"

# Handle Redo logs  
sed -i "s/console\\.log('↪️ Redo: МГНОВЕННОЕ восстановление из истории')/console.log('🔄 UNDO\/REDO: ↪️ Redo начат - мгновенное восстановление из истории')/g" "$FILE"
sed -i "s/console\\.log('🛡️ Redo: блокировка orphaned cleanup на 5 секунд')/console.log('🔄 UNDO\/REDO: 🛡️ Блокировка orphaned cleanup на 5 секунд')/g" "$FILE"
sed -i "s/console\\.log('⏸️ Redo: сброс таймера дельта-синка (блокировка на 5 сек)')/console.log('🔄 UNDO\/REDO: ⏸️ Сброс таймера дельта-синка (блокировка на 5 сек)')/g" "$FILE"
sed -i "s/console\\.log(\`↪️ Redo: восстановлено/console.log(\`🔄 UNDO\/REDO: ↪️ Восстановлено/g" "$FILE"
sed -i "s/console\\.log('🔒 Redo: синхронизация проектов заблокирована на 5 секунды')/console.log('🔄 UNDO\/REDO: 🔒 Синхронизация проектов заблокирована на 5 секунд')/g" "$FILE"
sed -i "s/console\\.log('✅ Redo: события успешно синхронизированы с сервером')/console.log('🔄 UNDO\/REDO: ✅ События успешно синхронизированы с сервером')/g" "$FILE"
sed -i "s/console\\.error('❌ Redo: ошибка синхронизации с сервером:', error)/console.error('🔄 UNDO\/REDO: ❌ Ошибка синхронизации с сервером:', error)/g" "$FILE"
sed -i "s/console\\.log('✅ Redo: удалённые события успешно синхронизированы с сервером')/console.log('🔄 UNDO\/REDO: ✅ Удалённые события успешно синхронизированы с сервером')/g" "$FILE"
sed -i "s/console\\.error('❌ Redo: ошибка синхронизации удалённых событий:', error)/console.error('🔄 UNDO\/REDO: ❌ Ошибка синхронизации удалённых событий:', error)/g" "$FILE"

echo "Логи обновлены!"
