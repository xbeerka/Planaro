import React, { useRef, useState, useEffect, useCallback } from 'react';

interface CustomScrollbarsProps {
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  leftOffset: number; // Отступ слева для горизонтального скроллбара (от сайдбара)
  topOffset: number; // Отступ сверху для вертикального скроллбара (от заголовков)
}

export function CustomScrollbars({
  scrollContainerRef,
  leftOffset,
  topOffset,
}: CustomScrollbarsProps) {
  // Refs для треков
  const horizontalTrackRef = useRef<HTMLDivElement>(null);
  const verticalTrackRef = useRef<HTMLDivElement>(null);

  // State для thumbs
  const [horizontalThumb, setHorizontalThumb] = useState({ width: 0, left: 0 });
  const [verticalThumb, setVerticalThumb] = useState({ height: 0, top: 0 });

  // Dragging state
  const [isDraggingHorizontal, setIsDraggingHorizontal] = useState(false);
  const [isDraggingVertical, setIsDraggingVertical] = useState(false);

  // Hover state
  const [isHoveringHorizontal, setIsHoveringHorizontal] = useState(false);
  const [isHoveringVertical, setIsHoveringVertical] = useState(false);

  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const dragStartScrollLeft = useRef(0);
  const dragStartScrollTop = useRef(0);
  const thumbOffsetX = useRef(0); // Где внутри thumb'а схватили
  const thumbOffsetY = useRef(0); // Где внутри thumb'а схватили

  // ========== UPDATE THUMBS ==========
  const updateThumbs = useCallback(() => {
    const scrollContainer = scrollContainerRef?.current;
    const hTrack = horizontalTrackRef.current;
    const vTrack = verticalTrackRef.current;

    if (!scrollContainer || !hTrack || !vTrack) return;

    // Горизонтальный thumb
    const trackWidth = hTrack.offsetWidth;
    const scrollWidth = scrollContainer.scrollWidth;
    const clientWidth = scrollContainer.clientWidth;
    const scrollLeft = scrollContainer.scrollLeft;

    const hThumbWidth = Math.max(40, (clientWidth / scrollWidth) * trackWidth);
    const maxScrollLeft = scrollWidth - clientWidth;
    const scrollPercent = maxScrollLeft > 0 ? scrollLeft / maxScrollLeft : 0;
    const maxThumbLeft = trackWidth - hThumbWidth;
    const hThumbLeft = scrollPercent * maxThumbLeft;

    setHorizontalThumb({ width: hThumbWidth, left: hThumbLeft });

    // Вертикальный thumb
    const trackHeight = vTrack.offsetHeight;
    const scrollHeight = scrollContainer.scrollHeight;
    const clientHeight = scrollContainer.clientHeight;
    const scrollTop = scrollContainer.scrollTop;

    const vThumbHeight = Math.max(40, (clientHeight / scrollHeight) * trackHeight);
    const maxScrollTop = scrollHeight - clientHeight;
    const scrollPercentV = maxScrollTop > 0 ? scrollTop / maxScrollTop : 0;
    const maxThumbTop = trackHeight - vThumbHeight;
    const vThumbTop = scrollPercentV * maxThumbTop;

    setVerticalThumb({ height: vThumbHeight, top: vThumbTop });
  }, [scrollContainerRef]);

  // ========== SETUP LISTENERS ==========
  useEffect(() => {
    const scrollContainer = scrollContainerRef?.current;
    if (!scrollContainer) {
      console.error('❌ CustomScrollbars: scrollContainer не найден');
      return;
    }

    updateThumbs();

    scrollContainer.addEventListener('scroll', updateThumbs);
    window.addEventListener('resize', updateThumbs);

    return () => {
      scrollContainer.removeEventListener('scroll', updateThumbs);
      window.removeEventListener('resize', updateThumbs);
    };
  }, [scrollContainerRef, updateThumbs]);

  // ========== HORIZONTAL DRAG ==========
  const handleHorizontalPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingHorizontal(true);
    
    // Захватываем pointer чтобы получать события даже за пределами окна
    e.currentTarget.setPointerCapture(e.pointerId);
    
    const hTrack = horizontalTrackRef.current;
    if (!hTrack) return;
    
    const trackRect = hTrack.getBoundingClientRect();
    const thumbLeftInTrack = horizontalThumb.left;
    const thumbLeftInViewport = trackRect.left + thumbLeftInTrack;
    
    // Где внутри thumb'а кликнули (0 = левый край, thumbWidth = правый край)
    thumbOffsetX.current = e.clientX - thumbLeftInViewport;
    dragStartX.current = e.clientX;
    dragStartScrollLeft.current = scrollContainerRef.current?.scrollLeft || 0;
  };

  useEffect(() => {
    if (!isDraggingHorizontal) return;

    const handlePointerMove = (e: PointerEvent) => {
      const scrollContainer = scrollContainerRef?.current;
      const hTrack = horizontalTrackRef.current;
      if (!scrollContainer || !hTrack) return;

      const trackRect = hTrack.getBoundingClientRect();
      // Позиция курсора относительно трека минус offset внутри thumb'а
      const thumbLeftInTrack = e.clientX - trackRect.left - thumbOffsetX.current;
      
      const trackWidth = hTrack.offsetWidth;
      const scrollWidth = scrollContainer.scrollWidth;
      const clientWidth = scrollContainer.clientWidth;
      const maxScrollLeft = scrollWidth - clientWidth;
      const maxThumbLeft = trackWidth - horizontalThumb.width;

      // Процент позиции thumb'а
      const thumbPercent = Math.max(0, Math.min(1, thumbLeftInTrack / maxThumbLeft));
      scrollContainer.scrollLeft = thumbPercent * maxScrollLeft;
    };

    const handlePointerUp = () => {
      setIsDraggingHorizontal(false);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDraggingHorizontal, scrollContainerRef, horizontalThumb]);

  // ========== VERTICAL DRAG ==========
  const handleVerticalPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingVertical(true);
    
    // Захватываем pointer чтобы получать события даже за пределами окна
    e.currentTarget.setPointerCapture(e.pointerId);
    
    const vTrack = verticalTrackRef.current;
    if (!vTrack) return;
    
    const trackRect = vTrack.getBoundingClientRect();
    const thumbTopInTrack = verticalThumb.top;
    const thumbTopInViewport = trackRect.top + thumbTopInTrack;
    
    // Где внутри thumb'а кликнули (0 = верхний край, thumbHeight = нижний край)
    thumbOffsetY.current = e.clientY - thumbTopInViewport;
    dragStartY.current = e.clientY;
    dragStartScrollTop.current = scrollContainerRef.current?.scrollTop || 0;
  };

  useEffect(() => {
    if (!isDraggingVertical) return;

    const handlePointerMove = (e: PointerEvent) => {
      const scrollContainer = scrollContainerRef?.current;
      const vTrack = verticalTrackRef.current;
      if (!scrollContainer || !vTrack) return;

      const trackRect = vTrack.getBoundingClientRect();
      // Позиция курсора относительно трека минус offset внутри thumb'а
      const thumbTopInTrack = e.clientY - trackRect.top - thumbOffsetY.current;
      
      const trackHeight = vTrack.offsetHeight;
      const scrollHeight = scrollContainer.scrollHeight;
      const clientHeight = scrollContainer.clientHeight;
      const maxScrollTop = scrollHeight - clientHeight;
      const maxThumbTop = trackHeight - verticalThumb.height;

      // Процент позиции thumb'а
      const thumbPercent = Math.max(0, Math.min(1, thumbTopInTrack / maxThumbTop));
      scrollContainer.scrollTop = thumbPercent * maxScrollTop;
    };

    const handlePointerUp = () => {
      setIsDraggingVertical(false);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDraggingVertical, scrollContainerRef, verticalThumb]);

  return (
    <>
      {/* ========== ГОРИЗОНТАЛЬНЫЙ СКРОЛЛБАР ========== */}
      <div
        className="custom-scrollbar-horizontal"
        style={{
          position: 'fixed',
          bottom: '8px',
          left: `${leftOffset}px`, // От правого края сайдбара (строго от края)
          right: '8px', // 8px отступ справа (оставляем место для вертикального)
          height: '8px',
          zIndex: 1000,
          pointerEvents: 'auto',
        }}
      >
        {/* Track */}
        <div
          ref={horizontalTrackRef}
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.05)',
            borderRadius: '4px',
            position: 'relative',
            cursor: 'default',
          }}
          onClick={(e) => {
            // Клик по треку - прыжок к позиции
            const scrollContainer = scrollContainerRef?.current;
            const hTrack = horizontalTrackRef.current;
            if (!scrollContainer || !hTrack) return;

            const rect = hTrack.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const trackWidth = hTrack.offsetWidth;
            const scrollWidth = scrollContainer.scrollWidth;
            const clientWidth = scrollContainer.clientWidth;
            const maxScrollLeft = scrollWidth - clientWidth;

            const scrollPercent = clickX / trackWidth;
            scrollContainer.scrollLeft = scrollPercent * maxScrollLeft;
          }}
        >
          {/* Thumb */}
          <div
            style={{
              position: 'absolute',
              left: `${horizontalThumb.left}px`,
              top: 0,
              width: `${horizontalThumb.width}px`,
              height: '100%',
              backgroundColor: isDraggingHorizontal 
                ? 'rgba(0, 0, 0, 0.5)' 
                : isHoveringHorizontal 
                  ? 'rgba(0, 0, 0, 0.4)' 
                  : 'rgba(0, 0, 0, 0.3)',
              borderRadius: '4px',
              cursor: 'default',
              transition: isDraggingHorizontal ? 'none' : 'background-color 0.2s ease',
            }}
            onPointerDown={handleHorizontalPointerDown}
            onMouseEnter={() => setIsHoveringHorizontal(true)}
            onMouseLeave={() => setIsHoveringHorizontal(false)}
          />
        </div>
      </div>

      {/* ========== ВЕРТИКАЛЬНЫЙ СКРОЛЛБАР ========== */}
      <div
        className="custom-scrollbar-vertical"
        style={{
          position: 'fixed',
          top: `${topOffset + 8}px`, // От низа заголовков + 8px отступ
          right: '8px', // 8px отступ от правого края экрана
          bottom: '24px', // Оставляем место для горизонтального скроллбара (8px + 8px + 8px)
          width: '8px',
          zIndex: 1000,
          pointerEvents: 'auto',
        }}
      >
        {/* Track */}
        <div
          ref={verticalTrackRef}
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.05)',
            borderRadius: '4px',
            position: 'relative',
            cursor: 'default',
          }}
          onClick={(e) => {
            // Клик по треку - прыжок к позиции
            const scrollContainer = scrollContainerRef?.current;
            const vTrack = verticalTrackRef.current;
            if (!scrollContainer || !vTrack) return;

            const rect = vTrack.getBoundingClientRect();
            const clickY = e.clientY - rect.top;
            const trackHeight = vTrack.offsetHeight;
            const scrollHeight = scrollContainer.scrollHeight;
            const clientHeight = scrollContainer.clientHeight;
            const maxScrollTop = scrollHeight - clientHeight;

            const scrollPercent = clickY / trackHeight;
            scrollContainer.scrollTop = scrollPercent * maxScrollTop;
          }}
        >
          {/* Thumb */}
          <div
            style={{
              position: 'absolute',
              top: `${verticalThumb.top}px`,
              left: 0,
              height: `${verticalThumb.height}px`,
              width: '100%',
              backgroundColor: isDraggingVertical 
                ? 'rgba(0, 0, 0, 0.5)' 
                : isHoveringVertical 
                  ? 'rgba(0, 0, 0, 0.4)' 
                  : 'rgba(0, 0, 0, 0.3)',
              borderRadius: '4px',
              cursor: 'default',
              transition: isDraggingVertical ? 'none' : 'background-color 0.2s ease',
            }}
            onPointerDown={handleVerticalPointerDown}
            onMouseEnter={() => setIsHoveringVertical(true)}
            onMouseLeave={() => setIsHoveringVertical(false)}
          />
        </div>
      </div>
    </>
  );
}