import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, GraduationCap, UserRoundCheck } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useAuth } from "../auth/AuthContext";

const campuses = [
  { code: "HL", name: "Hòa Lạc" },
  { code: "HCM", name: "Hồ Chí Minh" },
  { code: "DN", name: "Đà Nẵng" },
  { code: "CT", name: "Cần Thơ" },
  { code: "QN", name: "Quy Nhơn" },
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const { saveStudentProfile, session, studentProfile } = useAuth();
  const [fullName, setFullName] = useState(
    studentProfile?.fullName ?? session?.user.name ?? "",
  );
  const [studentCode, setStudentCode] = useState(
    studentProfile?.studentCode ?? "",
  );
  const [campusCode, setCampusCode] = useState(
    studentProfile?.campusCode ?? "",
  );
  const [major, setMajor] = useState(studentProfile?.major ?? "");
  const [error, setError] = useState<string>();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);

    const normalizedStudentCode = studentCode.trim().toUpperCase();
    if (!/^[A-Z0-9-]{4,20}$/.test(normalizedStudentCode)) {
      setError("MSSV phải có 4–20 ký tự chữ, số hoặc dấu gạch ngang.");
      return;
    }
    if (!fullName.trim() || !campusCode || !major.trim()) {
      setError("Vui lòng điền đầy đủ thông tin hồ sơ.");
      return;
    }

    saveStudentProfile({
      fullName: fullName.trim(),
      studentCode: normalizedStudentCode,
      campusCode,
      major: major.trim(),
    });
    void navigate({ to: "/", replace: true });
  };

  return (
    <main className="grid min-h-screen bg-app lg:grid-cols-[420px_1fr]">
      <aside className="hidden bg-linear-to-br from-[#173b8f] to-primary p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-white/15">
            <GraduationCap size={25} aria-hidden="true" />
          </span>
          <span className="font-heading text-2xl font-bold">OnThiLab</span>
        </div>
        <div>
          <UserRoundCheck size={52} className="text-blue-200" />
          <h1 className="mt-6 font-heading text-3xl font-bold leading-tight">
            Hoàn thiện hồ sơ học tập
          </h1>
          <p className="mt-4 leading-7 text-blue-100">
            Campus và ngành học giúp OnThiLab ưu tiên đúng môn và đề thi phù hợp
            với bạn.
          </p>
        </div>
        <p className="text-sm text-blue-200">
          Bạn có thể cập nhật lại thông tin này sau.
        </p>
      </aside>

      <section className="flex items-center justify-center p-5 sm:p-8 lg:p-12">
        <form
          onSubmit={submit}
          className="w-full max-w-2xl rounded-3xl border border-border bg-white p-6 shadow-panel sm:p-8"
        >
          <p className="section-kicker">Bước cuối cùng</p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-foreground">
            Thông tin sinh viên
          </h2>
          <p className="mt-2 leading-7 text-slate-600">
            Email đăng nhập:{" "}
            <strong className="text-foreground">{session?.user.email}</strong>
          </p>

          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <label className="form-field sm:col-span-2">
              Họ và tên
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="input-base"
                autoComplete="name"
                required
              />
            </label>
            <label className="form-field">
              Mã số sinh viên
              <input
                value={studentCode}
                onChange={(event) => setStudentCode(event.target.value)}
                className="input-base uppercase"
                placeholder="Ví dụ: HE170001"
                autoComplete="off"
                required
              />
            </label>
            <label className="form-field">
              Campus
              <select
                value={campusCode}
                onChange={(event) => setCampusCode(event.target.value)}
                className="input-base"
                required
              >
                <option value="">Chọn campus</option>
                {campuses.map((campus) => (
                  <option key={campus.code} value={campus.code}>
                    {campus.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field sm:col-span-2">
              Ngành học
              <input
                value={major}
                onChange={(event) => setMajor(event.target.value)}
                className="input-base"
                placeholder="Ví dụ: Software Engineering"
                required
              />
            </label>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-danger"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            className="mt-7 inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-5 font-bold text-white hover:bg-primary-strong sm:w-auto"
          >
            Hoàn tất hồ sơ
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </form>
      </section>
    </main>
  );
}
