import { Maximize2 } from "lucide-react";
import { ZoomableImage } from "./ZoomableImage";

export interface QuestionContentProps {
  presentationMode: "image" | "text";
  imageUrl: string;
  imageAlt: string;
  textContent?: string | null;
  options?: string[] | null;
  showOptions?: boolean;
  onExpandImage?: () => void;
  /**
   * Zoom inside the picture frame instead of opening a full-screen viewer.
   * `onExpandImage` then becomes an optional full-screen button in the toolbar.
   */
  inlineZoom?: boolean;
  /** Inline zoom level to start at, and a callback to remember changes. */
  initialZoomScale?: number;
  onZoomScaleChange?: (scale: number) => void;
  className?: string;
  order?: number;
}

export function QuestionContent({
  presentationMode,
  imageUrl,
  imageAlt,
  textContent,
  options,
  showOptions = true,
  onExpandImage,
  inlineZoom = false,
  initialZoomScale,
  onZoomScaleChange,
  className = "",
  order,
}: QuestionContentProps) {
  if (presentationMode === "text" && textContent) {
    return (
      <div className={`prose prose-slate max-w-none text-base ${className}`}>
        {/* Simple rendering for now, could be markdown or html depending on OCR output format */}
        <p className="whitespace-pre-wrap">{textContent}</p>
        {showOptions && options && options.length > 0 && (
          <ol className="mt-5 space-y-2 not-prose">
            {options.map((option, index) => (
              <li
                key={`${index}-${option}`}
                className="flex gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-700"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-sm font-bold text-primary">
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="whitespace-pre-wrap pt-0.5">{option}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  }

  if (inlineZoom) {
    return (
      <ZoomableImage
        key={imageUrl}
        imageUrl={imageUrl}
        imageAlt={imageAlt}
        order={order}
        initialScale={initialZoomScale}
        onScaleChange={onZoomScaleChange}
        onOpenFullscreen={onExpandImage}
        className={className}
      />
    );
  }

  // Fallback to Image
  const imgContent = (
    <>
      <img
        src={imageUrl}
        alt={imageAlt}
        className="h-auto max-h-[48vh] w-full object-contain sm:max-h-[52vh]"
        width="1200"
        height="520"
      />
      {onExpandImage && (
        <span className="absolute bottom-2.5 right-2.5 inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-slate-950/80 px-2.5 py-1 text-xs font-semibold text-white shadow-sm backdrop-blur-md transition-all sm:opacity-85 sm:group-hover:opacity-100 sm:group-hover:scale-105 sm:group-focus-visible:opacity-100">
          <Maximize2 size={14} aria-hidden="true" />
          Phóng to
        </span>
      )}
    </>
  );

  if (onExpandImage) {
    return (
      <button
        type="button"
        onClick={onExpandImage}
        className={`group relative block w-full cursor-zoom-in overflow-hidden rounded-xl border border-slate-200 bg-white transition-all hover:border-primary/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20 ${className}`}
        aria-label={order ? `Phóng to ảnh câu ${order}` : "Phóng to ảnh"}
        title="Nhấp để phóng to chi tiết"
      >
        {imgContent}
      </button>
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-xl border border-slate-200 bg-white ${className}`}
    >
      {imgContent}
    </div>
  );
}
