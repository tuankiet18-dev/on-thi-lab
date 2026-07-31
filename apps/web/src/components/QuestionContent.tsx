import { Maximize2 } from "lucide-react";

export interface QuestionContentProps {
  presentationMode: "image" | "text";
  imageUrl: string;
  imageAlt: string;
  textContent?: string | null;
  options?: string[] | null;
  onExpandImage?: () => void;
  className?: string;
  order?: number;
}

export function QuestionContent({
  presentationMode,
  imageUrl,
  imageAlt,
  textContent,
  options,
  onExpandImage,
  className = "",
  order,
}: QuestionContentProps) {
  if (presentationMode === "text" && textContent) {
    return (
      <div className={`prose prose-slate max-w-none text-base ${className}`}>
        {/* Simple rendering for now, could be markdown or html depending on OCR output format */}
        <p className="whitespace-pre-wrap">{textContent}</p>
        {options && options.length > 0 && (
          <ul className="mt-4 list-[upper-alpha] pl-5 space-y-2">
            {options.map((opt, i) => (
              <li key={i} className="pl-1 marker:font-bold">
                {opt}
              </li>
            ))}
          </ul>
        )}
      </div>
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
        <span className="absolute bottom-2 right-2 inline-flex min-h-10 items-center gap-2 rounded-lg bg-slate-950/75 px-3 text-xs font-semibold text-white backdrop-blur-sm sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">
          <Maximize2 size={15} aria-hidden="true" />
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
        className={`group relative block w-full cursor-zoom-in overflow-hidden rounded-xl border border-slate-200 bg-white focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20 ${className}`}
        aria-label={`Phóng to ảnh câu hỏi ${order ?? ""}`}
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
