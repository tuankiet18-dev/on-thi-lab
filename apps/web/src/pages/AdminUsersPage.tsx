import { useState, useEffect, useCallback } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Lock,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Unlock,
  UserCheck,
  UserCog,
  Users,
  UserX,
  X,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { getAdminUsers, updateRole, updateUserStatus } from "../lib/api";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import type {
  AdminUserSummary,
  AdminUserFilter,
  UserRole,
} from "@onthilab/contracts";

const CAMPUS_OPTIONS = [
  { code: "all", name: "Tất cả cơ sở" },
  { code: "HL", name: "Hòa Lạc" },
  { code: "HCM", name: "TP. Hồ Chí Minh" },
  { code: "DN", name: "Đà Nẵng" },
  { code: "CT", name: "Cần Thơ" },
  { code: "QN", name: "Quy Nhơn" },
];

export function AdminUsersPage() {
  const { session, studentProfile } = useAuth();

  // Filter & pagination state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<AdminUserFilter["role"]>("all");
  const [statusFilter, setStatusFilter] =
    useState<AdminUserFilter["status"]>("all");
  const [campusFilter, setCampusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [limit] = useState(15);

  // Data state
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 15,
    total: 0,
    totalPages: 1,
  });
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalContributors: 0,
    totalAdmins: 0,
    totalDisabled: 0,
  });

  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>();

  // Modals state
  const [roleModalUser, setRoleModalUser] = useState<AdminUserSummary | null>(
    null,
  );
  const [targetRole, setTargetRole] = useState<UserRole>("user");
  const [statusModalUser, setStatusModalUser] =
    useState<AdminUserSummary | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch users data
  const loadUsers = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(undefined);

    try {
      const response = await getAdminUsers(
        {
          search: debouncedSearch.trim() || undefined,
          role: roleFilter,
          status: statusFilter,
          campusCode: campusFilter !== "all" ? campusFilter : undefined,
          page,
          limit,
        },
        session.idToken,
      );

      setUsers(response.items);
      setPagination(response.pagination);
      setStats(response.stats);
    } catch (err: any) {
      setError(err?.message || "Không thể tải danh sách người dùng");
    } finally {
      setLoading(false);
    }
  }, [
    session,
    debouncedSearch,
    roleFilter,
    statusFilter,
    campusFilter,
    page,
    limit,
  ]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Handle role change submit
  const handleConfirmRoleChange = async () => {
    if (!session || !roleModalUser) return;
    setActionLoading(true);
    setError(undefined);
    setSuccessMessage(undefined);

    try {
      await updateRole(roleModalUser.id, targetRole, session.idToken);
      setSuccessMessage(
        `Đã cập nhật vai trò của ${roleModalUser.fullName} thành ${targetRole.toUpperCase()}.`,
      );
      setRoleModalUser(null);
      await loadUsers();
    } catch (err: any) {
      setError(err?.message || "Không thể cập nhật vai trò người dùng");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle status toggle submit
  const handleConfirmStatusChange = async () => {
    if (!session || !statusModalUser) return;
    setActionLoading(true);
    setError(undefined);
    setSuccessMessage(undefined);

    const nextActive = !statusModalUser.isActive;
    try {
      await updateUserStatus(statusModalUser.id, nextActive, session.idToken);
      setSuccessMessage(
        nextActive
          ? `Đã kích hoạt lại tài khoản ${statusModalUser.fullName}.`
          : `Đã tạm khóa tài khoản ${statusModalUser.fullName}.`,
      );
      setStatusModalUser(null);
      await loadUsers();
    } catch (err: any) {
      setError(err?.message || "Không thể cập nhật trạng thái người dùng");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setRoleFilter("all");
    setStatusFilter("all");
    setCampusFilter("all");
    setPage(1);
  };

  const isSelf = (user: AdminUserSummary) => {
    return (
      studentProfile?.id === user.id ||
      studentProfile?.email === user.email ||
      session?.user?.email === user.email
    );
  };

  const getRoleBadgeTone = (role: UserRole) => {
    switch (role) {
      case "admin":
        return "purple";
      case "contributor":
        return "amber";
      default:
        return "slate";
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <UserCog className="h-4 w-4" />
            <span>Quản trị hệ thống</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Quản lý người dùng
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Theo dõi, phân quyền vai trò (User, Contributor, Admin) và quản lý
            trạng thái tài khoản trên toàn hệ sinh thái.
          </p>
        </div>
      </header>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 shadow-sm animate-in fade-in">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <div className="flex-1">{error}</div>
          <button
            onClick={() => setError(undefined)}
            className="text-red-500 hover:text-red-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800 shadow-sm animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <div className="flex-1">{successMessage}</div>
          <button
            onClick={() => setSuccessMessage(undefined)}
            className="text-emerald-600 hover:text-emerald-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Total Users */}
        <div className="rounded-2xl border border-border bg-white p-5 shadow-card transition-all hover:shadow-panel">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Tổng thành viên
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-foreground">
            {stats.totalUsers + stats.totalContributors + stats.totalAdmins}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {stats.totalUsers} sinh viên đã đăng ký
          </div>
        </div>

        {/* Contributors */}
        <div className="rounded-2xl border border-border bg-white p-5 shadow-card transition-all hover:shadow-panel">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Cộng tác viên
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-amber-700">
            {stats.totalContributors}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Quyền đóng góp đề & duyệt OCR
          </div>
        </div>

        {/* Admins */}
        <div className="rounded-2xl border border-border bg-white p-5 shadow-card transition-all hover:shadow-panel">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Quản trị viên
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <ShieldAlert className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-purple-700">
            {stats.totalAdmins}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Toàn quyền quản trị hệ thống
          </div>
        </div>

        {/* Disabled Accounts */}
        <div className="rounded-2xl border border-border bg-white p-5 shadow-card transition-all hover:shadow-panel">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Tài khoản bị khóa
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <UserX className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-red-700">
            {stats.totalDisabled}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Bị vô hiệu hóa đăng nhập
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-2xl border border-border bg-white p-4 shadow-card">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Search box */}
          <div className="relative flex-1 md:max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo họ tên, email hoặc MSSV..."
              className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-9 text-sm text-foreground placeholder:text-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value as any);
                setPage(1);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">Tất cả vai trò</option>
              <option value="user">User (Học viên)</option>
              <option value="contributor">Contributor (Cộng tác viên)</option>
              <option value="admin">Admin (Quản trị viên)</option>
            </select>

            {/* Campus Filter */}
            <select
              value={campusFilter}
              onChange={(e) => {
                setCampusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {CAMPUS_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setPage(1);
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="disabled">Đã bị khóa</option>
            </select>

            {/* Reset Button */}
            {(search ||
              roleFilter !== "all" ||
              statusFilter !== "all" ||
              campusFilter !== "all") && (
              <Button
                variant="ghost"
                onClick={handleResetFilters}
                className="h-9 px-3 text-xs text-slate-500"
                icon={<RotateCcw className="h-3.5 w-3.5" />}
              >
                Đặt lại
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Users Data Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-border bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th scope="col" className="px-6 py-4">
                  Thành viên
                </th>
                <th scope="col" className="px-6 py-4">
                  Cơ sở / Ngành
                </th>
                <th scope="col" className="px-6 py-4 text-center">
                  Lượt làm bài
                </th>
                <th scope="col" className="px-6 py-4">
                  Vai trò
                </th>
                <th scope="col" className="px-6 py-4">
                  Trạng thái
                </th>
                <th scope="col" className="px-6 py-4">
                  Ngày tham gia
                </th>
                <th scope="col" className="px-6 py-4 text-right">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-200" />
                        <div className="space-y-2">
                          <div className="h-4 w-32 rounded bg-slate-200" />
                          <div className="h-3 w-48 rounded bg-slate-100" />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-24 rounded bg-slate-200" />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="mx-auto h-4 w-8 rounded bg-slate-200" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-6 w-20 rounded-full bg-slate-200" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-6 w-20 rounded-full bg-slate-200" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-20 rounded bg-slate-200" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="ml-auto h-8 w-24 rounded bg-slate-200" />
                    </td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      <UserX className="h-6 w-6" />
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-slate-800">
                      Không tìm thấy người dùng phù hợp
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Hãy thử thay đổi từ khóa tìm kiếm hoặc các bộ lọc đã chọn.
                    </p>
                    <div className="mt-4">
                      <Button variant="secondary" onClick={handleResetFilters}>
                        Xóa bộ lọc
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const selfAccount = isSelf(user);
                  return (
                    <tr
                      key={user.id}
                      className="transition-colors hover:bg-slate-50/80"
                    >
                      {/* Member info */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                              user.role === "admin"
                                ? "bg-purple-100 text-purple-700"
                                : user.role === "contributor"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {getInitials(user.fullName)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-semibold text-foreground">
                                {user.fullName}
                              </span>
                              {selfAccount && (
                                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                                  Bạn
                                </span>
                              )}
                            </div>
                            <div className="truncate text-xs text-slate-500">
                              {user.email}
                            </div>
                            {user.studentCode && (
                              <div className="mt-0.5 inline-block text-[11px] font-medium text-slate-400">
                                MSSV: {user.studentCode}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Campus & Major */}
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground">
                          {user.campus?.name ?? "—"}
                        </div>
                        <div className="text-xs text-slate-400">
                          {user.major?.name ?? "Chưa chọn ngành"}
                        </div>
                      </td>

                      {/* Attempts Count */}
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                          {user.attemptsCount}
                        </span>
                      </td>

                      {/* Role */}
                      <td className="px-6 py-4">
                        <Badge tone={getRoleBadgeTone(user.role)}>
                          {user.role === "admin"
                            ? "Admin"
                            : user.role === "contributor"
                              ? "Contributor"
                              : "User"}
                        </Badge>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        {user.isActive ? (
                          <Badge tone="green">Hoạt động</Badge>
                        ) : (
                          <Badge tone="red">Bị khóa</Badge>
                        )}
                      </td>

                      {/* Created At */}
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {new Date(user.createdAt).toLocaleDateString("vi-VN", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Role edit button */}
                          <button
                            onClick={() => {
                              setRoleModalUser(user);
                              setTargetRole(user.role);
                            }}
                            disabled={selfAccount}
                            title={
                              selfAccount
                                ? "Không thể tự thay đổi quyền của chính mình"
                                : "Thay đổi quyền"
                            }
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Shield className="h-3.5 w-3.5 text-slate-500" />
                            <span>Đổi quyền</span>
                          </button>

                          {/* Status toggle button */}
                          <button
                            onClick={() => setStatusModalUser(user)}
                            disabled={selfAccount}
                            title={
                              selfAccount
                                ? "Không thể tự khóa tài khoản của chính mình"
                                : user.isActive
                                  ? "Khóa tài khoản"
                                  : "Mở khóa tài khoản"
                            }
                            className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
                              user.isActive
                                ? "border-red-200 bg-white text-red-600 hover:bg-red-50"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            }`}
                          >
                            {user.isActive ? (
                              <>
                                <Lock className="h-3.5 w-3.5" />
                                <span>Khóa</span>
                              </>
                            ) : (
                              <>
                                <Unlock className="h-3.5 w-3.5" />
                                <span>Mở khóa</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-border bg-slate-50/50 px-6 py-4 sm:flex-row">
          <div className="text-xs text-slate-500">
            Hiển thị{" "}
            <span className="font-semibold text-foreground">
              {pagination.total === 0
                ? 0
                : (pagination.page - 1) * pagination.limit + 1}
            </span>{" "}
            -{" "}
            <span className="font-semibold text-foreground">
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </span>{" "}
            trên tổng số{" "}
            <span className="font-semibold text-foreground">
              {pagination.total}
            </span>{" "}
            người dùng
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={pagination.page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 px-3 text-xs"
              icon={<ChevronLeft className="h-3.5 w-3.5" />}
            >
              Trước
            </Button>
            <span className="px-2 text-xs font-medium text-slate-600">
              Trang {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="secondary"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() =>
                setPage((p) => Math.min(pagination.totalPages, p + 1))
              }
              className="h-8 px-3 text-xs"
              icon={<ChevronRight className="h-3.5 w-3.5" />}
            >
              Sau
            </Button>
          </div>
        </div>
      </div>

      {/* Role Change Modal */}
      {roleModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-modal animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  Phân quyền người dùng
                </h3>
                <p className="text-xs text-slate-500">
                  Cập nhật vai trò quản trị cho thành viên
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              <div className="font-semibold text-foreground">
                {roleModalUser.fullName}
              </div>
              <div className="text-slate-500">{roleModalUser.email}</div>
              {roleModalUser.studentCode && (
                <div className="text-slate-400">
                  MSSV: {roleModalUser.studentCode}
                </div>
              )}
            </div>

            <div className="mt-4 space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Chọn vai trò mới
              </label>
              <div className="space-y-2">
                {[
                  {
                    id: "user",
                    label: "User (Học viên)",
                    desc: "Làm bài thi thử, xem thống kê cá nhân và lưu bookmark.",
                  },
                  {
                    id: "contributor",
                    label: "Contributor (Cộng tác viên)",
                    desc: "Tạo và đóng góp đề thi, tải ZIP, kiểm duyệt kết quả OCR.",
                  },
                  {
                    id: "admin",
                    label: "Admin (Quản trị viên)",
                    desc: "Toàn quyền quản trị hệ thống, quản lý người dùng và phản hồi.",
                  },
                ].map((item) => (
                  <label
                    key={item.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                      targetRole === item.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="userRole"
                      value={item.id}
                      checked={targetRole === item.id}
                      onChange={() => setTargetRole(item.id as UserRole)}
                      className="mt-1 text-primary focus:ring-primary"
                    />
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        {item.label}
                      </div>
                      <div className="text-xs text-slate-500">{item.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => setRoleModalUser(null)}
                disabled={actionLoading}
              >
                Hủy bỏ
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmRoleChange}
                disabled={actionLoading || targetRole === roleModalUser.role}
              >
                {actionLoading ? "Đang cập nhật..." : "Lưu thay đổi"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Status Toggle Modal */}
      {statusModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-modal animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  statusModalUser.isActive
                    ? "bg-red-100 text-red-600"
                    : "bg-emerald-100 text-emerald-600"
                }`}
              >
                {statusModalUser.isActive ? (
                  <Lock className="h-5 w-5" />
                ) : (
                  <Unlock className="h-5 w-5" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  {statusModalUser.isActive
                    ? "Xác nhận khóa tài khoản"
                    : "Xác nhận mở khóa tài khoản"}
                </h3>
                <p className="text-xs text-slate-500">
                  Thay đổi trạng thái đăng nhập của người dùng
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              <div className="font-semibold text-foreground">
                {statusModalUser.fullName}
              </div>
              <div className="text-slate-500">{statusModalUser.email}</div>
            </div>

            <p className="mt-4 text-sm text-slate-600">
              {statusModalUser.isActive ? (
                <>
                  Bạn có chắc chắn muốn{" "}
                  <span className="font-semibold text-red-600">tạm khóa</span>{" "}
                  tài khoản này? Người dùng sẽ không thể đăng nhập hoặc thực
                  hiện bất kỳ bài thi nào.
                </>
              ) : (
                <>
                  Bạn có chắc chắn muốn{" "}
                  <span className="font-semibold text-emerald-700">
                    mở khóa
                  </span>{" "}
                  lại tài khoản này? Người dùng sẽ có thể đăng nhập bình thường.
                </>
              )}
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => setStatusModalUser(null)}
                disabled={actionLoading}
              >
                Hủy bỏ
              </Button>
              <Button
                variant={statusModalUser.isActive ? "danger" : "primary"}
                onClick={handleConfirmStatusChange}
                disabled={actionLoading}
              >
                {actionLoading
                  ? "Đang xử lý..."
                  : statusModalUser.isActive
                    ? "Khóa tài khoản"
                    : "Mở khóa ngay"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
