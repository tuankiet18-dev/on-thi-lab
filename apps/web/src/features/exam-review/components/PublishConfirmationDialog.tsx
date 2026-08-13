import type { DraftExamReview } from "@onthilab/contracts";
import { LoaderCircle, Rocket } from "lucide-react";
import { Button } from "../../../components/ui/Button";

type PublishConfirmationDialogProps = {
  onClose: () => void;
  onConfirm: () => void;
  publishing: boolean;
  review: DraftExamReview;
};

export function PublishConfirmationDialog({
  onClose,
  onConfirm,
  publishing,
  review,
}: PublishConfirmationDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !publishing) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-title"
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-modal sm:p-7"
      >
        <span className="grid size-12 place-items-center rounded-xl bg-blue-50 text-primary">
          <Rocket size={23} aria-hidden="true" />
        </span>
        <h2 id="publish-title" className="mt-5 font-heading text-2xl font-bold">
          Xuất bản đề {review.examCode}?
        </h2>
        <p className="mt-2 leading-7 text-slate-600">
          Sau khi xác nhận, đề sẽ xuất hiện trong kho thi và sinh viên có thể
          bắt đầu làm bài ngay.
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm">
          <div>
            <dt className="text-slate-500">Số câu</dt>
            <dd className="mt-1 font-bold">{review.questionCount} câu</dd>
          </div>
          <div>
            <dt className="text-slate-500">Thời gian</dt>
            <dd className="mt-1 font-bold">{review.durationMinutes} phút</dd>
          </div>
          <div>
            <dt className="text-slate-500">Campus</dt>
            <dd className="mt-1 font-bold">{review.campus.name}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Đáp án</dt>
            <dd className="mt-1 font-bold text-emerald-700">Đã duyệt đủ</dd>
          </div>
        </dl>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={publishing}
            onClick={onClose}
          >
            Chưa xuất bản
          </Button>
          <Button
            type="button"
            disabled={publishing}
            onClick={onConfirm}
            icon={
              publishing ? (
                <LoaderCircle
                  size={17}
                  className="animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Rocket size={17} aria-hidden="true" />
              )
            }
          >
            {publishing ? "Đang xuất bản..." : "Xác nhận xuất bản"}
          </Button>
        </div>
      </section>
    </div>
  );
}
