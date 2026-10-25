# B2B E-Commerce Platform - Design System

This document outlines the UI design language, layout patterns, and styling guidelines based on the Joma B2B platform. It can be used as a reference for building CSS, Tailwind configurations, or UI component libraries.

## 1. Design Philosophy
The platform utilizes a **Corporate / Enterprise E-Commerce** style heavily influenced by **Bento Grid** layouts. It prioritizes clarity, data density, and modularity, making it easy for B2B users to navigate large catalogs and view critical stock data at a glance.

## 2. Color Palette
The color scheme is professional, high-contrast, and brand-focused.

*   **Primary Brand:** Deep Navy Blue (approx. `#212F5C` or `#1E2A4F`). Used for logos, primary buttons, active states, and dark text.
*   **Background (Global):** Pure White (`#FFFFFF`). Keeps the interface clean and spacious.
*   **Background (Secondary):** Light Gray / Off-White (approx. `#F5F5F5` to `#F9FAFB`). Used for alternating table rows, input fields, or subtle section divides.
*   **Text (Primary):** Dark Navy/Charcoal.
*   **Text (Secondary/Muted):** Medium Gray (approx. `#6B7280`). Used for placeholders, breadcrumbs, and sub-labels.
*   **Success/Action:** Vibrant Green (approx. `#84CC16` or `#A3E635`). Specifically used for the "Stock Disponible" (Available Stock) indicators in the product matrix.

## 3. Typography
The platform relies on a clean, highly legible Sans-Serif font (similar to *Roboto*, *Inter*, or *Helvetica Neue*).

*   **Headings:** Bold, uppercase, and heavily weighted for section titles (e.g., "TEAMWEAR COLLECTION").
*   **Navigation:** Uppercase, medium weight, well-spaced (e.g., "HOMBRE", "MUJER").
*   **Body/Data:** Standard casing, optimized for small sizes in data tables and product labels.

## 4. Core Layout Patterns

### A. The Bento Grid (Homepage/Categories)
*   Content is organized into varied-size rectangular modules.
*   **Cards:** Feature a distinct `border-radius` (approx. 12px - 16px).
*   **Images:** Act as full-bleed backgrounds for the cards, often with a subtle dark gradient overlay at the bottom so the white text remains legible.

### B. Split-Screen Layout (Authentication)
*   **Left Side:** Full-height visual content (promotional imagery, slider, rounded container).
*   **Right Side:** Clean, white space containing the functional form (Login), vertically and horizontally centered.

### C. Data-Dense Catalog (Product Pages)
*   **Header:** Sticky top navigation containing brand, main categories, and user actions (search, cart, profile).
*   **Sub-Navigation:** Breadcrumbs and secondary tabs (e.g., "SUDADERA", "CAMISETA") with a clean underline indicator for the active state.
*   **Grid:** Strict alignment with dividers between categories.

## 5. UI Components

*   **Buttons:** Fully rounded (pill shape) or slightly rounded rectangles. Primary buttons are solid Navy Blue with white text.
*   **Input Fields:** Pill-shaped borders (high border-radius), light gray borders, with icons (like the 'hide password' eye) integrated inside the input.
*   **Hover Matrix (Data Table):** A specialized pop-up table used on product cards. It features a strict grid with white backgrounds, gray borders, and a distinct green row for stock counts.
*   **Icons:** Minimalist, thin-line icons for UI actions (grid/list toggle, cart, user profile).

---

## 6. Extra Styles (Modern Enhancements)
To elevate this design when building your platform, consider adding these modern UI/UX enhancements:

### Transitions & Micro-interactions
*   **Hover Lifts:** Add a subtle vertical transform to the Bento grid cards on hover.
    *   *CSS:* `transition: transform 0.2s ease, box-shadow 0.2s ease;`
    *   *Hover:* `transform: translateY(-4px); box-shadow: 0 10px 25px rgba(0,0,0,0.1);`
*   **Image Zoom:** On hover, slightly scale the background image of the bento cards while keeping the text static.
*   **Smooth Fade:** Fade in the data-matrix tables rather than having them instantly appear.

### Modern Shadows & Depth (Glassmorphism touches)
*   **Soft Shadows:** Replace flat borders on dropdowns and hover matrix tables with soft, diffuse shadows.
    *   *CSS:* `box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);`
*   **Backdrop Blur:** If your hover matrix overlaps product images, add a slight blur to its background for a modern glass effect.
    *   *CSS:* `backdrop-filter: blur(8px); background-color: rgba(255, 255, 255, 0.9);`

### Accessibility (a11y) Additions
*   **Focus Rings:** Ensure all inputs and buttons have a clear, branded focus ring for keyboard navigation (e.g., a 2px solid Navy offset outline).
*   **Contrast Adjustments:** Ensure the light gray placeholder text passes WCAG contrast ratios against the white input backgrounds.