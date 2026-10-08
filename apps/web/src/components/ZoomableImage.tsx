import { Maximize2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cn } from "../lib/cn";
import {
  MAX_SCALE,
  MIN_SCALE,
  ZOOM_STEP,
  clampOffset,
  clampScale,
  initialZoom,
  panBy,
  zoomAt,
  type Point,
  type ZoomState,
} from "../lib/zoom-math";

export interface ZoomableImageProps {
  imageUrl: string;
  imageAlt: string;
  /** Question number, used for the accessible names. */
  order?: number;
  /**
   * Zoom level to start at. The parent keeps the last level so a student who
   * zoomed question 1 does not have to zoom again on every following question.
   */
  initialScale?: number;
  onScaleChange?: (scale: number) => void;
  /** Optional escape hatch to the full-screen viewer. */
  onOpenFullscreen?: () => void;
  className?: string;
}

const KEY_PAN_PX = 60;
const WHEEL_ZOOM_FACTOR = 1.15;

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * A question picture that zooms inside its own frame (like a Facebook photo)
 * instead of opening a full-screen viewer, so a student can keep answering
 * while reading small text.
 *
 * - +/- buttons zoom around the top-left corner of what is visible (question
 *   text is at the top-left of these pictures); a double click or a pinch
 *   zooms around the pointer; Ctrl/Cmd + wheel zooms too, while a plain wheel
 *   keeps scrolling the page.
 * - Drag (mouse or touch) pans once zoomed; the picture never leaves the frame.
 * - The frame is focusable: + / - / 0 and the arrow keys work when focused.
 *
 * Mount it with `key={imageUrl}` so each question starts at the top-left.
 */
