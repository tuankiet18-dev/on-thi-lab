import type { ProfileOptions } from "@onthilab/contracts";
import { Link, Navigate } from "@tanstack/react-router";
import { CheckCircle2, Save, UserRound } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { ApiError, getProfileOptions } from "../lib/api";

export function ProfilePage() {
  const { saveStudentProfile, session, studentProfile } = useAuth();
  const [fullName, setFullName] = useState(studentProfile?.fullName ?? "");
  const [studentCode, setStudentCode] = useState(
    studentProfile?.studentCode ?? "",
  );
  const [campusCode, setCampusCode] = useState(
    studentProfile?.campus.code ?? "",
  );
  const [majorCode, setMajorCode] = useState(studentProfile?.major?.code ?? "");
  const [options, setOptions] = useState<ProfileOptions>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!session) return;

    void getProfileOptions(session.idToken)
      .then(setOptions)
      .catch(() => {
        setError("Không thể tải thông tin hồ sơ. Vui lòng tải lại trang.");
      });
  }, [session]);

  useEffect(() => {
    if (!studentProfile) return;
    setFullName(studentProfile.fullName);
    setStudentCode(studentProfile.studentCode ?? "");
    setCampusCode(studentProfile.campus.code);
    setMajorCode(studentProfile.major?.code ?? "");
  }, [studentProfile]);

  if (!session) return <Navigate to="/login" replace />;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);
    setSaved(false);

    const normalizedStudentCode = studentCode.trim().toUpperCase();
    if (
      normalizedStudentCode &&
      !/^[A-Z0-9-]{4,20}$/.test(normalizedStudentCode)
    ) {
      setError("MSSV phải có 4–20 ký tự chữ, số hoặc dấu gạch ngang.");
      return;
    }
    if (!fullName.trim() || !campusCode) {
      setError("Họ tên và campus là thông tin bắt buộc.");
      return;
    }

    setPending(true);
    try {
      await saveStudentProfile({
        fullName: fullName.trim(),
        studentCode: normalizedStudentCode || undefined,
        campusCode,
        majorCode: majorCode || undefined,
      });
      setSaved(true);
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === "PROFILE_CONFLICT") {
        setError("Email hoặc mã số sinh viên này đã được sử dụng.");
      } else {
        setError("Không thể cập nhật hồ sơ. Vui lòng thử lại.");
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <p className="section-kicker">Tài khoản</p>
        <h1 className="section-title">Hồ sơ của tôi</h1>
        <p className="mt-2 text-slate-600">Chỉ họ tên và campus là bắt buộc.</p>
      </header>

      <form
        onSubmit={submit}
        className="rounded-3xl border border-border bg-white p-6 shadow-panel sm:p-8"
      >
        <div className="flex items-start gap-4 border-b border-border pb-6">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
            <UserRound size={22} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-heading text-xl font-bold text-foreground">
              Thông tin sinh viên
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Email đăng nhập:{" "}
              <strong className="text-foreground">{session.user.email}</strong>
            </p>
          </div>
        </div>

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
            Mã số sinh viên{" "}
            <span className="font-normal">(không bắt buộc)</span>
            <input
              value={studentCode}
              onChange={(event) => setStudentCode(event.target.value)}
              className="input-base uppercase"
              placeholder="Ví dụ: HE170001"
              autoComplete="off"
            />
            <span className="text-xs font-normal text-slate-500">
              Có thể bổ sung hoặc chỉnh sửa bất cứ lúc nào.
            </span>
          </label>
          <label className="form-field">
            Campus
            <select
              value={campusCode}
              onChange={(event) => setCampusCode(event.target.value)}
              className="input-base"
              disabled={!options}
              required
            >
              <option value="">Chọn campus</option>
              {options?.campuses.map((campus) => (
                <option key={campus.code} value={campus.code}>
                  {campus.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field sm:col-span-2">
            Ngành học <span className="font-normal">(không bắt buộc)</span>
            <select
              value={majorCode}
              onChange={(event) => setMajorCode(event.target.value)}
              className="input-base"
              disabled={!options}
            >
              <option value="">Chưa cập nhật</option>
              {options?.majors.map((major) => (
                <option key={major.code} value={major.code}>
                  {major.name}
                </option>
              ))}
            </select>
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
        {saved && (
          <p
            role="status"
            className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
          >
            <CheckCircle2 size={18} aria-hidden="true" />
            Hồ sơ đã được cập nhật.
          </p>
        )}

        <div className="mt-7 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={pending || !options}
            className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-5 font-bold text-white hover:bg-primary-strong disabled:cursor-wait disabled:opacity-60"
          >
            <Save size={18} aria-hidden="true" />
            {pending ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
          <Link
            to="/"
            className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-border-strong bg-white px-5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
          >
            Quay lại tổng quan
          </Link>
        </div>
      </form>
    </div>
  );
}
