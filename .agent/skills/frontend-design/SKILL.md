---
name: frontend-design
description: >-
  Use this skill when designing or implementing frontend interfaces, UI components,
  or web layouts. Provides actionable guidance on distinctive visual aesthetics,
  typography pairings, color harmonies, micro-interactions, responsive architecture,
  and avoiding generic template clichés.
---

# Frontend Design Skill

This skill guides the design and implementation of modern, distinctive, production-ready frontend interfaces that avoid generic, AI-templated defaults.

---

## 1. Core Principles

1. **Function-First & Subject-Grounded**:
   - Understand the primary user task before writing styling.
   - Ground the visual language in the domain (e.g., student examination, question cards, timer bar, instant feedback).

2. **Intentional Typography**:
   - Avoid generic fallback fonts. Pair distinct display fonts with highly legible body faces (e.g., Outfit/Inter, Syne/Plus Jakarta Sans, Space Grotesk/Inter).
   - Establish a deliberate typographic scale: tight tracking for headings, comfortable line heights (1.5–1.7) for long text.

3. **Curated Color & Depth**:
   - Use purposeful HSL / OKLCH color palettes with distinct contrast ratios (WCAG AA/AAA).
   - Create natural depth using subtle layered surfaces, border opacity, and layered shadows rather than heavy harsh borders.

4. **Micro-Interactions & Fluid Motion**:
   - Add state transitions (hover, active, focus-visible) on interactive elements.
   - Use CSS transitions (150ms–250ms with `cubic-bezier(0.16, 1, 0.3, 1)` or `ease-out`) for smooth state changes.

---

## 2. Forbidden Cliché Patterns (What to Avoid)

- ❌ **No Purple-on-Dark Overuse**: Avoid generic purple/violet gradients on black backgrounds unless explicitly requested.
- ❌ **No Icon-Stuffed Bento Boxes**: Do not put random decorative icons in every card header.
- ❌ **No Decorative Number Pills**: Avoid `01 / 02 / 03` labels unless the content is genuinely an ordered sequence.
- ❌ **No Over-Nested Cards**: Avoid placing rounded cards inside 3+ levels of nested cards.
- ❌ **No Untracked Large Headings**: Always set appropriate letter-spacing when heading font-size exceeds 24px.

---

## 3. Implementation Workflow

### Step 1: Establish Tokens & Design Hierarchy

Define CSS custom properties or Tailwind tokens for:

- Colors: `surface-0`, `surface-1`, `surface-2`, `accent-primary`, `accent-subtle`, `text-primary`, `text-secondary`, `border-subtle`.
- Radii: `radius-sm` (4px), `radius-md` (8px), `radius-lg` (12px), `radius-full` (9999px).

### Step 2: Component Architecture

- Keep UI components focused and modular (e.g., `<Button>`, `<Card>`, `<Badge>`, `<Dialog>`, `<Input>`).
- Support explicit semantic states: `default`, `hover`, `focus-visible`, `disabled`, `loading`, `error`.

### Step 3: Responsive & Accessible Layouts

- Mobile-first approach: test layouts across 320px, 768px, 1024px, and 1440px.
- Ensure all interactive elements have visible `:focus-visible` outlines and keyboard navigation support (`Tab`, `Enter`, `Space`, `Escape`).