export function ZoomableImage({
  imageUrl,
  imageAlt,
  order,
  initialScale = MIN_SCALE,
  onScaleChange,
  onOpenFullscreen,
  className,
}: ZoomableImageProps) {
  // Start from the top-left, where the question text is.
  const [zoom, setZoom] = useState<ZoomState>(() => ({
    ...initialZoom,
    scale: clampScale(initialScale),
  }));
  const [interacting, setInteracting] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const pinchDistance = useRef<number | null>(null);

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    const image = imageRef.current;
    if (!viewport || !image) return null;
    return {
      viewport: { width: viewport.clientWidth, height: viewport.clientHeight },
      content: { width: image.offsetWidth, height: image.offsetHeight },
    };
  }, []);

  const toLocal = useCallback((clientX: number, clientY: number): Point => {
    const viewport = viewportRef.current;
    if (!viewport) return { x: 0, y: 0 };
    const rect = viewport.getBoundingClientRect();
    return {
      x: clientX - rect.left - viewport.clientLeft,
      y: clientY - rect.top - viewport.clientTop,
    };
  }, []);

  const zoomTo = useCallback(
    (nextScale: number, anchor: Point = { x: 0, y: 0 }) => {
      const sizes = measure();
      if (!sizes) return;
      setZoom((current) =>
        zoomAt(current, nextScale, anchor, sizes.content, sizes.viewport),
      );
    },
    [measure],
  );

  const onScaleChangeRef = useRef(onScaleChange);
  onScaleChangeRef.current = onScaleChange;
  useEffect(() => {
    onScaleChangeRef.current?.(zoom.scale);
  }, [zoom.scale]);

  const reset = useCallback(() => setZoom(initialZoom), []);
  // Step relative to the latest state, so quick repeated clicks or key
  // presses each count.
  const stepZoom = useCallback(
    (delta: number) => {
      const sizes = measure();
      if (!sizes) return;
      setZoom((current) =>
        zoomAt(
          current,
          current.scale + delta,
          { x: 0, y: 0 },
          sizes.content,
          sizes.viewport,
        ),
      );
    },
    [measure],
  );
  const zoomIn = useCallback(() => stepZoom(ZOOM_STEP), [stepZoom]);
  const zoomOut = useCallback(() => stepZoom(-ZOOM_STEP), [stepZoom]);

  // React registers wheel listeners as passive, so preventDefault (needed to
  // stop the browser zooming the whole page on Ctrl + wheel) must be native.
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const sizes = measure();
      if (!sizes) return;
      const anchor = toLocal(event.clientX, event.clientY);
      const factor =
        event.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR;
      setZoom((current) =>
        zoomAt(
          current,
          current.scale * factor,
          anchor,
          sizes.content,
          sizes.viewport,
        ),
      );
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [measure, toLocal]);

  // Keep the picture inside the frame when the layout changes (window resize,
  // the image finishing loading).
  useEffect(() => {
    const element = viewportRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const sizes = measure();
      if (!sizes) return;
      setZoom((current) => {
        const offset = clampOffset(
          current.offset,
          sizes.content,
          sizes.viewport,
          current.scale,
        );
        return offset.x === current.offset.x && offset.y === current.offset.y
          ? current
          : { ...current, offset };
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [measure]);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (pointers.current.size === 2) {
      const [first, second] = [...pointers.current.values()];
      pinchDistance.current = first && second ? distance(first, second) : null;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setInteracting(true);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const next = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, next);
    const sizes = measure();
    if (!sizes) return;

    if (pointers.current.size === 2) {
      const [first, second] = [...pointers.current.values()];
      if (!first || !second) return;
      const current = distance(first, second);
      if (pinchDistance.current) {
        const ratio = current / pinchDistance.current;
        const middle = toLocal(
          (first.x + second.x) / 2,
          (first.y + second.y) / 2,
        );
        setZoom((state) =>
          zoomAt(
            state,
            state.scale * ratio,
            middle,
            sizes.content,
            sizes.viewport,
          ),
        );
      }
      pinchDistance.current = current;
    } else if (pointers.current.size === 1) {
      const delta = { x: next.x - previous.x, y: next.y - previous.y };
      setZoom((state) =>
        state.scale > MIN_SCALE
          ? panBy(state, delta, sizes.content, sizes.viewport)
          : state,
      );
    }
  }

  function onPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchDistance.current = null;
    if (pointers.current.size === 0) setInteracting(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // The pointer was not captured (e.g. the gesture was cancelled).
    }
  }

  function onDoubleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (zoom.scale > MIN_SCALE) {
      reset();
    } else {
      zoomTo(2, toLocal(event.clientX, event.clientY));
    }
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const sizes = measure();
    const pan = (dx: number, dy: number) => {
      if (zoom.scale <= MIN_SCALE || !sizes) return false;
      setZoom((state) =>
        panBy(state, { x: dx, y: dy }, sizes.content, sizes.viewport),
      );
      return true;
    };
    let handled = true;
    switch (event.key) {
      case "+":
      case "=":
        zoomIn();
        break;
      case "-":
      case "_":
        zoomOut();
        break;
      case "0":
        reset();
        break;
      case "ArrowLeft":
        handled = pan(KEY_PAN_PX, 0);
        break;
      case "ArrowRight":
        handled = pan(-KEY_PAN_PX, 0);
        break;
      case "ArrowUp":
        handled = pan(0, KEY_PAN_PX);
        break;
      case "ArrowDown":
        handled = pan(0, -KEY_PAN_PX);
        break;
      default:
        handled = false;
    }
    if (handled) event.preventDefault();
  }

  const percentage = Math.round(zoom.scale * 100);
  const questionName = order ? `câu ${order}` : "câu hỏi";
  const zoomed = zoom.scale > MIN_SCALE;

  return (
    <div
      ref={viewportRef}
      role="group"
      tabIndex={0}
      aria-label={`Ảnh ${questionName}. Dùng nút + và − để phóng to, kéo để di chuyển.`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      style={{ touchAction: zoomed ? "none" : "pan-y" }}
      className={cn(
        "relative w-full select-none overflow-hidden rounded-xl border border-slate-200 bg-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/30",
        zoomed ? (interacting ? "cursor-grabbing" : "cursor-grab") : "",
        className,
      )}
    >
      <img
        ref={imageRef}
        src={imageUrl}
        alt={imageAlt}
        draggable={false}
        width="1200"
        height="520"
        style={{
          transform: `translate3d(${zoom.offset.x}px, ${zoom.offset.y}px, 0) scale(${zoom.scale})`,
          transformOrigin: "0 0",
          transition: interacting ? "none" : "transform 120ms ease-out",
        }}
        className="block h-auto max-h-[48vh] w-full object-contain will-change-transform sm:max-h-[52vh]"
      />

      <div
        className="absolute bottom-2.5 right-2.5 flex items-center gap-0.5 rounded-xl bg-slate-950/80 p-1 text-white shadow-sm backdrop-blur-md"
        onPointerDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        <ToolbarButton
          label="Thu nhỏ ảnh"
          onClick={zoomOut}
          disabled={zoom.scale <= MIN_SCALE}
        >
          <ZoomOut size={18} aria-hidden="true" />
        </ToolbarButton>
        <button
          type="button"
          onClick={() => (zoomed ? reset() : zoomTo(2))}
          className="min-w-11 rounded-lg px-1 py-1 text-center font-mono sm:min-w-12 sm:px-1.5 text-xs font-bold tabular-nums transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          aria-label={`Mức phóng to ${percentage}%. Nhấn để đổi giữa 100% và 200%.`}
          title="Nhấn để đổi giữa 100% và 200%. Nhấp đúp hoặc Ctrl + cuộn chuột cũng phóng to."
        >
          {percentage}%
        </button>
        <ToolbarButton
          label="Phóng to ảnh"
          onClick={zoomIn}
          disabled={zoom.scale >= MAX_SCALE}
        >
          <ZoomIn size={18} aria-hidden="true" />
        </ToolbarButton>
        {zoomed && (
          <ToolbarButton label="Vừa khung" onClick={reset}>
            <RotateCcw size={16} aria-hidden="true" />
          </ToolbarButton>
        )}
        {onOpenFullscreen && (
          <>
            <span className="mx-0.5 h-5 w-px bg-white/25" aria-hidden="true" />
            <ToolbarButton
              label={`Mở toàn màn hình ảnh ${questionName}`}
              onClick={onOpenFullscreen}
            >
              <Maximize2 size={16} aria-hidden="true" />
            </ToolbarButton>
          </>
        )}
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex size-8 items-center justify-center rounded-lg transition-colors sm:size-9 hover:bg-white/15 disabled:opacity-35 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
    >
      {children}
    </button>
  );
}
