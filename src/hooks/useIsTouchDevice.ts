import { useState, useEffect } from 'react';

export function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const checkTouch = () => {
      // pointer: coarse означает сенсорный ввод (телефон/планшет)
      const isCoarse = window.matchMedia('(pointer: coarse)').matches;

      // pointer: fine означает мышь/тачпад (ноутбук, декстоп)
      // Если есть fine-устройство — значит это не чисто сенсорное устройство
      const hasFinePointer = window.matchMedia('(pointer: fine)').matches;

      // Настоящий тач-девайс: coarse И нет fine-указателя И минимум 2 точки касания.
      // MacBook trackpad репортит pointer:fine и maxTouchPoints ≤ 1.
      // Планшеты/телефоны: pointer:coarse, maxTouchPoints ≥ 2, нет fine-устройств.
      const maxTouchPoints = navigator.maxTouchPoints ?? 0;
      const isRealTouchDevice = isCoarse && !hasFinePointer && maxTouchPoints >= 2;

      setIsTouch(isRealTouchDevice);
    };

    checkTouch();
    window.addEventListener('resize', checkTouch);

    return () => window.removeEventListener('resize', checkTouch);
  }, []);

  return isTouch;
}