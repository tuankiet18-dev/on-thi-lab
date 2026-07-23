import { useNavigate } from "@tanstack/react-router";
import { CheckCircle2, LoaderCircle, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";

type CallbackState = "working" | "success" | "error";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const { completeSignIn } = useAuth();
  const started = useRef(false);
  const [state, setState] = useState<CallbackState>("working");
  const [message, setMessage] = useState("Đang xác minh tài khoản của bạn...");

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void completeSignIn(window.location.search)
      .then(() => {
        setState("success");
        setMessage("Đăng nhập thành công. Đang mở trang tổng quan...");
        window.history.replaceState({}, "", "/auth/callback");
        window.setTimeout(() => {
          void navigate({ to: "/", replace: true });
        }, 500);
      })
      .catch((reason) => {
        setState("error");
        setMessage(
          reason instanceof Error
            ? reason.message
            : "Không thể hoàn tất đăng nhập.",
        );
      });
  }, [completeSignIn, navigate]);

  return (
    <main className="grid min-h-screen place-items-center bg-app p-5">
      <section className="w-full max-w-md rounded-3xl border border-border bg-white p-8 text-center shadow-panel">
        <span
          className={`mx-auto grid size-14 place-items-center rounded-2xl ${
            state === "error"
              ? "bg-red-50 text-danger"
              : state === "success"
                ? "bg-emerald-50 text-emerald-600"
                : "bg-primary-soft text-primary"
          }`}
        >
          {state === "working" && (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          )}
          {state === "success" && <CheckCircle2 aria-hidden="true" />}
          {state === "error" && <TriangleAlert aria-hidden="true" />}
        </span>
        <h1 className="mt-5 font-heading text-2xl font-bold text-foreground">
          {state === "error"
            ? "Đăng nhập chưa thành công"
            : "Đăng nhập OnThiLab"}
        </h1>
        <p className="mt-3 leading-7 text-slate-600">{message}</p>
        {state === "error" && (
          <button
            type="button"
            onClick={() => void navigate({ to: "/login", replace: true })}
            className="mt-6 min-h-11 cursor-pointer rounded-xl bg-primary px-5 py-2 font-bold text-white hover:bg-primary-strong"
          >
            Thử đăng nhập lại
          </button>
        )}
      </section>
    </main>
  );
}
