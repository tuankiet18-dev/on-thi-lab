---
name: nextjs-best-practices
description: >-
  Use this skill when developing Next.js applications (App Router, Server Components,
  Route Handlers, Server Actions, Caching, Middleware, and SEO optimization).
---

# Next.js App Router Best Practices

Authoritative guide for building scalable, high-performance web applications using the Next.js App Router.

---

## 1. Server vs. Client Component Boundaries

- **Default to Server Components**: Fetch data directly in React Server Components (RSC) to reduce client bundle size and latency.
- **Push `'use client'` to the Leaves**: Only wrap leaf components that require interactivity (state, event listeners, browser APIs, custom hooks).
- **Passing Props across Boundaries**: Pass serializable data or pass Server Components as `children` into Client Components to prevent client-side waterfall imports.

```tsx
// ✅ Good: Server Component wrapper with interactive client child
// app/dashboard/page.tsx (Server Component)
import { InteractiveChart } from "@/components/InteractiveChart";
import { getAnalyticsData } from "@/lib/data";

export default async function DashboardPage() {
  const data = await getAnalyticsData(); // Direct database/backend fetch
  return (
    <main>
      <h1>Dashboard</h1>
      <InteractiveChart initialData={data} />
    </main>
  );
}
```

---

## 2. Data Fetching & Caching Strategies

- **Use Route Segment Configs**:
  - `export const dynamic = 'force-dynamic'` for real-time, un-cached pages.
  - `export const revalidate = 3600` for periodic ISR (Incremental Static Regeneration).
- **Tag-Based Cache Revalidation**:
  ```ts
  // Fetch with cache tag
  const res = await fetch("https://api.example.com/items", {
    next: { tags: ["catalog-items"] },
  });

  // Revalidate on mutation
  import { revalidateTag } from "next/cache";
  export async function updateItemAction() {
    "use server";
    // ... DB mutation ...
    revalidateTag("catalog-items");
  }
  ```

---

## 3. Route Handlers & Server Actions

- **Server Actions for Form Submissions**: Validate input with Zod, check authentication, perform mutation, and call `revalidatePath()` or `redirect()`.
- **Route Handlers (`app/api/.../route.ts`)**: Use for webhooks, external consumer APIs, or binary streaming (file downloads, OCR blobs).
- **Error Handling**: Use `error.tsx` for error boundaries and `not-found.tsx` for 404 views.
