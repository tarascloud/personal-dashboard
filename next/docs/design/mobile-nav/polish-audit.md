# Mobile Nav Polish & A11y Audit

**Ticket:** PD-NAV-20260419-04
**Date:** 2026-04-19
**Files reviewed:**
- `src/components/shared/mobile-tab-bar.tsx`
- `src/components/shared/nav-more-sheet.tsx`
- `src/hooks/use-pinned-nav.ts`
- `src/components/shared/nav-items.ts`

---

## P0 -- Critical (fixed in this PR)

### P0-1: Safe area breaks tab bar layout
**Component:** `mobile-tab-bar.tsx`
**Issue:** The tablist uses `h-14 pb-[env(safe-area-inset-bottom)]` which means the safe area padding eats into the 56px height. On notched devices (iPhone 14+), the tab icons/labels get vertically squished because the bottom inset (~34px) is subtracted from the available 56px, leaving only ~22px for content.
**Fix:** Changed to `min-h-14` so the safe area padding adds to the total height rather than being included within it.

### P0-2: Sheet bottom offset ignores safe area
**Component:** `nav-more-sheet.tsx`
**Issue:** `bottom-[56px]` is hardcoded, but the actual tab bar height is `56px + safe-area-inset-bottom` on notched devices. The sheet appears to overlap the tab bar.
**Fix:** Changed to `bottom-[calc(56px+env(safe-area-inset-bottom,0px))]` to dynamically account for the safe area. Also removed the redundant `pb-[env(safe-area-inset-bottom)]` from the sheet itself (it sits above the tab bar, not at the screen bottom).

### P0-3: Missing focus trap in modal sheet
**Component:** `nav-more-sheet.tsx`
**Issue:** The sheet has `role="dialog"` and `aria-modal="true"` but no focus trap. Pressing Tab repeatedly moves focus out of the sheet into the page behind the backdrop, violating WCAG 2.1 SC 2.4.3 (Focus Order) for modal content.
**Fix:** Added a focus trap that cycles through focusable elements within the sheet when Tab/Shift+Tab would escape.

### P0-4: Swipe dismiss ignores velocity
**Component:** `nav-more-sheet.tsx`
**Issue:** Dismiss only checks `dragY > 80` (distance threshold). A fast flick of 40px at high velocity feels broken because it snaps back. Native iOS/Android sheets dismiss on velocity OR distance.
**Fix:** Added velocity tracking (timestamp + position delta). Dismiss triggers on `dragY > 80` OR `velocity > 0.5px/ms`, whichever comes first.

### P0-5: No drag resistance / rubber-band effect
**Component:** `nav-more-sheet.tsx`
**Issue:** Dragging down maps 1:1 to translateY. This feels unnatural compared to native sheets which apply diminishing returns (rubber-band). The sheet can be dragged arbitrarily far below its rest position.
**Fix:** Applied logarithmic resistance: `transform = dragY * 0.55` beyond a small initial threshold. This gives tactile feedback that you're pulling against resistance.

### P0-6: Stagger animation declared but not applied
**Component:** `nav-more-sheet.tsx`
**Issue:** Grid items have `style={{ animationDelay: ... }}` but no CSS animation class. The delay property does nothing without a corresponding `@keyframes` animation. Items appear instantly with no stagger.
**Fix:** Added `animate-in fade-in slide-in-from-bottom-2` classes (Tailwind animate utilities) and `fill-mode: backwards` so the stagger delay takes effect.

### P0-7: Empty state when no overflow items
**Component:** `nav-more-sheet.tsx`
**Issue:** If all modules are disabled or only pinned modules are enabled, `items` is empty. The sheet opens showing only the drag handle and empty space -- confusing.
**Fix:** Added an empty state message when `items.length === 0`. The More button in the tab bar also gets `disabled` when there are no overflow items.

---

## P1 -- Should fix (next iteration)

### P1-1: Tap scale too aggressive
**Component:** `mobile-tab-bar.tsx`, `nav-more-sheet.tsx`
**Issue:** `active:scale-[0.92]` is 8% shrink -- iOS standard is ~3% (`scale-[0.97]`). The current value feels exaggerated, especially on smaller touch targets.
**Recommendation:** Change to `active:scale-[0.97]` for tab items and `active:scale-[0.95]` for sheet grid items (they're larger targets).

### P1-2: Semantic role mismatch in sheet
**Component:** `nav-more-sheet.tsx`
**Issue:** Sheet uses `role="dialog"` but children use `role="menuitem"`. WAI-ARIA requires menuitem to be owned by a `menu` or `menubar` container. A dialog with menuitem children is technically invalid, though assistive tech generally handles it.
**Recommendation:** Either wrap the grid in `role="menu"` or change items to `role="link"` (since they are `<Link>` elements navigating to pages).

### P1-3: No tabIndex on sheet for focus management
**Component:** `nav-more-sheet.tsx`
**Issue:** The sheet container lacks `tabIndex={-1}`, which means programmatic `.focus()` targeting the container itself won't work. The current implementation focuses the first item, which is acceptable but fragile if items are empty.
**Recommendation:** Add `tabIndex={-1}` to the sheet div.

---

## P2 -- Nice to have

### P2-1: Active indicator pill not centered
**Component:** `mobile-tab-bar.tsx`
**Issue:** The pill `<div>` is `absolute top-0.5` but without `left-1/2 -translate-x-1/2`, its horizontal position depends on the flex alignment of the parent. Currently works because parent is `items-center`, but explicit centering is more robust.

### P2-2: No icon weight/size transition on active
**Component:** `mobile-tab-bar.tsx`
**Issue:** Active tab only changes color, not icon weight or size. A subtle scale bump (e.g., `size-5` to `size-[22px]`) on active state would add perceived tactility.

### P2-3: Backdrop transition could be softer
**Component:** `nav-more-sheet.tsx`
**Issue:** `duration-200` for backdrop fade is quick. `duration-300` would feel more deliberate and polished.

### P2-4: Loading state for tab transitions
**Issue:** No skeleton or loading indicator when switching between tabs. For data-heavy tabs (finance, dashboard), there could be a brief skeleton state. This is lower priority since Next.js handles loading states at the page level.

---

## Summary

| Priority | Total | Fixed |
|----------|-------|-------|
| P0       | 7     | 7     |
| P1       | 3     | 0     |
| P2       | 4     | 0     |
