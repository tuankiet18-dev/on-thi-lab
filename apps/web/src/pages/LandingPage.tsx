import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Cpu,
  Database,
  GraduationCap,
  Laptop,
  Layers,
  Network,
  Save,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { cn } from "../lib/cn";

// Real representative courses across FPT disciplines
const featuredCourses = [
  {
    code: "PRO192",
    name: "Object-Oriented Programming (Java)",
    tag: "PRO",
    examsCount: 4,
    semester: "SP26",
    duration: "60 phút",
  },
  {
    code: "PRF192",
    name: "Programming Fundamentals (C)",
    tag: "PRF",
    examsCount: 3,
    semester: "SP26",
    duration: "60 phút",
  },
  {
    code: "CSD201",
    name: "Data Structures & Algorithms",
    tag: "CSD",
    examsCount: 5,
    semester: "FA25",
    duration: "60 phút",
  },
  {
    code: "DBI202",
    name: "Introduction to Databases (SQL)",
    tag: "DBI",
    examsCount: 4,
    semester: "FA25",
    duration: "60 phút",
  },
  {
    code: "MAS291",
    name: "Statistics for IT",
    tag: "MAS",
    examsCount: 3,
    semester: "SP26",
    duration: "60 phút",
  },
  {
    code: "MAD101",
    name: "Discrete Mathematics",
    tag: "MAD",
    examsCount: 3,
    semester: "SP26",
    duration: "60 phút",
  },
  {
    code: "OSG202",
    name: "Operating Systems",
    tag: "OSG",
    examsCount: 4,
    semester: "FA25",
    duration: "60 phút",
  },
  {
    code: "CEA201",
    name: "Computer Architecture",
    tag: "CEA",
    examsCount: 3,
    semester: "FA25",
    duration: "60 phút",
  },
  {
    code: "NWC203",
    name: "Computer Networks",
    tag: "NWC",
    examsCount: 4,
    semester: "SP26",
    duration: "60 phút",
  },
];

const faqs = [
  {
    question: "OnThiLab có thu phí sử dụng không?",
    answer:
      "Hoàn toàn không. OnThiLab là nền tảng học liệu mở phi lợi nhuận dành cho sinh viên FPT University. Bạn có thể làm bài, xem đáp án chi tiết và theo dõi thống kê mà không phải trả bất kỳ khoản phí nào.",
  },
  {
    question: "Đề thi và đáp án trên OnThiLab có chuẩn xác không?",
    answer:
      "Mọi đề thi đều bám sát cấu trúc đề FE thực tế của các kỳ gần nhất. Hệ thống phân định minh bạch mức độ tin cậy: các đáp án gắn nhãn 'Đã thẩm định' được đối chiếu qua nhiều nguồn và xác nhận bởi các sinh viên khóa trước có thành tích xuất sắc.",
  },
  {
    question: "Tôi có thể làm lại đề thi bao nhiêu lần?",
    answer:
      "Không giới hạn số lần làm bài. Bạn có thể luyện lại nhiều lần để rèn luyện tốc độ xử lý câu hỏi và theo dõi sự tiến bộ của bản thân qua bảng thống kê điểm số.",
  },
  {
    question: "Nếu trong lúc làm bài bị mất mạng hoặc reload trang thì sao?",
    answer:
      "Hệ thống sử dụng cơ chế Monotonic Autosave (tự động lưu tuần tự). Mỗi khi bạn chọn đáp án, dữ liệu được gửi lưu tức thì về máy chủ. Bạn có thể tải lại trang hoặc mở trên thiết bị khác để làm tiếp trong thời gian đếm ngược còn lại.",
  },
  {
    question: "Chế độ hiển thị Hybrid OCR hoạt động như thế nào?",
    answer:
      "Với các câu hỏi văn bản thông thường, hệ thống hiển thị text sắc nét để đọc nhanh. Đối với các câu hỏi chứa biểu đồ, sơ đồ ERD, mạch điện hoặc công thức phức tạp, hệ thống tự động giữ nguyên ảnh chụp đề thi gốc để tránh sai lệch ký hiệu.",
  },
];

