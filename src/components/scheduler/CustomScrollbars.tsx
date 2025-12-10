import React, { useEffect, useRef, useState, useCallback } from 'react';

interface CustomScrollbarsProps {
  scrollRef: React.RefObject<HTMLDivElement>;
  horizontalOffset: number;
  verticalOffset: number;
  trackThickness?: number;
  thumbMinSize?: number;
  trackPadding?: number;
  rightPadding?: number;
  bottomPadding?: number;
}

export function CustomScrollbars({
  scrollRef,
  horizontalOffset,
  verticalOffset,
  trackThickness = 10,
  thumbMinSize = 24,
  trackPadding = 2,
  rightPadding = 8,
  bottomPadding = 8,
}: CustomScrollbarsProps) {
  const trackHRef = useRef<HTMLDivElement>(null);
  const thumbHRef = useRef<HTMLDivElement>(null);
  const trackVRef = useRef<HTMLDivElement>(null);
  const thumbVRef = useRef<HTMLDivElement>(null);

  const [showHorizontal, setShowHorizontal] = useState(false);
  const [showVertical, setShowVertical] = useState(false);

  // ============================================================
  // UPDATE THUMBS POSITIONS
  // ============================================================
  const updateThumbs = useCallback(() => {
    const wrap = scrollRef.current;
    if (!wrap) return;

    // HORIZONTAL
    if (trackHRef.current && thumbHRef.current) {
      const trackRect = trackHRef.current.getBoundingClientRect();
      const maxScrollLeft = Math.max(0, wrap.scrollWidth - wrap.clientWidth);
      const usableW = Math.max(1, trackRect.width - trackPadding * 2);
      
      const ratioH = wrap.clientWidth / wrap.scrollWidth;
      let thumbW = Math.max(thumbMinSize, usableW * ratioH);
      if (thumbW > usableW) thumbW = usableW;

      const scrollFractionX = maxScrollLeft === 0 ? 0 : wrap.scrollLeft / maxScrollLeft;
      const maxThumbLeft = usableW - thumbW;
      const thumbLeft = maxThumbLeft * scrollFractionX;

      thumbHRef.current.style.width = `${thumbW}px`;
      thumbHRef.current.style.transform = `translateX(${thumbLeft}px)`;
    }

    // VERTICAL
    if (trackVRef.current && thumbVRef.current) {
      const trackRect = trackVRef.current.getBoundingClientRect();
      const maxScrollTop = Math.max(0, wrap.scrollHeight - wrap.clientHeight);
      const usableH = Math.max(1, trackRect.height - trackPadding * 2);

      const ratioV = wrap.clientHeight / wrap.scrollHeight;
      let thumbH = Math.max(thumbMinSize, usableH * ratioV);
      if (thumbH > usableH) thumbH = usableH;

      const scrollFractionY = maxScrollTop === 0 ? 0 : wrap.scrollTop / maxScrollTop;
      const maxThumbTop = usableH - thumbH;
      const thumbTop = maxThumbTop * scrollFractionY;

      thumbVRef.current.style.height = `${thumbH}px`;
      thumbVRef.current.style.transform = `translateY(${thumbTop}px)`;
    }
  }, [scrollRef, trackPadding, thumbMinSize]);

  // ============================================================
  // REFRESH VISIBILITY
  // ============================================================
  const refreshVisibility = useCallback(() => {
    const wrap = scrollRef.current;
    if (!wrap) return;

    setShowHorizontal(wrap.scrollWidth > wrap.clientWidth);
    setShowVertical(wrap.scrollHeight > wrap.clientHeight);
    updateThumbs();
  }, [scrollRef, updateThumbs]);

  // ============================================================
  // HORIZONTAL DRAG (REACT HANDLERS)
  // ============================================================
  const handleHorizontalPointerDown = useCallback((ev: React.PointerEvent) => {
    ev.preventDefault();
    
    const wrap = scrollRef.current;
    const thumb = thumbHRef.current;
    const track = trackHRef.current;
    if (!wrap || !thumb || !track) return;

    console.log('🎯 HORIZONTAL drag start');

    // Захват указателя
    thumb.setPointerCapture(ev.pointerId);

    const startPointerX = ev.clientX;
    const startScrollLeft = wrap.scrollLeft;
    
    // Refresh metrics
    const maxScrollLeft = Math.max(0, wrap.scrollWidth - wrap.clientWidth);
    const trackRect = track.getBoundingClientRect();
    const usableW = Math.max(1, trackRect.width - trackPadding * 2);
    const thumbW = parseFloat(getComputedStyle(thumb).width) || thumb.getBoundingClientRect().width;
    const maxThumbLeft = Math.max(1, usableW - thumbW);

    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - startPointerX;
      const scrollDelta = (dx / maxThumbLeft) * maxScrollLeft;
      const newScroll = Math.max(0, Math.min(maxScrollLeft, Math.round(startScrollLeft + scrollDelta)));
      
      console.log('🚀 HORIZONTAL drag move:', { dx, newScroll });
      
      wrap.scrollLeft = newScroll;
      
      // Мгновенное обновление thumb
      const scrollFraction = maxScrollLeft === 0 ? 0 : newScroll / maxScrollLeft;
      const thumbPosition = maxThumbLeft * scrollFraction;
      thumb.style.transform = `translateX(${thumbPosition}px)`;
    };

    const onUp = () => {
      console.log('🏁 HORIZONTAL drag end');
      
      try { 
        thumb.releasePointerCapture(ev.pointerId); 
      } catch (err) {
        // Already released
      }

      thumb.removeEventListener('pointermove', onMove as any);
      thumb.removeEventListener('pointerup', onUp as any);
      thumb.removeEventListener('pointercancel', onUp as any);
    };

    thumb.addEventListener('pointermove', onMove as any);
    thumb.addEventListener('pointerup', onUp as any);
    thumb.addEventListener('pointercancel', onUp as any);
  }, [scrollRef, trackPadding]);

  // ============================================================
  // VERTICAL DRAG (REACT HANDLERS)
  // ============================================================
  const handleVerticalPointerDown = useCallback((ev: React.PointerEvent) => {
    ev.preventDefault();
    
    const wrap = scrollRef.current;
    const thumb = thumbVRef.current;
    const track = trackVRef.current;
    if (!wrap || !thumb || !track) return;

    console.log('🎯 VERTICAL drag start');

    thumb.setPointerCapture(ev.pointerId);

    const startPointerY = ev.clientY;
    const startScrollTop = wrap.scrollTop;
    
    const maxScrollTop = Math.max(0, wrap.scrollHeight - wrap.clientHeight);
    const trackRect = track.getBoundingClientRect();
    const usableH = Math.max(1, trackRect.height - trackPadding * 2);
    const thumbH = parseFloat(getComputedStyle(thumb).height) || thumb.getBoundingClientRect().height;
    const maxThumbTop = Math.max(1, usableH - thumbH);

    const onMove = (e: PointerEvent) => {
      const dy = e.clientY - startPointerY;
      const scrollDelta = (dy / maxThumbTop) * maxScrollTop;
      const newScroll = Math.max(0, Math.min(maxScrollTop, Math.round(startScrollTop + scrollDelta)));
      
      wrap.scrollTop = newScroll;
      
      const scrollFraction = maxScrollTop === 0 ? 0 : newScroll / maxScrollTop;
      const thumbPosition = maxThumbTop * scrollFraction;
      thumb.style.transform = `translateY(${thumbPosition}px)`;
    };

    const onUp = () => {
      console.log('🏁 VERTICAL drag end');
      
      try { 
        thumb.releasePointerCapture(ev.pointerId); 
      } catch (err) {
        // Already released
      }

      thumb.removeEventListener('pointermove', onMove as any);
      thumb.removeEventListener('pointerup', onUp as any);
      thumb.removeEventListener('pointercancel', onUp as any);
    };

    thumb.addEventListener('pointermove', onMove as any);
    thumb.addEventListener('pointerup', onUp as any);
    thumb.addEventListener('pointercancel', onUp as any);
  }, [scrollRef, trackPadding]);

  // ============================================================
  // CLICK ON TRACK (JUMP)
  // ============================================================
  const handleTrackHClick = (e: React.MouseEvent) => {
    if (!trackHRef.current || !scrollRef.current || e.target === thumbHRef.current) return;
    
    const rect = trackHRef.current.getBoundingClientRect();
    const usable = Math.max(1, rect.width - trackPadding * 2);
    const clickX = e.clientX - rect.left - trackPadding;
    const maxScroll = Math.max(0, scrollRef.current.scrollWidth - scrollRef.current.clientWidth);
    const ratio = clickX / usable;
    scrollRef.current.scrollLeft = Math.round(maxScroll * ratio);
    updateThumbs();
  };

  const handleTrackVClick = (e: React.MouseEvent) => {
    if (!trackVRef.current || !scrollRef.current || e.target === thumbVRef.current) return;
    
    const rect = trackVRef.current.getBoundingClientRect();
    const usable = Math.max(1, rect.height - trackPadding * 2);
    const clickY = e.clientY - rect.top - trackPadding;
    const maxScroll = Math.max(0, scrollRef.current.scrollHeight - scrollRef.current.clientHeight);
    const ratio = clickY / usable;
    scrollRef.current.scrollTop = Math.round(maxScroll * ratio);
    updateThumbs();
  };

  // ============================================================
  // SYNC WITH SCROLL & RESIZE
  // ============================================================
  useEffect(() => {
    const wrap = scrollRef.current;
    if (!wrap) return;

    wrap.addEventListener('scroll', updateThumbs, { passive: true });
    
    const handleResize = () => {
      requestAnimationFrame(refreshVisibility);
    };
    window.addEventListener('resize', handleResize);

    const ro = new ResizeObserver(() => updateThumbs());
    ro.observe(wrap);

    // Initial
    requestAnimationFrame(refreshVisibility);

    return () => {
      wrap.removeEventListener('scroll', updateThumbs);
      window.removeEventListener('resize', handleResize);
      ro.disconnect();
    };
  }, [scrollRef, updateThumbs, refreshVisibility]);

  return (
    <>
      {/* HORIZONTAL SCROLLBAR */}
      {showHorizontal && (
        <div
          ref={trackHRef}
          onClick={handleTrackHClick}
          style={{
            position: 'fixed',
            height: `${trackThickness}px`,
            left: `${horizontalOffset}px`,
            right: `${rightPadding}px`,
            bottom: `${bottomPadding}px`,
            background: 'rgba(0,0,0,0.05)',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            userSelect: 'none',
            zIndex: 999999,
            boxSizing: 'border-box',
            padding: `${trackPadding}px`,
            cursor: 'pointer',
            pointerEvents: 'auto',
          }}
        >
          <div
            ref={thumbHRef}
            onPointerDown={handleHorizontalPointerDown}
            style={{
              height: '100%',
              minWidth: `${thumbMinSize}px`,
              background: 'linear-gradient(90deg, #888, #444)',
              borderRadius: '6px',
              cursor: 'grab',
              transition: 'none',
              touchAction: 'none',
              WebkitUserDrag: 'none',
              userSelect: 'none',
            }}
          />
        </div>
      )}

      {/* VERTICAL SCROLLBAR */}
      {showVertical && (
        <div
          ref={trackVRef}
          onClick={handleTrackVClick}
          style={{
            position: 'fixed',
            width: `${trackThickness}px`,
            top: `${verticalOffset}px`,
            bottom: `${bottomPadding}px`,
            right: `${rightPadding}px`,
            background: 'rgba(0,0,0,0.05)',
            borderRadius: '6px',
            boxSizing: 'border-box',
            padding: `${trackPadding}px`,
            zIndex: 999999,
            userSelect: 'none',
            cursor: 'pointer',
            pointerEvents: 'auto',
          }}
        >
          <div
            ref={thumbVRef}
            onPointerDown={handleVerticalPointerDown}
            style={{
              width: '100%',
              minHeight: `${thumbMinSize}px`,
              background: 'linear-gradient(#888, #444)',
              borderRadius: '6px',
              cursor: 'grab',
              transition: 'none',
              touchAction: 'none',
              WebkitUserDrag: 'none',
              userSelect: 'none',
            }}
          />
        </div>
      )}
    </>
  );
}
