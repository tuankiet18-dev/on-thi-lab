---
name: web-accessibility
description: >-
  Use this skill when auditing or implementing web accessibility (a11y) to meet
  WCAG 2.2 AA standards. Covers semantic HTML, keyboard navigation, ARIA roles,
  screen reader compatibility, color contrast, and focus management.
---

# Web Accessibility (a11y) Skill

Guidelines for building fully accessible, keyboard-operable, and screen-reader-friendly web interfaces.

---

## 1. Semantic Structure & Landmark Elements

- **Heading Hierarchy**: Maintain a logical heading structure (`<h1>` -> `<h2>` -> `<h3>`) without skipping levels. Only one `<h1>` per page.
- **Landmarks**: Use standard HTML5 landmark elements: `<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`.
- **Buttons vs. Links**:
  - Use `<a>` with `href` for navigation that changes URLs.
  - Use `<button type="button">` for interactive actions (triggering modals, submitting forms, toggling states). Never put `onClick` on a raw `<div>` or `<span>` without keyboard handlers and role.

---

## 2. Keyboard Navigation & Focus Management

1. **Focus Visibility**: Never use `outline: none` without providing an alternative `:focus-visible` ring.
   ```css
   :focus-visible {
     outline: 2px solid var(--accent-color);
     outline-offset: 2px;
   }
   ```
2. **Focus Traps for Modals**: When a modal opens, trap focus within the dialog; restore focus to the trigger element when closed via `Escape` or clicking close.
3. **Skip Links**: Include a hidden "Skip to main content" link for keyboard users.

---

## 3. ARIA & Screen Reader Support

- **First Rule of ARIA**: Prefer native semantic HTML elements over ARIA attributes whenever possible.
- **Form Controls**: Every input must have an associated `<label for="inputId">` or `aria-label`/`aria-labelledby`.
- **Live Regions**: Use `aria-live="polite"` or `role="status"` for dynamic updates (e.g. search count, toast notifications).
- **Icons & Images**:
  - Decorative images/icons: `alt=""` or `aria-hidden="true"`.
  - Informative images: Clear, descriptive `alt="Brief explanation"`.

---

## 4. Visual Accessibility

- **Color Contrast**:
  - Normal text (< 18pt): Minimum contrast ratio of **4.5:1** against background.
  - Large text (≥ 18pt or 14pt bold) and UI components: Minimum **3:1**.
- **Don't rely on color alone**: Use icons or text alongside colors for status badges (e.g. Green checkmark for Success, Red X for Error).
