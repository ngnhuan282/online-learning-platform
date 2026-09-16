---
name: Modern EdTech Platform
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434655'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#006591'
  on-secondary: '#ffffff'
  secondary-container: '#39b8fd'
  on-secondary-container: '#004666'
  tertiary: '#0d46d1'
  on-tertiary: '#ffffff'
  tertiary-container: '#3761ea'
  on-tertiary-container: '#efefff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#c9e6ff'
  secondary-fixed-dim: '#89ceff'
  on-secondary-fixed: '#001e2f'
  on-secondary-fixed-variant: '#004c6e'
  tertiary-fixed: '#dce1ff'
  tertiary-fixed-dim: '#b7c4ff'
  on-tertiary-fixed: '#001551'
  on-tertiary-fixed-variant: '#0039b5'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
  canvas-bg: '#F8FAFC'
  surface-card: '#FFFFFF'
  text-primary: '#0F172A'
  text-secondary: '#64748B'
  border-subtle: '#E2E8F0'
  primary-light: '#DBEAFE'
  status-success: '#16A34A'
  status-warning: '#F59E0B'
  status-error: '#DC2626'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 44px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 18px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system blends **Corporate / Modern SaaS** clarity with a warm, educational aura. It creates a space focused on intellectual curiosity, cognitive flow, and student accomplishment. The interface avoids cold utility on one extreme and playful visual distraction on the other. Instead, it positions itself as an empowering learning partner: structured, dependable, accessible, and intuitive.

### Emotional Resonance & Aesthetic Tenets
- **Cognitive Clarity:** Dense learning materials are broken down through generous whitespace, high-contrast typography, and explicit visual hierarchy.
- **Supportive & Encouraging:** Interactions provide reassuring, immediate feedback through clear semantic signaling (completions, validations, progression trackers).
- **Crisp Architecture:** Defined by structured light surfaces (`#FFFFFF`) floating over a calm, cool-tinted canvas (`#F8FAFC`), framed by fine borders (`#E2E8F0`) and diffused slate shadows.
- **Restrained Vibrancy:** High-energy Blue-Cyan linear shifts are limited to high-impact moments—the hero canvas, marketing banners, and AI mentorship surfaces. Operational workspaces remain distraction-free.

## Colors

The palette relies on optical balance and clear functional roles. A focused set of blues anchors focus, commands attention on interactive controls, and guides learning milestones without overwhelming cognitive processing.

### Application Guidelines
- **Primary (`#2563EB`):** The functional foundation. Used for primary CTAs, active tab indicators, selected radio/checkbox marks, and live course progress rings. On hover/press, it transitions to Tertiary Dark (`#1D4ED8`).
- **Accent Blue (`#0EA5E9`):** Reserved for generative AI tools, contextual tips, and secondary highlights. It serves as the terminal stop in hero and dynamic interface gradients.
- **Surface & Canvas Architecture:** Base layouts sit on `canvas-bg` (`#F8FAFC`). Core modules, lesson outlines, cards, and modal sheets use pure `surface-card` (`#FFFFFF`). Component separation is reinforced by a crisp 1px stroke using `border-subtle` (`#E2E8F0`).
- **Semantic Feedback:**
  - **Success (`#16A34A`):** Course completed, correct quiz submission, successful checkout validation.
  - **Warning (`#F59E0B`):** Pending assignment submission, expiring subscription, unreviewed coursework.
  - **Error (`#DC2626`):** Failed quiz submission, validation alerts, destructive cancellation actions.
- **Hero & AI Gradient Tokens:** Use `linear-gradient(135deg, #2563EB 0%, #0EA5E9 100%)` exclusively for marketing hero backdrops, promotional banners, and AI assistant badges/accents. Never apply full gradients to standard buttons, data tables, or learning dashboards.

## Typography

The typographic system pairs the geometry and soft apertures of **Plus Jakarta Sans** for headings with the neutral legibility of **Inter** for dense instructional copy, forms, and data tables.

- **Headlines:** Set in Plus Jakarta Sans to introduce warmth and contemporary personality across promotional landing pages and course milestone screens. Tight negative tracking (`-0.01em` to `-0.02em`) preserves visual cohesion at large scales.
- **Body & Instructional Copy:** Set in Inter with regular tracking and generous line heights (1.5x minimum), creating a comfortable reading rhythm during long study sessions, code snippets, and review sections.
- **Labels & Microcopy:** Inter Medium and SemiBold ensure unambiguous scannability on small form elements, course time-stamps, tags, and tabular data.

## Layout & Spacing

Layouts follow an explicit **8px baseline rhythm**, generating structured page pacing across every form factor.

### Layout Grid Architecture
- **Desktop (1440px / 1280px):** Standard 12-column fluid grid bounded by a max-width container of `1280px` or `1440px` (dependent on dashboard vs. marketing scope). Standard gutter is `24px` (`1.5rem`), with outer margins of `32px` (`2rem`).
- **Tablet (768px - 1024px):** 8-column layout. Gutters and canvas margins scale down to `20px`.
- **Mobile (375px - 428px):** 4-column layout. Gutters and section margins collapse to `16px` (`1rem`).

### Specialized Interface Templates
- **Active Learning Studio:** Implements a split workspace. The left player/content area maintains a 70% width share (with the video player locked to a `16:9` aspect ratio), while the curriculum timeline and interactive notes pane occupies the right 30% width (min `320px`). On viewports `<1024px`, the layout shifts into a stacked column where the video player anchors the top in sticky positioning.
- **Dual-Pane Checkout & Auth:** Authenticated checkout divides into an asymmetric 60/40 spread (Order Details vs. Sticky Order Summary). Auth forms center a 480px form card or expand to an asymmetric 50/50 visual split on viewports `≥1024px`.

