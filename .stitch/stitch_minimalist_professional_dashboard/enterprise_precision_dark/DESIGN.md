---
name: Enterprise Precision Dark
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#c5c6cd'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#8f9097'
  outline-variant: '#45474c'
  surface-tint: '#bcc7de'
  primary: '#bcc7de'
  on-primary: '#263143'
  primary-container: '#1e293b'
  on-primary-container: '#8590a6'
  inverse-primary: '#545f73'
  secondary: '#89ceff'
  on-secondary: '#00344d'
  secondary-container: '#00a2e6'
  on-secondary-container: '#00344e'
  tertiary: '#b9c8de'
  on-tertiary: '#233143'
  tertiary-container: '#1b2a3b'
  on-tertiary-container: '#8291a6'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e3fb'
  primary-fixed-dim: '#bcc7de'
  on-primary-fixed: '#111c2d'
  on-primary-fixed-variant: '#3c475a'
  secondary-fixed: '#c9e6ff'
  secondary-fixed-dim: '#89ceff'
  on-secondary-fixed: '#001e2f'
  on-secondary-fixed-variant: '#004c6e'
  tertiary-fixed: '#d4e4fa'
  tertiary-fixed-dim: '#b9c8de'
  on-tertiary-fixed: '#0d1c2d'
  on-tertiary-fixed-variant: '#39485a'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
  surface-charcoal: '#0f172a'
  surface-slate: '#1e293b'
  on-surface-bright: '#f8fafc'
  on-surface-muted: '#94a3b8'
  border-low-opacity: rgba(226, 232, 240, 0.1)
  status-high: '#fb7185'
  status-medium: '#fbbf24'
  status-low: '#4ade80'
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

The design system is a high-performance, **Dark Mode** evolution of the Enterprise Precision aesthetic. It transitions the "Quiet Authority" narrative into a low-light environment optimized for long-duration focus and reduced eye strain. The style is strictly **Minimalist** with a **Corporate Modern** backbone, emphasizing high-contrast legibility and structural discipline.

**Key Brand Pillars:**
- **Luminous Precision:** In a dark interface, light is used sparingly and strategically to denote action and importance against deep, recessed surfaces.
- **Architectural Depth:** Utilizing a tiered slate-and-charcoal palette to create a sense of physical space and hierarchy without relying on traditional shadows.
- **Focus-Centric:** Reducing visual noise through limited color hits and expansive dark space, allowing data and status indicators to emerge with clarity.

## Colors

The palette is inverted for high-stakes, low-light productivity. It prioritizes deep Slates and Charcoals to maintain the professional "Enterprise" feel while ensuring all interactive elements remain accessible.

- **Primary (Deep Slate):** The primary container and component surface color. It provides a sophisticated, matte finish for UI elements.
- **Secondary (Sky Blue):** Shifted to a more vibrant cyan-blue to ensure high contrast against dark backgrounds; used for primary actions and active indicators.
- **Neutral (Charcoal):** The foundation background color (`#0f172a`), providing the deepest level of the interface.
- **Typography:** Uses a tiered system of Whites and Light Grays. `on-surface-bright` is reserved for headings, while `on-surface-muted` handles secondary metadata and labels.

## Typography

This design system utilizes **Inter** exclusively. In dark mode, font weights are carefully managed to prevent "blooming" (where light text appears thicker on dark backgrounds).

- **Hierarchy:** Headlines use `on-surface-bright` to command attention. Body text uses a slightly desaturated gray to improve long-form reading comfort.
- **Precision:** The `label-caps` role is essential for metadata and table headers, providing a sharp, utilitarian contrast to the larger headline styles.
- **Anti-Aliasing:** Ensure text rendering is optimized for dark backgrounds to maintain the crispness of Inter’s geometry.

## Layout & Spacing

The layout follows a **Fixed-Fluid Hybrid** model. The spatial rhythm is identical to its light-mode counterpart to ensure a seamless transition for cross-platform users.

**Layout Rules:**
- **Structural Integrity:** Navigation and sidebars are fixed at 280px.
- **Grid:** A 12-column fluid grid in the main viewport with 32px margins on desktop.
- **Negative Space:** In dark mode, whitespace (blackspace) is used to separate distinct functional areas, reducing the need for heavy visual dividers.

## Elevation & Depth

Hierarchy is established through **Tonal Layers** rather than shadows. In dark mode, higher elevation is communicated by lighter surface colors.

- **Level 0 (Background):** Deep Charcoal (`#0f172a`). Used for the main application background.
- **Level 1 (Surface):** Deep Slate (`#1e293b`). Used for cards, sidebars, and floating panels.
- **Outlines:** Instead of ambient shadows, this design system uses **Low-contrast outlines** (`border-low-opacity`) to define boundaries. This creates a "glass-like" or "milled metal" feel that is sharper and more precise for enterprise data.

## Shapes

The shape language is **Soft**, but leans toward the sharper end of the spectrum to maintain a technical, engineered appearance.

- **Standard Elements:** Buttons, inputs, and cards use `0.25rem` (4px) or `0.5rem` (8px) radii.
- **Data Elements:** Status chips and small badges use the smaller `0.125rem` (2px) radius to feel more like "tags" and less like "buttons."

## Components

### Buttons
- **Primary:** `secondary_color_hex` (Sky Blue) background with `neutral_color_hex` text for maximum pop.
- **Secondary:** Transparent with `border-low-opacity` and `on-surface-bright` text.
- **Action:** Text-only in `on-surface-muted`, shifting to `on-surface-bright` on hover.

### Cards
- Surface color: `primary_color_hex` (Slate).
- Border: 1px `border-low-opacity`. 
- Content: Ensure `on-surface-bright` for titles and `on-surface-muted` for descriptions.

### Input Fields
- Background: `neutral_color_hex` (Charcoal) to create an "etched" look into the slate surfaces.
- Border: `border-low-opacity`.
- Focus: Border changes to `secondary_color_hex` with a subtle outer glow.

### Status Chips
- **High Priority:** `status-high` text with a 10% opacity background of the same color.
- **Medium Priority:** `status-medium` text with a 10% opacity background.
- **Low Priority:** `status-low` text with a 10% opacity background.

### Progress Bars
- Track: `border-low-opacity`.
- Fill: `secondary_color_hex`.
- Height: 6px for a refined, technical look.