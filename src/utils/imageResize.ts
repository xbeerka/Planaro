/**
 * Клиентское сжатие изображений до 200px по меньшей стороне
 * Использует Canvas API - работает во всех современных браузерах
 */

/**
 * Сжимает изображение до 200px по меньшей стороне, сохраняя пропорции
 * @param file - исходный файл изображения
 * @returns Promise с новым сжатым File объектом
 */
export async function resizeImageOnClient(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    // Проверяем что это изображение
    if (!file.type.startsWith('image/')) {
      reject(new Error('Файл не является изображением'));
      return;
    }

    console.log('🖼️ Начало клиентского сжатия:', {
      name: file.name,
      size: `${Math.round(file.size / 1024)}KB`,
      type: file.type
    });

    const reader = new FileReader();
    
    reader.onerror = () => {
      reject(new Error('Ошибка чтения файла'));
    };
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onerror = () => {
        reject(new Error('Ошибка загрузки изображения'));
      };
      
      img.onload = () => {
        try {
          const originalWidth = img.width;
          const originalHeight = img.height;
          
          console.log(`📐 Оригинальный размер: ${originalWidth}x${originalHeight}px`);
          
          // Определяем меньшую сторону
          const minDimension = Math.min(originalWidth, originalHeight);
          
          // Если изображение уже меньше или равно 200px - возвращаем оригинал
          if (minDimension <= 200) {
            console.log('✓ Изображение уже оптимального размера, пропускаем сжатие');
            resolve(file);
            return;
          }
          
          // Вычисляем новые размеры с сохранением пропорций
          const scale = 200 / minDimension;
          const newWidth = Math.round(originalWidth * scale);
          const newHeight = Math.round(originalHeight * scale);
          
          console.log(`🔄 Сжатие до: ${newWidth}x${newHeight}px (меньшая сторона = 200px)`);
          
          // Создаём canvas для ресайза
          const canvas = document.createElement('canvas');
          canvas.width = newWidth;
          canvas.height = newHeight;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Не удалось получить canvas context'));
            return;
          }
          
          // Отключаем сглаживание для лучшего качества при уменьшении
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          // Рисуем изображение с новыми размерами
          ctx.drawImage(img, 0, 0, newWidth, newHeight);
          
          // Конвертируем canvas в Blob (JPEG, качество 90%)
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Ошибка создания Blob'));
                return;
              }
              
              // Создаём новый File из Blob
              const resizedFile = new File(
                [blob],
                file.name.replace(/\.[^.]+$/, '.jpg'), // Меняем расширение на .jpg
                { 
                  type: 'image/jpeg',
                  lastModified: Date.now()
                }
              );
              
              const originalSizeKB = Math.round(file.size / 1024);
              const newSizeKB = Math.round(resizedFile.size / 1024);
              const savedPercent = Math.round((1 - resizedFile.size / file.size) * 100);
              
              console.log(`✅ Сжатие завершено: ${originalSizeKB}KB → ${newSizeKB}KB (экономия ${savedPercent}%)`);
              
              resolve(resizedFile);
            },
            'image/jpeg',
            0.9 // Качество 90%
          );
        } catch (error: any) {
          console.error('❌ Ошибка при сжатии изображения:', error);
          // В случае ошибки возвращаем оригинал
          console.warn('⚠️ Используем оригинальное изображение');
          resolve(file);
        }
      };
      
      // Загружаем изображение из FileReader
      img.src = e.target?.result as string;
    };
    
    // Читаем файл как Data URL
    reader.readAsDataURL(file);
  });
}

/**
 * Быстрая проверка размеров изображения без полной загрузки
 * Полезно для показа информации пользователю
 */
export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Файл не является изображением'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Ошибка загрузки изображения'));
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.src = e.target?.result as string;
    };
    
    reader.readAsDataURL(file);
  });
}