export function LandingPage() {
  const { status } = useAuth();
  const isAuthenticated = status === "authenticated";

  // Interactive mockup question state (clean, subtle interaction)
  const [selectedAnswer, setSelectedAnswer] = useState<string>("B");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      {/* ── Top Navigation Bar (Clean, consistent with onthilab.id.vn) ── */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand Logo */}
          <Link
            to="/"
            className="flex items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="grid size-9 place-items-center rounded-xl bg-slate-900 border border-slate-800 shadow-xs">
              <img
                src="/logo.png"
                alt="OnThiLab Mascot"
                className="size-6 object-contain"
              />
            </div>
            <span className="font-heading text-xl font-bold tracking-tight text-slate-900">
              OnThi<span className="text-primary">Lab</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden items-center gap-8 md:flex text-sm font-semibold text-slate-600">
            <a
              href="#mon-thi"
              className="transition-colors hover:text-slate-900"
            >
              Kho đề thi
            </a>
            <a
              href="#tinh-nang"
              className="transition-colors hover:text-slate-900"
            >
              Tính năng phòng thi
            </a>
            <a
              href="#dap-an"
              className="transition-colors hover:text-slate-900"
            >
              Độ tin cậy đáp án
            </a>
            <a href="#faq" className="transition-colors hover:text-slate-900">
              Câu hỏi thường gặp
            </a>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                to="/"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-xs transition-colors hover:bg-primary-strong"
              >
                <span>Vào Bảng điều khiển</span>
                <ArrowRight size={15} />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="min-h-10 items-center justify-center rounded-xl px-3.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 inline-flex"
                >
                  Đăng nhập
                </Link>
                <Link
                  to="/register"
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-xs transition-colors hover:bg-primary-strong active:scale-[0.98]"
                >
                  <span>Bắt đầu ôn thi</span>
                  <ArrowRight size={15} />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero Section (Harmonious, Academic Cobalt & Clean Canvas) ── */}
      <section className="relative border-b border-slate-200 bg-white py-14 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
            {/* Left Content Column */}
            <div className="space-y-6">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">
                Học liệu mở · FPT University
              </p>

              <h1 className="font-heading text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-5xl leading-tight">
                Ôn đúng môn.
                <br />
                Vào đề đúng thời gian thi.
              </h1>

              <p className="max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
                Nền tảng hỗ trợ sinh viên FPT University luyện đề Final Exam sát
                với đề thi thực tế. Bấm giờ chuẩn 60 phút, tự động lưu câu trả
                lời và xem giải thích chi tiết sau khi nộp bài.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
                <Link
                  to={isAuthenticated ? "/exams" : "/register"}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-white shadow-xs transition-all duration-150 hover:bg-primary-strong active:scale-[0.99]"
                >
                  <BookOpenCheck size={18} />
                  <span>Bắt đầu làm bài ngay</span>
                  <ArrowRight size={16} />
                </Link>

                <Link
                  to="/exams"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 hover:border-slate-400"
                >
                  <Search size={16} />
                  <span>Khám phá kho 40+ môn thi</span>
                </Link>
              </div>

              {/* Natural Campus Line (No badge soup) */}
              <div className="pt-2 text-xs text-slate-500 font-medium">
                Ngân hàng đề thi đồng bộ 5 campus:{" "}
                <span className="text-slate-800 font-semibold">
                  Hòa Lạc · TP.HCM · Đà Nẵng · Cần Thơ · Quy Nhơn
                </span>
              </div>
            </div>

            {/* Right: Clean, Light-Themed Exam Preview Card (Matches Screenshot 3 aesthetic) */}
            <div className="relative">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                  <div className="space-y-0.5">
                    <span className="font-mono text-xs font-bold text-primary">
                      PRO192 · SP26 · Đề FE
                    </span>
                    <h2 className="text-sm font-bold text-slate-900">
                      Object-Oriented Programming (Java)
                    </h2>
                  </div>

                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-mono font-bold text-amber-800">
                    <Clock3 size={13} />
                    00:54:18
                  </span>
                </div>

                {/* Question Simulator */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                    <span>Câu 14 / 40 · Chọn 1 đáp án</span>
                    <span className="text-emerald-700 font-mono text-[11px]">
                      ● Đã tự động lưu
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
                    Trong Java, tính đa hình (polymorphism) tại thời điểm
                    runtime được thực hiện thông qua cơ chế nào sau đây?
                  </p>

                  {/* Clean Selectable Options */}
                  <div className="space-y-2 pt-1">
                    {[
                      {
                        key: "A",
                        text: "Nạp chồng phương thức (Method Overloading)",
                      },
                      {
                        key: "B",
                        text: "Ghi đè phương thức (Method Overriding / Dynamic Binding)",
                      },
                      { key: "C", text: "Sử dụng từ khóa final cho class" },
                      {
                        key: "D",
                        text: "Khởi tạo trực tiếp instance từ abstract class",
                      },
                    ].map((opt) => {
                      const isSelected = selectedAnswer === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setSelectedAnswer(opt.key)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-xs transition-all cursor-pointer",
                            isSelected
                              ? "border-primary bg-blue-50/70 text-slate-900 font-semibold shadow-2xs"
                              : "border-slate-200 bg-slate-50/50 text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                          )}
                        >
                          <span
                            className={cn(
                              "grid size-5.5 shrink-0 place-items-center rounded-lg text-xs font-mono font-bold",
                              isSelected
                                ? "bg-primary text-white"
                                : "bg-white border border-slate-200 text-slate-600",
                            )}
                          >
                            {opt.key}
                          </span>
                          <span className="flex-1">{opt.text}</span>
                          {isSelected && (
                            <CheckCircle2
                              size={16}
                              className="text-primary shrink-0"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Card Footer */}
                <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <ShieldCheck size={14} className="text-emerald-600" />
                    Đáp án đối chiếu & thẩm định học thuật
                  </span>
                  <span>Nhấn chọn thử đáp án</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section: Course Catalog Grid (Identical to Screenshot 3's "Môn có đề mới") ── */}
      <section
        id="mon-thi"
        className="py-16 sm:py-20 bg-slate-50 border-b border-slate-200"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div className="space-y-1">
              <h2 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Môn có đề mới
              </h2>
              <p className="text-sm text-slate-600">
                Các môn học trọng tâm có ngân hàng đề thi được cập nhật thường
                xuyên.
              </p>
            </div>

            <Link
              to="/exams"
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary-strong"
            >
              <span>Xem tất cả môn</span>
              <ChevronRight size={16} />
            </Link>
          </div>

          {/* Cards Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredCourses.map((course) => (
              <div
                key={course.code}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-block rounded-md bg-blue-50 px-2 py-0.5 font-mono text-xs font-bold text-primary border border-blue-100">
                      {course.tag}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {course.examsCount} đề
                    </span>
                  </div>

                  <div>
                    <p className="font-mono text-xs font-bold text-slate-500">
                      {course.code}
                    </p>
                    <h3 className="font-heading text-base font-bold text-slate-900 line-clamp-1 mt-0.5">
                      {course.name}
                    </h3>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span>
                    Mới nhất: {course.semester} · {course.duration}
                  </span>
                  <Link
                    to="/exams"
                    search={{ q: course.code }}
                    className="font-bold text-primary hover:underline inline-flex items-center gap-0.5"
                  >
                    Vào đề <ChevronRight size={13} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section: Core Pillars (Giải quyết 3 nỗi lo phòng thi) ── */}
      <section
        id="tinh-nang"
        className="py-16 sm:py-20 bg-white border-b border-slate-200"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-2 mb-12">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Giải quyết 3 nỗi lo khi bước vào phòng thi FE
            </h2>
            <p className="text-sm text-slate-600">
              Được thiết kế để bạn làm quen với nhịp độ và cấu trúc thi thực tế.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Pillar 1 */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
              <div className="grid size-11 place-items-center rounded-xl bg-blue-50 text-primary">
                <Clock3 size={22} />
              </div>
              <h3 className="font-heading text-base font-bold text-slate-900">
                Áp lực thời gian 60 phút
              </h3>
              <p className="text-sm leading-relaxed text-slate-600">
                Đồng hồ bấm giờ máy chủ đếm ngược liên tục, rèn luyện thói quen
                căn thời gian hợp lý cho từng câu và tự động nộp bài khi hết
                giờ.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
              <div className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                <ShieldCheck size={22} />
              </div>
              <h3 className="font-heading text-base font-bold text-slate-900">
                Đáp án đối chiếu có thẩm định
              </h3>
              <p className="text-sm leading-relaxed text-slate-600">
                Không học vẹt đáp án trôi nổi. Hệ thống phân định rõ ràng giữa
                gợi ý và đáp án đã kiểm duyệt qua nhiều vòng đối chiếu.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
              <div className="grid size-11 place-items-center rounded-xl bg-amber-50 text-amber-700">
                <Save size={22} />
              </div>
              <h3 className="font-heading text-base font-bold text-slate-900">
                Không lo mất bài khi mạng chập chờn
              </h3>
              <p className="text-sm leading-relaxed text-slate-600">
                Cơ chế Monotonic Autosave tự động gửi lưu từng lựa chọn. Bạn có
                thể tải lại trang bất kỳ lúc nào mà không bị mất tiến độ làm
                bài.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section: Hybrid Mode ── */}
      <section
        id="dap-an"
        className="py-16 sm:py-20 bg-slate-50 border-b border-slate-200"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-10 grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-center">
            <div className="space-y-4">
              <h2 className="font-heading text-2xl font-bold tracking-tight text-slate-900">
                Chế độ hiển thị Hybrid OCR thông minh
              </h2>
              <p className="text-sm leading-relaxed text-slate-600">
                Các câu hỏi văn bản thuần túy được hiển thị dưới dạng text chuẩn
                rõ nét giúp bạn đọc lướt nhanh; riêng các câu chứa sơ đồ mạch
                logic, biểu thức toán học hoặc quan hệ cơ sở dữ liệu sẽ tự động
                giữ ảnh chụp gốc để bảo đảm tính chính xác 100%.
              </p>
              <div className="space-y-2 text-xs text-slate-700 font-semibold pt-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>Dễ dàng phóng to ảnh câu hỏi trên màn hình.</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>
                    Xem lại điểm số và giải thích chi tiết sau khi nộp bài.
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs space-y-1.5 shadow-2xs">
                <span className="font-bold text-slate-800">
                  Câu hỏi Text OCR:
                </span>
                <p className="text-slate-600 font-mono">
                  &quot;What is the purpose of interface in Java
                  programming...?&quot;
                </p>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs space-y-1.5 shadow-2xs">
                <span className="font-bold text-amber-900">
                  Câu hỏi biểu đồ / mạch điện:
                </span>
                <p className="text-amber-800">
                  Tự động hiển thị ảnh chụp đề thi gốc sắc nét, không lo mất
                  công thức toán hay sơ đồ quan hệ.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section: FAQ ── */}
      <section
        id="faq"
        className="py-16 sm:py-20 bg-white border-b border-slate-200"
      >
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-2 mb-10">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Câu hỏi thường gặp
            </h2>
            <p className="text-sm text-slate-600">
              Những thông tin cần biết trước khi làm bài trên OnThiLab.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div
                  key={faq.question}
                  className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="flex w-full cursor-pointer items-center justify-between p-4 sm:p-5 text-left text-sm sm:text-base font-bold text-slate-900 hover:bg-slate-50 transition-colors"
                  >
                    <span>{faq.question}</span>
                    <ChevronRight
                      size={17}
                      className={cn(
                        "shrink-0 text-slate-400 transition-transform duration-150",
                        isOpen && "rotate-90 text-primary",
                      )}
                    />
                  </button>
                  {isOpen && (
                    <div className="border-t border-slate-100 p-4 sm:p-5 pt-2 text-sm leading-relaxed text-slate-600 bg-slate-50/50">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Section: Bottom CTA (Sleek Deep Navy Card, like onthilab.id.vn) ── */}
      <section className="py-16 bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-linear-to-br from-[#0c1e4a] via-[#102a6b] to-[#1d4ed8] p-8 sm:p-12 text-center text-white shadow-md space-y-5">
            <h2 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight">
              Sẵn sàng cho kỳ thi FE sắp tới?
            </h2>
            <p className="max-w-xl mx-auto text-sm sm:text-base text-blue-100 leading-relaxed">
              Tạo tài khoản miễn phí để luyện đề đúng áp lực thời gian và nâng
              cao điểm số của bạn ngay hôm nay.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <Link
                to={isAuthenticated ? "/exams" : "/register"}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-bold text-slate-900 shadow-xs transition-colors hover:bg-slate-100"
              >
                <span>Bắt đầu ôn thi ngay</span>
                <ArrowRight size={15} />
              </Link>
              <Link
                to="/exams"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/30 bg-white/10 px-5 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
              >
                Khám phá kho đề
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 bg-white py-10 text-slate-500 text-xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="grid size-7 place-items-center rounded-lg bg-slate-900">
              <img
                src="/logo.png"
                alt="OnThiLab Mascot"
                className="size-4.5 object-contain"
              />
            </div>
            <span className="font-heading font-bold text-slate-900 text-sm">
              OnThiLab
            </span>
            <span className="text-slate-400">
              · Học liệu ôn thi FE cho sinh viên FPT
            </span>
          </div>

          <div className="flex items-center gap-5 font-semibold text-slate-600">
            <Link to="/exams" className="hover:text-slate-900">
              Kho đề thi
            </Link>
            <Link to="/login" className="hover:text-slate-900">
              Đăng nhập
            </Link>
            <Link to="/register" className="hover:text-slate-900">
              Đăng ký
            </Link>
          </div>

          <p className="text-slate-400">
            © 2026 OnThiLab. Điểm số và đáp án phục vụ mục đích tham khảo học
            tập.
          </p>
        </div>
      </footer>
    </div>
  );
}
