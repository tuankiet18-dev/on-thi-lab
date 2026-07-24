import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { AppShell, PlaceholderPage } from "./components/AppShell";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { AdminImportPage } from "./pages/AdminImportPage";
import { AdminReportPage } from "./pages/AdminReportPage";
import { AdminReviewPage } from "./pages/AdminReviewPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { AttemptPage } from "./pages/AttemptPage";
import { CatalogPage } from "./pages/CatalogPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ExamDetailPage } from "./pages/ExamDetailPage";
import { LoginPage } from "./pages/LoginPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { ResultPage } from "./pages/ResultPage";
import { HistoryPage } from "./pages/HistoryPage";

const rootRoute = createRootRoute({
  component: AppShell,
  notFoundComponent: () => (
    <PlaceholderPage title="Không tìm thấy trang bạn yêu cầu" />
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

const authCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth/callback",
  component: AuthCallbackPage,
});

const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/onboarding",
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: search.redirect as string | undefined,
  }),
  component: OnboardingPage,
});

const catalogRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/exams",
  component: CatalogPage,
});

const examDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/exams/$examId",
  component: ExamDetailPage,
});

const attemptRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/attempts/$attemptId",
  component: AttemptPage,
});

const resultRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/results/$attemptId",
  component: ResultPage,
});

const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/history",
  component: HistoryPage,
});

const statisticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/statistics",
  component: () => <PlaceholderPage title="Thống kê học tập" />,
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
});

const adminImportRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "import",
  component: AdminImportPage,
});

const adminReportsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "reports",
  component: AdminReportPage,
});

const adminReviewRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "exams/$examId/review",
  component: AdminReviewPage,
});

const adminUsersRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: "users",
  component: AdminUsersPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  authCallbackRoute,
  onboardingRoute,
  catalogRoute,
  examDetailRoute,
  attemptRoute,
  resultRoute,
  historyRoute,
  statisticsRoute,
  adminRoute.addChildren([
    adminImportRoute,
    adminReviewRoute,
    adminReportsRoute,
    adminUsersRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultPreloadStaleTime: 30_000,
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
