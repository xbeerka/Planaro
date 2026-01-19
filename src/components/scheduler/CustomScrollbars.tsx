import React, { useState, useRef } from "react";

interface CustomScrollbarsProps {
  scrollRef: React.RefObject<HTMLDivElement>;
  scrollTop: number;
  scrollLeft: number;
  scrollHeight: number;
  scrollWidth: number;
  clientHeight: number;
  clientWidth: number;
  verticalTopOffset?: number;
  horizontalLeftOffset?: number;
  rightOffset?: number; // ✨ Отступ справа (для Right Panel)
  isModalOpen?: boolean; // ✨ Новый проп для блокировки при открытом модальном окне
  sidebarCollapsed?: boolean; // ✨ Для адаптации к ширине сайдбара
}

export const CustomScrollbars = ({
  scrollRef,
  scrollTop,
  scrollLeft,
  scrollHeight,
  scrollWidth,
  clientHeight,
  clientWidth,
  verticalTopOffset = 0,
  horizontalLeftOffset = 0,
  rightOffset = 0,
  isModalOpen = false, // ✨ По умолчанию модальное окно закрыто
  sidebarCollapsed = false, // ✨ По умолчанию сайдбар не свернут
}: CustomScrollbarsProps) => {
  const [isDraggingV, setIsDraggingV] = useState(false);
  const [isDraggingH, setIsDraggingH] = useState(false);
  const [isHoveringV, setIsHoveringV] = useState(false);
  const [isHoveringH, setIsHoveringH] = useState(false);
  const startPosRef = useRef({
    x: 0,
    y: 0,
    scrollTop: 0,
    scrollLeft: 0,
  });
  const verticalThumbRef = useRef<HTMLDivElement>(null);
  const horizontalThumbRef = useRef<HTMLDivElement>(null);

  // Отступы для скроллбаров
  const scrollbarThumbOffset = 8; // Отступ от края экрана до скроллбара
  const scrollbarThickness = 10; // Толщина скроллбара
  const verticalBottomOffset =
    scrollbarThumbOffset * 2 + scrollbarThickness; // (8*2)+10 = 26px

  // Vertical Bar Logic (с учетом нижнего отступа)
  const trackHeightAdjusted = Math.max(
    0,
    clientHeight - verticalTopOffset - verticalBottomOffset,
  );
  const showVerticalAdjusted =
    scrollHeight > clientHeight && trackHeightAdjusted > 0;
  const thumbHeightAdjusted =
    scrollHeight > 0
      ? Math.max(
          30,
          (clientHeight / scrollHeight) * trackHeightAdjusted,
        )
      : 0;

  const maxScrollTopAdjusted = Math.max(
    0,
    scrollHeight - clientHeight,
  );
  const maxThumbTopAdjusted = Math.max(
    0,
    trackHeightAdjusted - thumbHeightAdjusted,
  );
  const thumbTopAdjusted =
    maxScrollTopAdjusted > 0
      ? (scrollTop / maxScrollTopAdjusted) * maxThumbTopAdjusted
      : 0;

  // Horizontal Bar Logic
  const horizontalRightOffset = scrollbarThumbOffset + rightOffset; // Отступ справа + rightOffset
  const trackWidth = Math.max(
    0,
    clientWidth - horizontalLeftOffset - horizontalRightOffset,
  );
  const showHorizontal =
    scrollWidth > clientWidth && trackWidth > 0;

  // Вычисление ширины thumb: пропорция видимой части к общему контенту
  const thumbWidth =
    scrollWidth > 0
      ? Math.max(30, (clientWidth / scrollWidth) * trackWidth)
      : 0;

  const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);
  const maxThumbLeft = Math.max(0, trackWidth - thumbWidth);
  const thumbLeft =
    maxScrollLeft > 0
      ? (scrollLeft / maxScrollLeft) * maxThumbLeft
      : 0;

  // Drag Handlers с использованием Pointer Events для работы за пределами окна
  const onDragStartV = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Захватываем pointer для отслеживания за пределами окна
    if (verticalThumbRef.current) {
      verticalThumbRef.current.setPointerCapture(e.pointerId);
    }

    setIsDraggingV(true);
    startPosRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollTop: scrollTop,
      scrollLeft: scrollLeft,
    };
    document.body.style.userSelect = "none";
  };

  const onDragStartH = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Захватываем pointer для отслеживания за пределами окна
    if (horizontalThumbRef.current) {
      horizontalThumbRef.current.setPointerCapture(e.pointerId);
    }

    setIsDraggingH(true);
    startPosRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollTop: scrollTop,
      scrollLeft: scrollLeft,
    };
    document.body.style.userSelect = "none";
  };

  const onPointerMoveV = (e: React.PointerEvent) => {
    if (!isDraggingV || !scrollRef.current) return;

    const deltaY = e.clientY - startPosRef.current.y;
    if (maxThumbTopAdjusted > 0) {
      const deltaScroll =
        (deltaY / maxThumbTopAdjusted) * maxScrollTopAdjusted;
      scrollRef.current.scrollTop = Math.min(
        maxScrollTopAdjusted,
        Math.max(
          0,
          startPosRef.current.scrollTop + deltaScroll,
        ),
      );
    }
  };

  const onPointerMoveH = (e: React.PointerEvent) => {
    if (!isDraggingH || !scrollRef.current) return;

    const deltaX = e.clientX - startPosRef.current.x;
    if (maxThumbLeft > 0) {
      const deltaScroll =
        (deltaX / maxThumbLeft) * maxScrollLeft;
      scrollRef.current.scrollLeft = Math.min(
        maxScrollLeft,
        Math.max(
          0,
          startPosRef.current.scrollLeft + deltaScroll,
        ),
      );
    }
  };

  const onPointerUpV = (e: React.PointerEvent) => {
    if (verticalThumbRef.current) {
      verticalThumbRef.current.releasePointerCapture(
        e.pointerId,
      );
    }
    setIsDraggingV(false);
    setIsHoveringV(false); // Сбрасываем hover при отпускании
    document.body.style.userSelect = "";
  };

  const onPointerUpH = (e: React.PointerEvent) => {
    if (horizontalThumbRef.current) {
      horizontalThumbRef.current.releasePointerCapture(
        e.pointerId,
      );
    }
    setIsDraggingH(false);
    setIsHoveringH(false); // Сбрасываем hover при отпускании
    document.body.style.userSelect = "";
  };

  // Обработчики для отмены drag (когда курсор покидает окно или теряется capture)
  const onPointerCancelV = () => {
    setIsDraggingV(false);
    setIsHoveringV(false);
    document.body.style.userSelect = "";
  };

  const onPointerCancelH = () => {
    setIsDraggingH(false);
    setIsHoveringH(false);
    document.body.style.userSelect = "";
  };

  const onLostPointerCaptureV = () => {
    setIsDraggingV(false);
    setIsHoveringV(false);
    document.body.style.userSelect = "";
  };

  const onLostPointerCaptureH = () => {
    setIsDraggingH(false);
    setIsHoveringH(false);
    document.body.style.userSelect = "";
  };

  return (
    <>
      {showVerticalAdjusted && (
        <div
          className="custom-scrollbar-vertical"
          style={{
            position: "fixed",
            top: verticalTopOffset,
            right: rightOffset, // ✨ Сдвигаем влево при открытом Right Panel
            bottom: verticalBottomOffset, // Отступ снизу: (8*2)+10 = 26px
            width:
              scrollbarThickness + scrollbarThumbOffset * 2, // Область клика
            zIndex: 4999, // ✅ Ниже чем модальные окна (z-[5000])
            pointerEvents: isModalOpen ? "none" : "auto", // ✨ Блокируем при открытом модальном окне
            opacity: isModalOpen ? 0.3 : 1, // ✨ Делаем полупрозрачным при блокировке
            transition: "opacity 0.2s ease, right 0.2s ease-in-out", // ✨ Анимация сдвига
          }}
        >
          {/* Track background for better visibility if needed */}
          {/* <div className="absolute inset-0 bg-gray-100 opacity-0 hover:opacity-100 transition-opacity" /> */}

          <div
            ref={verticalThumbRef}
            style={{
              position: "absolute",
              top: thumbTopAdjusted,
              right: scrollbarThumbOffset,
              width: scrollbarThickness,
              height: thumbHeightAdjusted,
              backgroundColor:
                isDraggingV || isHoveringV
                  ? "#00000060"
                  : "#00000030",
              borderRadius: scrollbarThickness / 2,
              cursor: "pointer",
            }}
            onPointerDown={onDragStartV}
            onPointerMove={onPointerMoveV}
            onPointerUp={onPointerUpV}
            onPointerEnter={() => setIsHoveringV(true)}
            onPointerLeave={() => setIsHoveringV(false)}
            onPointerCancel={onPointerCancelV}
            onLostPointerCapture={onLostPointerCaptureV}
          />
        </div>
      )}

      {showHorizontal && (
        <div
          className="custom-scrollbar-horizontal"
          style={{
            position: "fixed",
            left: horizontalLeftOffset,
            bottom: 0,
            width: trackWidth,
            height:
              scrollbarThickness + scrollbarThumbOffset * 2, // Область клика
            zIndex: 4999, // ✅ Ниже чем модальные окна (z-[5000])
            pointerEvents: isModalOpen ? "none" : "auto", // ✨ Блокируем при открытом модальном окне
            opacity: isModalOpen ? 0.3 : 1, // ✨ Делаем полупрозрачным при блокировке
            transition: "opacity 0.2s ease, width 0.2s ease-in-out", // ✨ Анимация ширины
          }}
        >
          <div
            ref={horizontalThumbRef}
            style={{
              position: "absolute",
              left: thumbLeft,
              bottom: scrollbarThumbOffset,
              height: scrollbarThickness,
              width: thumbWidth,
              backgroundColor:
                isDraggingH || isHoveringH
                  ? "#00000060"
                  : "#00000030",
              borderRadius: scrollbarThickness / 2,
              cursor: "pointer",
            }}
            onPointerDown={onDragStartH}
            onPointerMove={onPointerMoveH}
            onPointerUp={onPointerUpH}
            onPointerEnter={() => setIsHoveringH(true)}
            onPointerLeave={() => setIsHoveringH(false)}
            onPointerCancel={onPointerCancelH}
            onLostPointerCapture={onLostPointerCaptureH}
          />
        </div>
      )}
    </>
  );
};