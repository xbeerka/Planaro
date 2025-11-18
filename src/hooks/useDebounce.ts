import { useState, useEffect } from 'react';

/**
 * Debounce hook - откладывает обновление значения до окончания ввода
 * Используется для оптимизации тяжелых вычислений (поиск, фильтрация)
 * 
 * @param value - Текущее значение (обновляется при каждом keystroke)
 * @param delay - Задержка в миллисекундах (рекомендуется 300-500ms)
 * @returns Debounced значение (обновляется только после задержки)
 * 
 * @example
 * const [searchQuery, setSearchQuery] = useState('');
 * const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
 * 
 * // searchQuery обновляется мгновенно (для UI)
 * // debouncedSearchQuery обновляется через 300ms (для фильтрации)
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // Устанавливаем таймер для обновления debounced значения
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup: отменяем предыдущий таймер при новом изменении
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Debounced callback hook - откладывает вызов функции
 * Полезен для API запросов, сохранений в БД
 * 
 * @param callback - Функция для вызова
 * @param delay - Задержка в миллисекундах
 * @returns Debounced версия функции
 * 
 * @example
 * const saveToServer = useDebouncedCallback((data) => {
 *   api.save(data);
 * }, 500);
 * 
 * // Вызываем много раз, но запрос уйдет только один (последний)
 * onChange={(e) => saveToServer(e.target.value)}
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Cleanup при unmount
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  return (...args: Parameters<T>) => {
    // Отменяем предыдущий вызов
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Устанавливаем новый таймер
    const newTimeoutId = setTimeout(() => {
      callback(...args);
    }, delay);

    setTimeoutId(newTimeoutId);
  };
}
