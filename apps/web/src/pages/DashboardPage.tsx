import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flame,
  Play,
  Target,
  TrendingUp,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { catalogExams } from "../data/demo";

const stats = [
  {
    label: "Bài đã hoàn thành",
    value: "12",
    note: "+3 trong tuần này",
    icon: CheckCircle2,
    tone: "text-emerald-600 bg-emerald-50",
  },
  {
    label: "Điểm trung bình",
    value: "7.8",
    note: "Tăng 0.6 điểm",
    icon: TrendingUp,
    tone: "text-blue-600 bg-blue-50",
  },
  {
    label: "Chuỗi ôn tập",
    value: "5 ngày",
    note: "Kỷ lục: 8 ngày",
    icon: Flame,
    tone: "text-amber-600 bg-amber-50",
  },
];

export function DashboardPage() {
  return (
    <div className="space-y-8">
      <section className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-[#173b8f] via-primary to-[#477bea] p-6 text-white shadow-panel sm:p-8 lg:p-10">
          <div className="relative z-10 max-w-2xl">
            <Badge tone="amber">Bản thử nghiệm nội bộ</Badge>
            <p className="mt-5 text-sm font-semibold text-blue-100">
              Chào buổi tối, Kiet
            </p>
            <h1 className="mt-2 font-heading text-3xl font-bold leading-tight sm:text-4xl">
              Luyện đề thật, tự tin bước vào phòng thi.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-blue-100 sm:text-lg">
              Mô phỏng đúng thời gian, cấu trúc và cách làm bài FE. Đáp án đã
              được rà soát và điểm số dùng để tham khảo.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/exams"
                className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-primary shadow-md transition-colors duration-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/40"
              >
                <Play size={18} fill="currentColor" aria-hidden="true" />
                Bắt đầu luyện thi
              </Link>
              <Link
                to="/statistics"
                className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur transition-colors duration-200 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/40"
              >
                Xem tiến độ
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
          </div>
          <div
            className="absolute -right-16 -top-20 size-72 rounded-full bg-white/10 blur-2xl"
            aria-hidden="true"
          />
          <div
            className="absolute -bottom-32 right-20 size-80 rounded-full bg-cyan-300/15 blur-3xl"
            aria-hidden="true"
          />
          <Target
            className="absolute bottom-8 right-8 hidden text-white/15 lg:block"
            size={150}
            strokeWidth={1.2}
            aria-hidden="true"
          />
        </div>

        <Card className="flex flex-col p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                Hạn mức hôm nay
              </p>
              <h2 className="mt-1 font-heading text-xl font-bold text-foreground">
                Gói miễn phí
              </h2>
            </div>
            <Badge tone="blue">0 / 2 lượt</Badge>
          </div>
          <div className="mt-6 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-0 rounded-full bg-primary" />
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Bạn còn <strong className="text-foreground">2 lượt thi</strong>{" "}
            trong hôm nay. Hạn mức được làm mới lúc 00:00.
          </p>
          <div className="my-5 border-t border-border" />
          <div className="space-y-3 text-sm text-slate-600">
            <div className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-lg bg-blue-50 text-primary">
                <CalendarDays size={16} aria-hidden="true" />
              </span>
              Kỳ học hiện tại: Spring 2026
            </div>
            <div className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-lg bg-amber-50 text-amber-600">
                <Clock3 size={16} aria-hidden="true" />
              </span>
              Kỳ thi mục tiêu: 06/01/2027
            </div>
          </div>
          <button
            type="button"
            className="mt-auto pt-5 text-left text-sm font-semibold text-primary transition-colors hover:text-primary-strong focus-visible:outline-none focus-visible:underline"
          >
            Xem quyền lợi OnThiLab Pro
          </button>
        </Card>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="section-kicker">Tiến độ của bạn</p>
            <h2 className="section-title">Một chút mỗi ngày</h2>
          </div>
          <span className="hidden text-sm text-slate-500 sm:block">
            Cập nhật vừa xong
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {stats.map((stat) => (
            <Card key={stat.label} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-500">
                    {stat.label}
                  </p>
                  <p className="mt-2 font-heading text-3xl font-bold text-foreground">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{stat.note}</p>
                </div>
                <span
                  className={`grid size-11 place-items-center rounded-xl ${stat.tone}`}
                >
                  <stat.icon size={21} aria-hidden="true" />
                </span>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="section-kicker">Đề thi mới</p>
            <h2 className="section-title">Tiếp tục chinh phục mục tiêu</h2>
          </div>
          <Link
            to="/exams"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg text-sm font-semibold text-primary transition-colors hover:text-primary-strong focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
          >
            Xem tất cả
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {catalogExams.map((exam, index) => (
            <Card
              key={exam.id}
              className="group flex flex-col p-5 transition-shadow duration-200 hover:shadow-panel"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-primary-soft font-heading text-sm font-bold text-primary">
                  {exam.courseCode.slice(0, 3)}
                </span>
                <div className="flex gap-2">
                  {exam.isRetake && <Badge tone="pink">Retake</Badge>}
                  <Badge tone={index === 2 ? "green" : "blue"}>
                    {exam.examType}
                  </Badge>
                </div>
              </div>
              <p className="mt-5 text-xs font-bold uppercase tracking-wider text-primary">
                {exam.code}
              </p>
              <h3 className="mt-1 line-clamp-2 font-heading text-lg font-bold text-foreground">
                {exam.courseName}
              </h3>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500">
                <span className="flex items-center gap-1.5">
                  <BookOpenCheck size={15} aria-hidden="true" />
                  {exam.questionCount} câu
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock3 size={15} aria-hidden="true" />
                  {exam.durationMinutes} phút
                </span>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                <span className="text-sm text-slate-500">{exam.campus}</span>
                <Link
                  to="/exams/$examId"
                  params={{ examId: exam.id }}
                  className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-primary transition-colors hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20"
                >
                  Xem đề
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
