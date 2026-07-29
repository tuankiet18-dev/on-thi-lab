import type { Feedback } from "@onthilab/contracts";
import { Check, MessageSquareText } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { listFeedback, resolveFeedback } from "../lib/api";

export function AdminFeedbackPage() {
  const { session } = useAuth();
  const [items, setItems] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let active = true;
    void listFeedback(session.idToken)
      .then((result) => active && setItems(result))
      .catch(() => active && setError("Không thể tải góp ý."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [session]);

  const resolve = async (id: string) => {
    if (!session) return;
    setResolvingId(id);
    setError("");
    try {
      await resolveFeedback(session.idToken, id);
      setItems((current) => current.filter((item) => item.id !== id));
    } catch {
      setError("Chưa thể đánh dấu đã xử lý.");
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="font-heading text-3xl font-bold">Góp ý người dùng</h1>
        <p className="mt-2 text-slate-600">{items.length} góp ý cần xử lý</p>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 font-semibold text-red-700"
        >
          {error}
        </p>
      )}
      {loading ? (
        <Card className="h-40 animate-pulse bg-slate-100" />
      ) : items.length === 0 ? (
        <Card className="p-10 text-center">
          <MessageSquareText className="mx-auto text-slate-300" size={40} />
          <h2 className="mt-4 font-heading text-xl font-bold">
            Không có góp ý mới
          </h2>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.id} className="p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-heading text-lg font-bold">{item.title}</p>
                  <p className="mt-2 whitespace-pre-wrap leading-7 text-slate-600">
                    {item.detail}
                  </p>
                  <p className="mt-3 text-xs text-slate-500">
                    {new Intl.DateTimeFormat("vi-VN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(item.createdAt))}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  icon={<Check size={17} />}
                  disabled={resolvingId === item.id}
                  onClick={() => void resolve(item.id)}
                >
                  Đã xử lý
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