## Elevation & Depth

Visual depth avoids dense, muddied drop shadows. Instead, it relies on crisp structural borders paired with diffused, slate-tinted ambient glows that simulate elevated physical planes.

### Elevation Levels
- **Level 0 (Flat Canvas / Ground):** Background `#F8FAFC`. Zero shadow. Used for base viewport backgrounds, inset table wells, and disabled block states.
- **Level 1 (Card / Rest Surface):** Background `#FFFFFF`, 1px solid border (`#E2E8F0`), shadow: `0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(15, 23, 42, 0.02)`. Standard state for course cards, assignment listings, and structural content sections.
- **Level 2 (Hover / Elevated Panels):** Background `#FFFFFF`, 1px solid border (`#CBD5E1`), shadow: `0 4px 16px rgba(15, 23, 42, 0.06), 0 2px 4px rgba(15, 23, 42, 0.03)`. Used for interactive card hover states, active module cards, and secondary flyouts.
- **Level 3 (Overlay / Menus / Modals):** Background `#FFFFFF`, hairline border (`#E2E8F0`), shadow: `0 12px 32px rgba(15, 23, 42, 0.10), 0 4px 8px rgba(15, 23, 42, 0.04)`. Applied to global search modals, profile dropdown menus, and sticky navigation headers.

## Shapes

The design system employs a **Rounded** shape language, balancing friendly geometric curvature with modern enterprise discipline.

### Geometry Rules
- **Interactive Controls (Buttons, Form Inputs, Dropdowns):** `8px` to `10px` (`rounded-md` to standard base border radius). This produces clean, clickable surfaces that maintain a sharp, focused profile.
- **Containers (Cards, Progress Panels, Module Blocks):** `14px` to `16px` (`rounded-lg`). Softer card perimeters organize dense arrays of instructional material into distinct, welcoming parcels.
- **Overlays (Modals, Full-bleed Drawers):** `16px` to `20px` (`rounded-xl`) on external card frames, creating clear visual separation against the backdrop.
- **Badges, Status Chips, Avatar Masks:** Fully rounded pills (`9999px` / `rounded-full`) for high-contrast tag identification and round avatar framing.

## Components

### Buttons
- **Primary:** Background `#2563EB`, text `#FFFFFF`, border: none, border radius `8px` to `10px`. Hover: `#1D4ED8`. Active: `#1E40AF`. Focus: 2px offset ring in `#93C5FD`. Height: `44px` (Desktop/Form default), `36px` (Compact/Table actions).
- **Secondary / Outline:** Background `#FFFFFF`, text `#2563EB`, border `1px solid #2563EB`. Hover: Background `#DBEAFE` (10% tint).
- **Tertiary / Ghost:** Background transparent, text `#64748B`. Hover: Background `#F1F5F9`, text `#0F172A`.

### Form Inputs & Selects
- **Base Style:** Background `#FFFFFF`, border `1px solid #E2E8F0`, border radius `8px` to `10px`, padding `10px 14px`. Typography: `body-md` (`16px` to prevent iOS zoom).
- **States:** Focus sets border to `#2563EB` with an ambient glow (`box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15)`). Error shifts border to `#DC2626` with matching error glow. Trailing icons are reserved for clearing text, password visibility toggles, or dropdown indicators.

### Course & Feature Cards
- **Structure:** Encased in `#FFFFFF`, border `1px solid #E2E8F0`, border radius `16px`, padding `16px` or `20px`. Subtle elevation Level 1.
- **Interactive Motion:** Hover triggers an elevation bump to Level 2 and an upward translation (`transform: translateY(-2px); transition: all 200ms ease-in-out`). Media thumbnails preserve a strict `16:9` ratio with `10px` inner corner radii.

### Chips & Semantic Badges
- **Display:** Height `24px` to `28px`, border radius `9999px`, font size `12px` (`label-sm`), font weight `600`.
- **Variants:**
  - *Published / Completed:* Background `#DCFCE7`, text `#16A34A`.
  - *In Progress / Warning:* Background `#FEF3C7`, text `#D97706`.
  - *Required / Error:* Background `#FEE2E2`, text `#DC2626`.
  - *Category / Neutral:* Background `#F1F5F9`, text `#475569`.

### Checkboxes & Radio Controls
- **Geometry:** Checkboxes use `6px` radius; Radio buttons use `50%` round geometry. Both dimensioned to `18px × 18px`.
- **States:** Unselected uses border `1.5px solid #CBD5E1`. Checked fills with `#2563EB` displaying a crisp white SVG check or center dot.

### Specialized EdTech Components
- **Lesson Curriculum Accordion:** Structured list modules with clear parent-child nesting. Active lessons highlight with `#DBEAFE` background tint, `#2563EB` left-hand indicator bar (width `3px`), and dark text `#0F172A`.
- **Progress Trackers:** Linear horizontal progress bars with `8px` height, track background `#E2E8F0`, and animated fill in `#2563EB` (or `#16A34A` upon 100% completion).
- **AI Learning Assistant Flyout:** Encased in a subtle gradient border using `#2563EB` to `#0EA5E9`. Internal chat bubbles alternate between `#F1F5F9` (User) and `#DBEAFE` (Assistant response).