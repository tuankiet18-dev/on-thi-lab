---
name: web-performance
description: >-
  Use this skill when auditing, profiling, or optimizing web application performance,
  page load speed, Core Web Vitals (LCP, INP, CLS), asset delivery, bundle size,
  memoization, and runtime rendering efficiency.
---

# Web Performance Optimization Skill

A systematic guide for achieving sub-second page loads, 60fps UI responsiveness, and perfect Core Web Vitals across web applications.

---

## 1. Core Web Vitals (CWV) Checklist

1. **LCP (Largest Contentful Paint < 2.5s)**:
   - Preload the LCP image or main hero font in `<head>`:
     ```html
     <link rel="preload" as="image" href="/hero.webp" fetchpriority="high" />
     ```
   - Avoid render-blocking stylesheets or synchronous JavaScript in `<head>`.
   - Use modern formats (`WebP`, `AVIF`) with explicit `width` and `height`.

2. **INP (Interaction to Next Paint < 200ms)**:
   - Break long tasks (> 50ms) using `scheduler.yield()` or `setTimeout(..., 0)`.
   - Debounce and throttle high-frequency events (scroll, resize, search input).
   - Use `useTransition` or `useDeferredValue` in React for non-urgent UI updates.

3. **CLS (Cumulative Layout Shift < 0.1)**:
   - Always specify aspect ratios or explicit `width`/`height` on images, videos, and canvas.
   - Reserve space for dynamic content, banners, or ads using CSS `min-height` or skeleton placeholders.
   - Use `font-display: swap` paired with size-adjust fallback font metrics.

---

## 2. JavaScript Bundle & Rendering Optimization

- **Code Splitting & Lazy Loading**: Split heavy routes and modal components with `React.lazy()` or dynamic imports `import()`.
- **Avoid Expensive Re-renders**:
  - Keep state as local as possible.
  - Memoize heavy computations with `useMemo()` and stable callbacks with `useCallback()`.
  - Use virtualization (e.g. `@tanstack/react-virtual`) when rendering lists with > 100 items.
- **Tree-Shaking**: Import specific lodash/date functions (`import debounce from 'lodash-es/debounce'`) instead of full library imports.

---

## 3. Caching & Network Strategies

- **HTTP Cache Headers**:
  - Immutable assets (`/assets/*.js`, `/assets/*.css` with hash): `Cache-Control: public, max-age=31536000, immutable`.
  - HTML & dynamic routes: `Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=300`.
- **Compression**: Enable Brotli (`br`) or Gzip on reverse proxies / CDNs.
