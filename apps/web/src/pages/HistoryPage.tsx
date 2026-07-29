import { Clock3, ExternalLink, Target } from "lucide-react";
import { Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { AttemptSummary } from "@onthilab/contracts";
import { useAuth } from "../auth/AuthContext";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { listAttempts } from "../lib/api";

export function HistoryPage() {
  const { session } = useAuth();
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }

    let active = true;
    void listAttempts(session.idToken)
      .then((result) => {
        if (active) setAttempts(result);
      })
      .catch(() => {
        if (active) setError("Không thể tải lịch sử làm bài.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [session]);

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="section-title">Lịch sử làm bài</h1>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((skeleton) => (
            <Card
              key={skeleton}
              className="h-44 animate-pulse bg-slate-100/50 shadow-none"
            />
          ))}
        </div>
      ) : attempts.length === 0 ? (
        <Card className="flex min-h-[300px] flex-col items-center justify-center p-8 text-center">
          <Target
            className="mb-4 text-slate-300"
            size={48}
            aria-hidden="true"
          />
          <p className="font-heading text-xl font-bold text-slate-700">
            Chưa có bài làm
          </p>
          <p className="mt-2 max-w-md text-slate-500">
            Làm một đề để xem lại kết quả.
          </p>
          <Link
            to="/exams"
            className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-primary-strong focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
          >
            <Target size={17} />
            Kho đề
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {attempts.map((attempt) => (
            <Card
              key={attempt.id}
              className="group relative flex flex-col p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <Badge tone={attempt.result ? "blue" : "amber"}>
                    {attempt.courseCode}
                  </Badge>
                  <h2 className="mt-3 font-heading font-bold text-foreground">
                    <Link
                      to={
                        attempt.result
                          ? "/results/$attemptId"
                          : "/attempts/$attemptId"
                      }
                      params={{ attemptId: attempt.id }}
                      className="focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/25"
                    >
                      <span
                        className="absolute inset-0 z-10"
                        aria-hidden="true"
                      />
                      {attempt.examCode}
                    </Link>
                  </h2>
                </div>
                {attempt.result && (
                  <div className="text-right">
                    <span className="block font-heading text-2xl font-bold text-primary">
                      {attempt.result.score}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      / 10
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-auto pt-4 text-sm text-slate-500">
                <span className="flex items-center gap-2">
                  <Clock3 size={16} aria-hidden="true" />
                  {new Intl.DateTimeFormat("vi-VN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(attempt.startedAt))}
                </span>
              </div>

              <div className="absolute right-5 top-5 z-20 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                <Link
                  to={
                    attempt.result
                      ? "/results/$attemptId"
                      : "/attempts/$attemptId"
                  }
                  params={{ attemptId: attempt.id }}
                  className="grid size-8 place-items-center rounded-full bg-slate-100 text-slate-600 hover:bg-primary hover:text-white"
                  title="Chi tiết"
                >
                  <ExternalLink size={15} aria-hidden="true" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
