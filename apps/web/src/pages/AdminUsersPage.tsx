import { useState, useEffect } from "react";
import { Search, ShieldAlert, ShieldCheck, UserCog } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { searchUsers, updateRole } from "../lib/api";
import type { StudentProfile } from "@onthilab/contracts";

export function AdminUsersPage() {
  const { session } = useAuth();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<StudentProfile[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    if (!session || query.trim().length < 3) {
      setUsers([]);
      return;
    }

    const timer = setTimeout(() => {
      setPending(true);
      searchUsers(query.trim(), session.idToken)
        .then(setUsers)
        .catch(() => setError("Không thể tìm kiếm người dùng"))
        .finally(() => setPending(false));
    }, 500);

    return () => clearTimeout(timer);
  }, [query, session]);

  const handleUpdateRole = async (
    userId: string,
    newRole: "user" | "contributor" | "admin",
  ) => {
    if (!session) return;
    setError(undefined);
    setMessage(undefined);
    try {
      await updateRole(userId, newRole, session.idToken);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
      );
      setMessage("Cập nhật quyền thành công.");
    } catch (e) {
      setError("Không thể cập nhật quyền. Vui lòng thử lại.");
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="section-kicker">Phân quyền</p>
        <h1 className="section-title">Quản trị viên</h1>
        <p className="mt-2 text-slate-500">
          Tìm kiếm người dùng qua Email hoặc Mã số sinh viên để cấp quyền quản
          trị (Contributor / Admin).
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
          {message}
        </div>
      )}

      <div className="relative max-w-md">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="h-5 w-5 text-slate-400" aria-hidden="true" />
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="block w-full rounded-xl border border-slate-300 bg-white p-3 pl-10 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Tìm email hoặc MSSV (ít nhất 3 ký tự)..."
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-panel">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th scope="col" className="px-6 py-4">
                Sinh viên
              </th>
              <th scope="col" className="px-6 py-4">
                Campus / Ngành (nếu có)
              </th>
              <th scope="col" className="px-6 py-4">
                Quyền hiện tại
              </th>
              <th scope="col" className="px-6 py-4 text-right">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pending ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-8 text-center text-slate-500"
                >
                  Đang tìm kiếm...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-8 text-center text-slate-500"
                >
                  {query.trim().length < 3
                    ? "Nhập ít nhất 3 ký tự để tìm kiếm."
                    : "Không tìm thấy người dùng nào phù hợp."}
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-foreground">
                      {user.fullName}
                    </div>
                    <div className="text-xs">{user.email}</div>
                    <div className="text-xs text-slate-400">
                      {user.studentCode ?? "Chưa cập nhật MSSV"}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>{user.campus.name}</div>
                    <div className="text-xs">
                      {user.major?.name ?? "Chưa cập nhật ngành"}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium capitalize">
                    {user.role}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <select
                      value={user.role}
                      onChange={(e) =>
                        handleUpdateRole(user.id, e.target.value as any)
                      }
                      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="user">User</option>
                      <option value="contributor">Contributor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
