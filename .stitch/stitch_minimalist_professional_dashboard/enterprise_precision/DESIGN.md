---
name: Enterprise Precision
colors:
  surface: '#fcf8fa'
  surface-dim: '#dcd9db'
  surface-bright: '#fcf8fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f5'
  surface-container: '#f0edef'
  surface-container-high: '#eae7e9'
  surface-container-highest: '#e4e2e4'
  on-surface: '#1b1b1d'
  on-surface-variant: '#45464d'
  inverse-surface: '#303032'
  inverse-on-surface: '#f3f0f2'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#006781'
  on-secondary: '#ffffff'
  secondary-container: '#8fdfff'
  on-secondary-container: '#00647d'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#271901'
  on-tertiary-container: '#98805d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#b9eaff'
  secondary-fixed-dim: '#81d1f0'
  on-secondary-fixed: '#001f29'
  on-secondary-fixed-variant: '#004d62'
  tertiary-fixed: '#fcdeb5'
  tertiary-fixed-dim: '#dec29a'
  on-tertiary-fixed: '#271901'
  on-tertiary-fixed-variant: '#574425'
  background: '#fcf8fa'
  on-background: '#1b1b1d'
  surface-variant: '#e4e2e4'
  deep-slate: '#1E293B'
  surface-gray: '#F8FAFC'
  border-subtle: '#E2E8F0'
  status-high: '#BE123C'
  status-medium: '#B45309'
  status-low: '#15803D'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.01em
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  page-margin: 2rem
  section-gap: 1.5rem
  gutter: 1rem
  card-padding: 1.25rem
  element-gap: 0.5rem
---

## Brand & Style

The design system is anchored in **Minimalism** and **Modern Corporate** aesthetics. It is designed specifically for high-stakes project tracking where clarity and speed of information retrieval are paramount. The visual narrative focuses on "Quiet Authority"—a professional atmosphere that feels reliable and organized without being overly rigid.

**Key Brand Pillars:**
- **Clarity over Decoration:** Every line, shadow, and color choice must serve a functional purpose in communicating project status.
- **Controlled Density:** Information-dense dashboards are balanced with generous whitespace to prevent cognitive overload.
- **Institutional Trust:** A palette and layout that reflect the stability and precision required by the Enterprise Division.
- **Focus:** Subtle depth through shadows and tonal layering directs the user’s eye toward active priorities and high-level summaries.

## Colors

The palette is intentionally restrained to maintain a professional "Enterprise" feel.
- **Primary (Deep Slate):** Used for primary navigation, headings, and high-impact UI elements. It provides a grounded, authoritative feel.
- **Secondary (Refined Cyan/Navy):** Serves as the primary action color and active state indicator.
- **Surfaces:** A range of soft grays (Slate 50 to 100) are used to differentiate content areas without the harshness of pure white or heavy borders.
- **Semantic Logic:** Status colors (High, Medium, Low priority) are slightly desaturated to fit the professional context while remaining distinct enough for immediate recognition.

## Typography

This design system utilizes **Inter** for all roles to achieve a clean, systematic appearance. Inter’s tall x-height and excellent legibility make it ideal for data-heavy project dashboards.

- **Weight Strategy:** Use `600` (SemiBold) for headlines and `400` (Regular) for body text to create a clear visual hierarchy.
- **Labeling:** Small labels (`label-md` and `label-caps`) are used for status badges and metadata to maintain a clean aesthetic without occupying significant space.
- **Tight Leading:** For headlines, line height is kept tight to maintain a cohesive look, while body text uses a more open 1.5–1.6 leading for better readability during long-form reading (e.g., project descriptions).

## Layout & Spacing

The layout follows a **Fixed-Fluid Hybrid** model. Navigation and sidebars are fixed, while the main dashboard area utilizes a 12-column fluid grid that adapts to screen width.

**Layout Rules:**
- **Desktop (1280px+):** 12-column grid with 32px margins. Sidebars are fixed at 280px.
- **Tablet (768px - 1024px):** 8-column grid with 24px margins. Navigation collapses into a condensed icon-only bar or a hamburger menu.
- **Mobile (<768px):** Single-column vertical stack with 16px margins. Cards span the full width.

**Spacing Rhythm:** Use a strict 4px/8px incremental system. Components should prioritize whitespace to avoid the "cluttered spreadsheet" feel common in legacy enterprise tools.

## Elevation & Depth

Hierarchy is established using **Tonal Layers** supplemented by **Subtle Shadows**. 

- **Surface Levels:** 
    - Level 0 (Background): Soft Gray (`#F8FAFC`)
    - Level 1 (Cards/Sidebar): Pure White (`#FFFFFF`)
- **Shadow Profile:** Shadows must be extremely diffused and low-opacity. Use a multi-layered shadow (e.g., `0 1px 3px rgba(0,0,0,0.05), 0 10px 15px -3px rgba(0,0,0,0.02)`) to create a soft, natural lift for active cards.
- **Outlines:** Use 1px thin borders in `border-subtle` for all interactive elements and card containers to ensure definition on white backgrounds.

## Shapes

The shape language is **Soft**, striking a balance between modern friendliness and corporate precision.

- **Small Components:** Checkboxes and small tags use `rounded-sm` (4px).
- **Standard Components:** Buttons, Input fields, and Cards use the default `rounded` (8px) for a crisp, professional appearance.
- **Interactive States:** Progress bars and profile avatars may use `rounded-full` (Pill-shaped) to provide visual variety and signify "completion" or "identity."

## Components

### Buttons
- **Primary:** Solid `deep-slate` background with white text. No gradients.
- **Secondary:** Ghost style with a `border-subtle` and `deep-slate` text.
- **Action:** Subtle navy/cyan text with no border for tertiary actions.

### Cards
- White background, 1px `border-subtle`, and a Level 1 shadow. 
- Padding should be generous (`card-padding`) to allow the project name and status to breathe.

### Input Fields
- White background with `border-subtle`. 
- Focus state: Border changes to `secondary_color_hex` with a 2px soft outer glow (0% blur).

### Status Chips
- **High Priority:** Soft red background with `status-high` text.
- **In Progress:** Soft blue/cyan background with `secondary_color_hex` text.
- **Completed:** Soft green background with `status-low` text.

### Progress Bars
- Use a background of `border-subtle` and a fill of `secondary_color_hex`. The progress bar should be thin (8px height) to maintain the minimalist feel.

### Lists & Tables
- Remove vertical borders. Use thin horizontal separators. 
- Rows should have a subtle background hover state (`surface-gray`) to aid trackability.