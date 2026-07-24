import {
  Archive,
  ArrowRight,
  CheckCircle2,
  FileImage,
  FileUp,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

export function AdminImportPage() {
  const [fileName, setFileName] = useState("");
  const { configured, session, studentProfile } = useAuth();
  const canContribute =
    !configured ||
    studentProfile?.role === "admin" ||
    studentProfile?.role === "contributor" ||
    session?.user.groups.some((group) =>
      ["admin", "contributor"].includes(group),
    );

  if (!canContribute) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <Badge tone="pink">
            {studentProfile?.role === "contributor" ? "Contributor" : "Admin"}
          </Badge>
          <span className="text-sm text-slate-500">Quy trình nhập đề</span>
        </div>
        <h1 className="mt-3 font-heading text-3xl font-bold text-foreground">
          Tạo đề thi mới
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Tải lên ZIP chứa ảnh đã làm sạch. Hệ thống kiểm tra thứ tự, đề xuất
          đáp án bằng AI và bắt buộc duyệt thủ công trước khi xuất bản.
        </p>
      </header>

      <ol className="grid gap-3 sm:grid-cols-4" aria-label="Tiến trình nhập đề">
        {[
          ["01", "Thông tin đề"],
          ["02", "Tải ảnh lên"],
          ["03", "Duyệt đáp án"],
          ["04", "Xuất bản"],
        ].map(([number, label], index) => (
          <li
            key={number}
            className={`flex items-center gap-3 rounded-xl border p-3 ${
              index === 0
                ? "border-primary bg-primary-soft text-primary"
                : "border-border bg-white text-slate-500"
            }`}
          >
            <span className="grid size-8 place-items-center rounded-lg bg-white text-xs font-bold shadow-sm">
              {number}
            </span>
            <span className="text-sm font-semibold">{label}</span>
          </li>
        ))}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[1fr_310px]">
        <Card className="p-6 sm:p-8">
          <h2 className="font-heading text-xl font-bold text-foreground">
            1. Thông tin và nguồn ảnh
          </h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="form-field">
              <span>Mã môn</span>
              <input className="input-base" defaultValue="SWD392" />
            </label>
            <label className="form-field">
              <span>Kỳ học</span>
              <input className="input-base" defaultValue="Spring 2026" />
            </label>
            <label className="form-field">
              <span>Campus</span>
              <select className="input-base">
                <option>Hòa Lạc</option>
                <option>Hồ Chí Minh</option>
                <option>Đà Nẵng</option>
              </select>
            </label>
            <label className="form-field">
              <span>Loại thi</span>
              <select className="input-base">
                <option>FE</option>
              </select>
            </label>
            <label className="form-field">
              <span>Thời gian (phút)</span>
              <input
                className="input-base"
                type="number"
                min="1"
                defaultValue="60"
              />
            </label>
            <label className="flex cursor-pointer items-center gap-3 self-end rounded-xl border border-border p-3.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">
              <input type="checkbox" className="size-4 accent-primary" />
              Đây là đề thi lại (retake)
            </label>
          </div>

          <label className="mt-7 block cursor-pointer rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-8 text-center transition-colors hover:border-primary hover:bg-primary-soft focus-within:ring-3 focus-within:ring-primary/20">
            <input
              type="file"
              accept=".zip"
              className="sr-only"
              onChange={(event) =>
                setFileName(event.target.files?.[0]?.name ?? "")
              }
            />
            <span className="mx-auto grid size-12 place-items-center rounded-xl bg-white text-primary shadow-sm">
              {fileName ? (
                <CheckCircle2 size={23} aria-hidden="true" />
              ) : (
                <FileUp size={23} aria-hidden="true" />
              )}
            </span>
            <span className="mt-4 block font-heading text-lg font-bold text-foreground">
              {fileName || "Chọn file ZIP chứa ảnh câu hỏi"}
            </span>
            <span className="mt-2 block text-sm text-slate-500">
              Đúng 60 ảnh · JPG, PNG hoặc WebP · 20 MB mỗi ảnh
            </span>
          </label>

          <div className="mt-6 flex justify-end">
            <Button disabled={!fileName} icon={<ArrowRight size={17} />}>
              Kiểm tra và tải lên
            </Button>
          </div>
        </Card>

        <aside className="space-y-4">
          <Card className="p-5">
            <h2 className="font-heading font-bold text-foreground">
              Quy ước file ZIP
            </h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li className="flex gap-2">
                <Archive size={17} className="mt-0.5 shrink-0 text-primary" />
                Một ZIP tương ứng một đề thi.
              </li>
              <li className="flex gap-2">
                <FileImage size={17} className="mt-0.5 shrink-0 text-primary" />
                Tên ảnh theo mẫu Q1.jpg → Q60.jpg (hoặc 001.webp → 060.webp).
              </li>
              <li className="flex gap-2">
                <Sparkles size={17} className="mt-0.5 shrink-0 text-primary" />
                AI chỉ đề xuất, không tự xuất bản.
              </li>
              <li className="flex gap-2">
                <ShieldCheck
                  size={17}
                  className="mt-0.5 shrink-0 text-primary"
                />
                Lưu lịch sử mọi lần chỉnh đáp án.
              </li>
            </ul>
          </Card>
          <Card className="border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-bold text-amber-900">
              Kiểm tra trước khi tải
            </p>
            <p className="mt-2 text-sm leading-6 text-amber-800">
              Ảnh phải được làm sạch watermark, không chứa dữ liệu cá nhân và
              đúng thứ tự gốc của đề.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
