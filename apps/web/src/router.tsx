import {
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { AppShell, PlaceholderPage } from "./components/AppShell";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { AdminImportPage } from "./pages/AdminImportPage";
import { AdminReviewPage } from "./pages/AdminReviewPage";
import { AttemptPage } from "./pages/AttemptPage";
import { CatalogPage } from "./pages/CatalogPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ExamDetailPage } from "./pages/ExamDetailPage";
import { LoginPage } from "./pages/LoginPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { ResultPage } from "./pages/ResultPage";

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
  component: () => <PlaceholderPage title="Lịch sử làm bài" />,
});

const statisticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/statistics",
  component: () => <PlaceholderPage title="Thống kê học tập" />,
});

const adminImportRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/import",
  component: AdminImportPage,
});

const adminReviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/exams/$examId/review",
  component: AdminReviewPage,
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
  adminImportRoute,
  adminReviewRoute,
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
