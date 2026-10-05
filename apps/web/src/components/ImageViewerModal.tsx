import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { cn } from "../lib/cn";

export interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  imageAlt: string;
  title?: string;
  subtitle?: string;
  ariaLabel?: string;
  onPrevious?: () => void;
  hasPrevious?: boolean;
  onNext?: () => void;
  hasNext?: boolean;
  minScale?: number;
  maxScale?: number;
  step?: number;
}

export function ImageViewerModal({
  isOpen,
  onClose,
  imageUrl,
  imageAlt,
  title,
  subtitle,
  ariaLabel,
  onPrevious,
  hasPrevious = false,
  onNext,
  hasNext = false,
  minScale = 1,
  maxScale = 5,
  step = 0.5,
}: ImageViewerModalProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [showControlsHint, setShowControlsHint] = useState(true);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const posStartRef = useRef({ x: 0, y: 0 });
  const touchDistanceRef = useRef<number | null>(null);

  // Reset scale and position when changing image or opening
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setIsDragging(false);
    }
  }, [imageUrl, isOpen]);

  const resetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const zoomIn = useCallback(() => {
    setScale((current) => Math.min(maxScale, +(current + step).toFixed(2)));
  }, [maxScale, step]);

  const zoomOut = useCallback(() => {
    setScale((current) => {
      const next = Math.max(minScale, +(current - step).toFixed(2));
      if (next === minScale) {
        setPosition({ x: 0, y: 0 });
      }
      return next;
    });
  }, [minScale, step]);

  const setZoomLevel = useCallback(
    (targetScale: number) => {
      const next = Math.min(maxScale, Math.max(minScale, targetScale));
      setScale(next);
      if (next === minScale) {
        setPosition({ x: 0, y: 0 });
      }
    },
    [maxScale, minScale],
  );

  // Handle double-click to toggle between 1x and 2.5x
  const handleDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (scale > 1) {
        resetZoom();
      } else {
        const container = containerRef.current;
        if (!container) {
          setScale(2.5);
          return;
        }
        const rect = container.getBoundingClientRect();
        const offsetX = event.clientX - (rect.left + rect.width / 2);
        const offsetY = event.clientY - (rect.top + rect.height / 2);
        const targetScale = 2.5;
        // Shift position towards the double clicked point
        setPosition({
          x: -offsetX * (targetScale - 1),
          y: -offsetY * (targetScale - 1),
        });
        setScale(targetScale);
      }
    },
    [resetZoom, scale],
  );

  // Handle mouse wheel zoom
  const handleWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const delta = -event.deltaY;
      const zoomFactor = delta > 0 ? 1.15 : 0.87;

      setScale((currentScale) => {
        let nextScale = currentScale * zoomFactor;
        if (nextScale > maxScale) nextScale = maxScale;
        if (nextScale < minScale) nextScale = minScale;
        nextScale = +nextScale.toFixed(2);

        if (nextScale === minScale) {
          setPosition({ x: 0, y: 0 });
          return nextScale;
        }

        const rect = container.getBoundingClientRect();
        const pointerX = event.clientX - (rect.left + rect.width / 2);
        const pointerY = event.clientY - (rect.top + rect.height / 2);

        // Adjust position so the zoom is centered around mouse pointer
        setPosition((currentPos) => ({
          x: pointerX - ((pointerX - currentPos.x) / currentScale) * nextScale,
          y: pointerY - ((pointerY - currentPos.y) / currentScale) * nextScale,
        }));

        return nextScale;
      });
    },
    [maxScale, minScale],
  );

  // Touch handlers for mobile pinch-to-zoom & pan
  const handleTouchStart = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (event.touches.length === 2 && event.touches[0] && event.touches[1]) {
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        const distance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY,
        );
        touchDistanceRef.current = distance;
      } else if (event.touches.length === 1 && event.touches[0]) {
        dragStartRef.current = {
          x: event.touches[0].clientX,
          y: event.touches[0].clientY,
        };
        posStartRef.current = { ...position };
      }
    },
    [position],
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (
        event.touches.length === 2 &&
        event.touches[0] &&
        event.touches[1] &&
        touchDistanceRef.current !== null
      ) {
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        const currentDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY,
        );
        const ratio = currentDistance / touchDistanceRef.current;
        setScale((current) => {
          const next = Math.min(
            maxScale,
            Math.max(minScale, +(current * ratio).toFixed(2)),
          );
          return next;
        });
        touchDistanceRef.current = currentDistance;
      } else if (event.touches.length === 1 && event.touches[0] && scale > 1) {
        const dx = event.touches[0].clientX - dragStartRef.current.x;
        const dy = event.touches[0].clientY - dragStartRef.current.y;
        setPosition({
          x: posStartRef.current.x + dx,
          y: posStartRef.current.y + dy,
        });
      }
    },
    [maxScale, minScale, scale],
  );

  const handleTouchEnd = useCallback(() => {
    touchDistanceRef.current = null;
    if (scale <= minScale) {
      setPosition({ x: 0, y: 0 });
    }
  }, [minScale, scale]);

  // Dragging / Panning handlers via pointer events
  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return; // only left click
      setIsDragging(true);
      dragStartRef.current = { x: event.clientX, y: event.clientY };
      posStartRef.current = { ...position };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [position],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      const dx = event.clientX - dragStartRef.current.x;
      const dy = event.clientY - dragStartRef.current.y;
      setPosition({
        x: posStartRef.current.x + dx,
        y: posStartRef.current.y + dy,
      });
    },
    [isDragging],
  );

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      setIsDragging(false);
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // ignore if not captured
      }
    },
    [isDragging],
  );

  // Keyboard navigation & shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "+" || event.key === "=") {
        zoomIn();
      } else if (event.key === "-" || event.key === "_") {
        zoomOut();
      } else if (event.key === "0" || event.key === "r" || event.key === "R") {
        resetZoom();
      } else if (event.key === "ArrowLeft") {
        if (scale === 1 && onPrevious && hasPrevious) {
          onPrevious();
        } else if (scale > 1) {
          setPosition((pos) => ({ ...pos, x: pos.x + 60 }));
        }
      } else if (event.key === "ArrowRight") {
        if (scale === 1 && onNext && hasNext) {
          onNext();
        } else if (scale > 1) {
          setPosition((pos) => ({ ...pos, x: pos.x - 60 }));
        }
      } else if (event.key === "ArrowUp" && scale > 1) {
        setPosition((pos) => ({ ...pos, y: pos.y + 60 }));
      } else if (event.key === "ArrowDown" && scale > 1) {
        setPosition((pos) => ({ ...pos, y: pos.y - 60 }));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    hasNext,
    hasPrevious,
    isOpen,
    onClose,
    onNext,
    onPrevious,
    resetZoom,
    scale,
    zoomIn,
    zoomOut,
  ]);

  if (!isOpen) return null;

  const percentage = Math.round(scale * 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || title || "Ảnh phóng to"}
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/92 backdrop-blur-md select-none touch-none animate-in fade-in duration-200"
    >
      {/* Top Bar */}
      <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {title && (
            <span className="truncate rounded-lg bg-white/10 px-3 py-1 text-sm font-bold text-white shadow-xs">
              {title}
            </span>
          )}
          {subtitle && (
            <span className="hidden truncate text-xs text-slate-300 sm:inline-block">
              {subtitle}
            </span>
          )}
        </div>

        {/* Center Help Hint */}
        {showControlsHint && (
          <div className="hidden items-center gap-2 rounded-full bg-white/5 px-3.5 py-1 text-xs text-slate-300 md:flex">
            <span>
              Cuộn chuột hoặc click đúp để phóng to • Kéo để di chuyển
            </span>
            <button
              type="button"
              onClick={() => setShowControlsHint(false)}
              className="text-slate-400 hover:text-white"
              aria-label="Ẩn gợi ý"
            >
              ×
            </button>
          </div>
        )}

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="inline-flex size-10 items-center justify-center rounded-xl bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          aria-label="Đóng ảnh phóng to (Esc)"
          title="Đóng (Esc)"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      {/* Main Image Viewport */}
      <main
        ref={containerRef}
        className={cn(
          "relative flex flex-1 items-center justify-center overflow-hidden",
          scale > 1
            ? isDragging
              ? "cursor-grabbing"
              : "cursor-grab"
            : "cursor-zoom-in",
        )}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
      >
        {/* Navigation Previous Button */}
        {hasPrevious && onPrevious && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPrevious();
            }}
            className="absolute left-3 sm:left-6 z-20 inline-flex size-11 sm:size-13 items-center justify-center rounded-full bg-slate-900/60 text-white backdrop-blur-md transition-all hover:bg-slate-900/90 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            aria-label="Câu trước (Phím ←)"
            title="Câu trước (Phím ←)"
          >
            <ChevronLeft size={28} aria-hidden="true" />
          </button>
        )}

        {/* Navigation Next Button */}
        {hasNext && onNext && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            className="absolute right-3 sm:right-6 z-20 inline-flex size-11 sm:size-13 items-center justify-center rounded-full bg-slate-900/60 text-white backdrop-blur-md transition-all hover:bg-slate-900/90 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            aria-label="Câu sau (Phím →)"
            title="Câu sau (Phím →)"
          >
            <ChevronRight size={28} aria-hidden="true" />
          </button>
        )}

        {/* Transformed Image Container */}
        <div
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
            transition: isDragging ? "none" : "transform 180ms ease-out",
            transformOrigin: "center center",
          }}
          className="flex items-center justify-center will-change-transform"
        >
          <img
            ref={imageRef}
            src={imageUrl}
            alt={imageAlt}
            draggable={false}
            className="max-h-[78vh] max-w-[88vw] rounded-xl bg-white object-contain shadow-2xl transition-shadow select-none pointer-events-none sm:max-h-[82vh] sm:max-w-[90vw]"
          />
        </div>
      </main>

      {/* Floating Bottom Toolbar */}
      <footer className="relative z-10 flex h-16 shrink-0 items-center justify-center px-4">
        <div className="flex items-center gap-1 sm:gap-2 rounded-2xl border border-white/15 bg-slate-900/80 px-3 py-1.5 shadow-2xl backdrop-blur-lg">
          {/* Zoom Out Button */}
          <button
            type="button"
            onClick={zoomOut}
            disabled={scale <= minScale}
            className="inline-flex size-9 items-center justify-center rounded-xl text-white transition-colors hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label="Thu nhỏ (-)"
            title="Thu nhỏ (-)"
          >
            <ZoomOut size={18} aria-hidden="true" />
          </button>

          {/* Zoom Percentage / Quick Toggle Button */}
          <button
            type="button"
            onClick={() => (scale === 1 ? setZoomLevel(2) : resetZoom())}
            className="min-w-16 rounded-lg px-2 py-1 font-mono text-xs font-bold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label={`Tỉ lệ phóng to hiện tại: ${percentage}%. Nhấp để chuyển đổi.`}
            title="Nhấp để chuyển đổi 100% / 200%"
          >
            {percentage}%
          </button>

          {/* Zoom In Button */}
          <button
            type="button"
            onClick={zoomIn}
            disabled={scale >= maxScale}
            className="inline-flex size-9 items-center justify-center rounded-xl text-white transition-colors hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label="Phóng to (+)"
            title="Phóng to (+)"
          >
            <ZoomIn size={18} aria-hidden="true" />
          </button>

          <div className="mx-1 h-5 w-px bg-white/20" />

          {/* Reset / Fit to Screen */}
          <button
            type="button"
            onClick={resetZoom}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
              scale === 1
                ? "bg-white/10 text-white/70"
                : "bg-primary text-white hover:bg-primary-strong",
            )}
            aria-label="Khôi phục vừa màn hình (0 hoặc R)"
            title="Khôi phục vừa màn hình (0 hoặc R)"
          >
            <RotateCcw size={14} aria-hidden="true" />
            <span className="hidden sm:inline">Vừa khung</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
