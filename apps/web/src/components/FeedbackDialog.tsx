import { CheckCircle2, MessageSquareText, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { createFeedback } from "../lib/api";
import { Button } from "./ui/Button";

export function FeedbackDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { session } = useAuth();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [category, setCategory] = useState("Góp ý tính năng");
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open, submitting]);

  if (!open) return null;

  const submit = async () => {
    if (!session || detail.trim().length < 10) return;
    setSubmitting(true);
    setError("");
    try {
      await createFeedback(session.idToken, { title: category, detail });
      setSent(true);
      setDetail("");
    } catch {
      setError("Chưa thể gửi góp ý. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !submitting) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        tabIndex={-1}
        className="w-full max-w-lg rounded-3xl border border-border bg-white p-5 shadow-panel outline-none sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
              <MessageSquareText size={21} aria-hidden="true" />
            </span>
            <h2
              id="feedback-title"
              className="mt-4 font-heading text-2xl font-bold"
            >
              Góp ý cho OnThiLab
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="grid size-11 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
            aria-label="Đóng góp ý"
          >
            <X aria-hidden="true" />
          </button>
        </div>

        {sent ? (
          <div className="py-8 text-center" role="status">
            <CheckCircle2 className="mx-auto text-emerald-600" size={42} />
            <p className="mt-4 font-heading text-xl font-bold">Đã gửi góp ý</p>
            <Button className="mt-6" onClick={onClose}>
              Đóng
            </Button>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Loại góp ý
              </span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="input-base w-full"
              >
                <option>Góp ý tính năng</option>
                <option>Báo lỗi hệ thống</option>
                <option>Khác</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Nội dung
              </span>
              <textarea
                value={detail}
                onChange={(event) => setDetail(event.target.value)}
                maxLength={2000}
                rows={5}
                className="input-base w-full resize-y"
                placeholder="Mô tả góp ý của bạn"
              />
            </label>
            {error && (
              <p role="alert" className="text-sm font-semibold text-red-700">
                {error}
              </p>
            )}
            <Button
              className="w-full"
              onClick={() => void submit()}
              disabled={submitting || detail.trim().length < 10}
            >
              {submitting ? "Đang gửi..." : "Gửi góp ý"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
