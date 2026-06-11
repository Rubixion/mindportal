# MindPortal — Product Context

## Register
product

## Users & Purpose
ADHD users and anyone who struggles with browser-based distraction. Primary context: working or studying at a desk, Chrome open, trying to build a sustainable focus habit. Primary task on any given screen: start a focus session, check if they're on track, manage which sites help vs hurt.

## Job to be Done
"I need to stop opening Reddit and actually get work done — without feeling like I'm being punished."

## Brand Personality
Calm. Encouraging. Clear.

Not a drill sergeant. Not a guilt machine. A small, friendly companion (Ollie the owl) that rewards momentum and treats slip-ups as recoverable. Discipline without shame.

## Anti-References
- RescueTime (clinical, data-heavy, no warmth)
- Cold Turkey Blocker (punitive, hard, no recovery)
- Productiv (corporate, hollow, feature-farm)
- Any extension that shows "FAILED" or "You wasted X hours"

## Design Principles
1. One obvious next action per screen — never two competing CTAs.
2. Progressive disclosure — stats collapse by default, surface on demand.
3. Reward momentum — streaks, XP, Ollie feeding are positive loops.
4. Recovery over punishment — gentle language, no hard traps, emergency unlocks.
5. Keyboard-first — every action reachable without a mouse.
6. System-native dark — deep navy, not generic charcoal. Feels built for focus, not for a SaaS demo.

## Accessibility Needs
- prefers-reduced-motion support on all animations
- Visible focus rings for keyboard navigation
- ARIA labels on icon-only buttons
- Contrast ≥ 4.5:1 on all body text

## Technical Constraints
- Chrome MV3 — no CDN scripts, no eval, strict CSP
- Popup: 280–460px wide, max 600px tall
- No external fonts — system font stack only
- All libraries bundled locally via npm
