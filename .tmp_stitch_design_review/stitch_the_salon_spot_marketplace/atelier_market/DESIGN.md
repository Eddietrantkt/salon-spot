---
name: Atelier Market
colors:
  surface: '#fbf9f8'
  surface-dim: '#dbdad9'
  surface-bright: '#fbf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3f3'
  surface-container: '#efeded'
  surface-container-high: '#e9e8e7'
  surface-container-highest: '#e4e2e2'
  on-surface: '#1b1c1c'
  on-surface-variant: '#444748'
  inverse-surface: '#303031'
  inverse-on-surface: '#f2f0f0'
  outline: '#747878'
  outline-variant: '#c4c7c7'
  surface-tint: '#5f5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1c1b1b'
  on-primary-container: '#858383'
  inverse-primary: '#c8c6c5'
  secondary: '#775a19'
  on-secondary: '#ffffff'
  secondary-container: '#fed488'
  on-secondary-container: '#785a1a'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1b1c19'
  on-tertiary-container: '#848480'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e5e2e1'
  primary-fixed-dim: '#c8c6c5'
  on-primary-fixed: '#1c1b1b'
  on-primary-fixed-variant: '#474746'
  secondary-fixed: '#ffdea5'
  secondary-fixed-dim: '#e9c176'
  on-secondary-fixed: '#261900'
  on-secondary-fixed-variant: '#5d4201'
  tertiary-fixed: '#e4e2dd'
  tertiary-fixed-dim: '#c8c6c2'
  on-tertiary-fixed: '#1b1c19'
  on-tertiary-fixed-variant: '#474744'
  background: '#fbf9f8'
  on-background: '#1b1c1c'
  surface-variant: '#e4e2e2'
typography:
  display-lg:
    fontFamily: Libre Caslon Text
    fontSize: 48px
    fontWeight: '400'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Libre Caslon Text
    fontSize: 32px
    fontWeight: '400'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Libre Caslon Text
    fontSize: 28px
    fontWeight: '400'
    lineHeight: 36px
  headline-md:
    fontFamily: Libre Caslon Text
    fontSize: 24px
    fontWeight: '400'
    lineHeight: 32px
  body-lg:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Manrope
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Manrope
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 48px
  xl: 80px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 64px
---

## Brand & Style

The design system is built for a premium, professional marketplace that bridges the gap between luxury salon spaces and independent beauty professionals. The personality is **Sophisticated, Reliable, and Calm**. It avoids industry cliches in favor of an editorial, high-end architectural aesthetic.

The style is **Modern Corporate with Tactile accents**. It prioritizes high-quality photography of workspaces, using a "Gallery" approach where the UI acts as a refined frame. Expect ample white space, purposeful typography, and a "soft-luxury" feel achieved through subtle depth and a restrained palette.

## Colors

The palette is anchored in **Warm Neutrals** to create a welcoming yet professional environment.

- **Primary (Deep Charcoal):** Used for primary actions, headings, and high-contrast UI elements to ensure a sense of authority and permanence.
- **Secondary (Muted Bronze):** A sophisticated accent used sparingly for active states, premium badges, and subtle highlights.
- **Tertiary (Cream/Alabaster):** The primary surface color for containers and sections, providing a softer alternative to pure white.
- **Surface (Crisp White):** Used for the most elevated cards and input fields to ensure clarity and cleanliness.
- **Functional Colors:** 
  - Success: Olive Green (#606C38)
  - Warning: Ochre (#B08968)
  - Error: Deep Crimson (#7B2C2C)

## Typography

This design system utilizes a high-contrast typographic pairing to signal "Premium Marketplace."

- **Heading (Libre Caslon Text):** Used for titles, workspace names, and editorial sections. Its classic proportions convey heritage and beauty.
- **Body (Manrope):** A modern, technical sans-serif used for all functional UI components, descriptions, and data. It ensures high legibility on mobile devices.
- **Labels:** Use uppercase styling with increased letter spacing for category headers and navigation items to create a clean, organized hierarchy.

## Layout & Spacing

The layout follows a **8px linear scale** to ensure mathematical harmony across all components.

- **Desktop:** 12-column fluid grid with 24px gutters. Max-width container of 1440px.
- **Mobile:** 4-column grid with 16px margins. 
- **Rhythm:** Use `lg` (48px) spacing between major sections and `md` (24px) for internal card padding and vertical stack gaps.
- **Navigation:** Desktop uses a sticky Top Nav with a height of 80px. Mobile utilizes a fixed Bottom Navigation bar for reachability, with the primary "Search" action centered.

## Elevation & Depth

Depth is communicated through **Tonal Layers** supplemented by **Ambient Shadows**.

- **Level 0 (Background):** Tertiary color (#F9F7F2).
- **Level 1 (Cards/Inputs):** White surfaces with a 1px border (#E5E5E5) or a very soft shadow (0px 4px 20px rgba(0,0,0,0.04)).
- **Level 2 (Modals/Dropdowns):** White surfaces with a more pronounced, diffused shadow (0px 12px 32px rgba(0,0,0,0.08)).

Interactive elements like cards should slightly lift on hover (increase shadow spread) to provide tactile feedback without looking "bouncy."

## Shapes

The shape language is defined as **Rounded (Level 2)**. 

- **Standard (0.5rem / 8px):** Buttons, input fields, and small UI elements.
- **Large (1rem / 16px):** Workspace cards and main containers. This larger radius softens the professional aesthetic, making it feel more "Friendly" and "Approachable."
- **Full (Pill):** Used exclusively for status badges and search chips.

## Components

### Search & Date Pickers
- **Search Inputs:** Large, pill-shaped or 12px rounded containers. Use a "dual-stage" search for "Location" and "Specialty."
- **Date Pickers:** Minimalist calendar view with no borders between dates. Active dates use the secondary Bronze color for a soft highlight.

### Workspace Cards
- **Structure:** Aspect ratio 4:3 for imagery. 16px rounded corners on the image. Content below uses a headline-md for the title and label-sm for the location.
- **Price Tag:** Positioned as a floating badge in the top-right of the image, using a semi-transparent White surface.

### Status Badges
- **Valid/Available:** Soft Green background with Deep Green text.
- **Expiring/Booked:** Muted Gold background with Dark Bronze text.
- **Expired:** Light Grey background with Charcoal text.
- **Styling:** Small caps (label-sm), pill-shaped, 12px horizontal padding.

### Time-Slot Selectors
- **Style:** Segmented button control.
- **States:** Unselected (White background, thin border), Selected (Charcoal background, White text).
- **Options:** Grouped as Morning (8am-12pm), Afternoon (12pm-5pm), Full Day.

### Form Elements
- **Inputs:** 56px height for accessibility. 8px rounded corners.
- **Validation:** Clear 2px bottom-border highlight in Error Crimson or Success Olive. Inline helper text must use `label-sm`.

### Navigation
- **Desktop:** Top-aligned, transparent background on scroll-start, transitioning to White.
- **Mobile Bottom Nav:** 64px height, blur background (glassmorphism), centered "Floating Action Button" style for the primary search/book trigger.