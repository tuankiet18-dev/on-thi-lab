import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { ArrowRight, MapPin, UserRoundCheck } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { ApiError, getProfileOptions } from "../lib/api";
import type { ProfileOptions } from "@onthilab/contracts";

const routeApi = getRouteApi("/onboarding");

export function OnboardingPage() {
  const navigate = useNavigate();
  const search = routeApi.useSearch();
  const { saveStudentProfile, session, studentProfile } = useAuth();
  const fullName =
    studentProfile?.fullName ?? session?.user.name ?? "Sinh viên OnThiLab";
  const [campusCode, setCampusCode] = useState(
    studentProfile?.campus.code ?? "",
  );
  const [options, setOptions] = useState<ProfileOptions>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!session) return;

    void getProfileOptions(session.idToken)
      .then(setOptions)
      .catch(() => {
        setError("Không thể tải danh sách campus. Vui lòng tải lại trang.");
      });
  }, [session]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);

    if (!campusCode) {
      setError("Vui lòng chọn campus.");
      return;
    }

    setPending(true);
    try {
      await saveStudentProfile({
        fullName: fullName.trim(),
        campusCode,
      });
      await navigate({ to: search.redirect || "/", replace: true });
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === "PROFILE_CONFLICT") {
        setError("Email hoặc mã số sinh viên này đã được sử dụng.");
      } else {
        setError("Không thể lưu hồ sơ. Vui lòng thử lại.");
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-app lg:grid-cols-[420px_1fr]">
      <aside className="hidden bg-linear-to-br from-[#173b8f] to-primary p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="OnThiLab Mascot"
            className="size-11 object-contain drop-shadow-sm transition-transform hover:scale-105"
          />
          <span className="font-heading text-2xl font-bold">OnThiLab</span>
        </div>
        <div>
          <UserRoundCheck size={52} className="text-blue-200" />
          <h1 className="mt-6 font-heading text-3xl font-bold leading-tight">
            Hoàn thiện hồ sơ học tập
          </h1>
          <p className="mt-4 leading-7 text-blue-100">
            Chọn campus để OnThiLab ưu tiên các đề thi phù hợp với bạn.
          </p>
        </div>
        <p className="text-sm text-blue-200">
          MSSV và ngành học có thể bổ sung sau trong Hồ sơ.
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

          <div className="mt-7 grid gap-5">
            <label className="form-field">
              <span className="flex items-center gap-2">
                <MapPin size={16} aria-hidden="true" />
                Campus
              </span>
              <select
                value={campusCode}
                onChange={(event) => setCampusCode(event.target.value)}
                className="input-base"
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
          </div>

          <p className="mt-4 text-sm text-slate-500">
            Bạn có thể bổ sung họ tên, MSSV và ngành học trong Hồ sơ.
          </p>

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
            disabled={pending || !options}
            className="mt-7 inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-5 font-bold text-white hover:bg-primary-strong disabled:cursor-wait disabled:opacity-60 sm:w-auto"
          >
            {pending ? "Đang lưu..." : "Hoàn tất hồ sơ"}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </form>
      </section>
    </main>
  );
}
