# Paseo UI reference

Extracted from `getpaseo/paseo` (main) for restyling MyBMAD. Two sources are used:

- **Website** (`packages/website`): dark-only marketing/docs site.
- **App** (`packages/app`): the product UI, with light and dark themes.

Paths below are relative to the `getpaseo/paseo` repo root.

## Colour: dark

Website tokens, `packages/website/src/styles.css` (`@theme`, lines 670-690):

| Token | Value | Use in MyBMAD |
| --- | --- | --- |
| background | `#101615` | page background |
| foreground | `#fafafa` | primary text |
| card | `#171d1c` | card surface |
| muted | `#1a1f1e` | muted surface, code chips |
| muted-foreground | `#a8adac` | secondary text |
| extra-muted-foreground | `#717574` | tertiary text, captions |
| border | `#252b2a` | all borders, dividers |
| primary | `#239956` (fg `#ffffff`) | primary buttons, focus accent |
| secondary | `#252b2a` (fg `#fafafa`) | secondary surfaces |
| scrollbar-handle | `#717574` | thin scrollbars |

App surfaces, `packages/app/src/styles/theme.ts` `paseoDarkColors` (line 460):

| Token | Value | Use in MyBMAD |
| --- | --- | --- |
| surface0 | `#181B1A` | popovers, dialogs |
| surface1 | `#1E2120` | raised panels |
| surface2 | `#272A29` | hover / active rows |
| surface3 / surface4 | `#434645` / `#595B5B` | strong borders, disabled tracks |
| surfaceSidebar | `#141716` | sidebar background |
| borderAccent | `#2F3534` | emphasised borders |
| accent / accentBright | `#20744A` / `#7CCBA0` | brand accent, selected text |
| destructive | `#C64F43` | destructive actions |

## Colour: light

App tokens, `packages/app/src/styles/theme.ts` `lightSemanticColors` (line 323):

| Token | Value | Use in MyBMAD |
| --- | --- | --- |
| surface0 | `#FFFFFF` | background, cards |
| surface1 | `#FAFAFA` | raised panels |
| surface2 | `#F4F4F5` | sidebar, muted surfaces |
| surface3 / surface4 | `#E4E4E7` / `#D4D4D8` | strong borders |
| foreground | `#1A1A1E` | primary text |
| foregroundMuted | `#71717A` | secondary text |
| foregroundExtraMuted | `#A1A1AA` | tertiary text |
| border | `#E4E4E7` | borders |
| primary | `#18181B` (fg `#FAFAFA`) | primary buttons (ink, not green) |
| accent / accentBright | `#20744A` / `#239956` | brand accent |
| destructive | `#B04138` | destructive actions |

## Status colours

`packages/app/src/styles/theme.ts`, one hue per signal, shared by badges, icons and diffs:

| Signal | Dark | Light | Source line |
| --- | --- | --- | --- |
| success | `#6CB17B` | `#3E704A` | `darkStatusColors` L154, `lightStatusColors` L146 |
| danger | `#D8847B` | `#9D433B` | same |
| warning | `#C09664` | `#7B5D39` | same |
| merged (violet) | `#A890D5` | `#7347AF` | same |
| running (blue, status dot) | `#5CAAF6` | `#268AE0` | `darkStatusDotColors` L212, `lightStatusDotColors` L204 |

Status badges use the status colour at low alpha for the fill: 12% in light (`1f`), 16% in dark (`29`), per `statusTints()` in `theme.ts`.

## Typography

- Font: **Geist Variable** (`packages/website/src/styles.css` L671, `@fontsource-variable/geist`). Fallback `ui-sans-serif, system-ui, sans-serif`. The app's web fallback stack is `system-ui, -apple-system, ...` (`theme.ts` L635).
- Mono: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` (website styles.css, used for code and `+/−` markers).
- Weights: headings and titles are `font-medium` (500), not bold. `FONT_WEIGHT` in `theme.ts` L602 (normal, 500, 600, bold).
- Sizes (`theme.ts` L577 `FONT_SIZE`, px): code 12, content 15, sm 12, base 14, lg 16, xl 18, 2xl 20, 3xl 22, 4xl 26. Landing headings: `text-3xl font-medium` section titles, `text-xl font-medium` card titles, `text-sm` body (`landing-page.tsx` L330, L564).
- Line height: `leading-relaxed` for body copy, `leading-[0.95]` only on hero display text.
- Tracking: `tracking-tight` on display headings; changelog titles use `-0.01em` (`styles.css`).

## Radii (`theme.ts` L609 `BORDER_RADIUS`, px)

none 0, sm 2, base 4, md 6, lg 8, xl 12, 2xl 16, full 9999.

Usage: buttons `rounded-lg` (8px) in landing CTAs; cards and feature panels `rounded-xl` (12px) (`landing-page.tsx` L588); code blocks `rounded-lg`; **pills and status chips are fully rounded** (`rounded-full`, `landing-page.tsx` L526, L874; `sponsorship.tsx` L31).

## Borders

- Width 1px everywhere (`BORDER_WIDTH` `theme.ts` L620).
- Standard: `border border-border` (website `styles.css` `--color-border`).
- Subtle panel: `border-white/10` on dark, `bg-white/[0.025]` fill (`landing-page.tsx` L588).
- Dashed border marks an "add" or placeholder tile: `border border-dashed border-white/10` (`landing-page.tsx` L456).
- Section dividers: `border-top: 1px solid var(--color-border)` (`styles.css` changelog rules).

## Shadows

Paseo does not use elevation shadows. Surfaces separate by fill (surface0 to surface2) and 1px borders. Only the app's floating menus use a shadow.

## Spacing (`theme.ts` L560 `SPACING`, px)

0, 2, 4, 6, 8, 12, 16, 24, 32, 48, 64, 80, 96, 128 (keys are the 4px scale: 0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 20, 24, 32).

Page shell (`packages/website/src/components/site-shell.tsx`): `max-w-5xl p-6 md:p-20 mx-auto` for content pages, `max-w-7xl` for wide pages. Header-to-content gap `mb-20`.

## Components

**Primary button** (`landing-page.tsx` L995): `inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:bg-foreground/90 transition-colors`. In dark mode `bg-foreground` is near-white, so Paseo's landing CTAs are inverted (light pill on dark), not green.

**Small pill CTA** (`landing-page.tsx` L526): `rounded-full bg-foreground px-2.5 py-1.5 text-xs text-background`.

**Secondary / outline button** (`landing-page.tsx` L881): `rounded-full border border-white/12 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10`.

**Card** (`landing-page.tsx` L588): `flex flex-col rounded-xl border border-white/10 bg-white/[0.025] p-5`, title `font-medium text-white/85`, body `text-sm leading-relaxed text-white/45`.

**Status badge** (`sponsorship.tsx` L31): `rounded-full bg-emerald-400/10 px-2 py-1 text-xs text-emerald-300`. Paseo app status chips use the tint and text colour from the status band above.

**Navigation** (`packages/website/src/components/site-header.tsx`): flex row, brand left (logo 24px + `text-lg font-medium` wordmark), links `text-sm text-muted-foreground hover:text-foreground transition-colors`, icon links `text-muted-foreground hover:text-foreground`.

**Code / command block** (`code-block.tsx`): `bg-black/30 backdrop-blur-sm rounded-lg px-3 py-2 font-mono text-sm`, prompt in `text-muted-foreground`.

**Disclosure (FAQ)** (`faq-item.tsx`): `+` / `−` mono glyph at `text-white/40`, question `font-medium text-sm`, answer `text-sm text-muted-foreground`.

**Tab list / segmented row** (`landing-page.tsx` L677): `rounded-xl border p-3`, selected row uses a stronger border and fill.

## Motion and misc

- Transitions are `transition-colors` (no transform animations on controls).
- Thin, rounded scrollbars with `scrollbar-color: var(--color-scrollbar-handle) transparent` (`styles.css` top).
- `prefers-reduced-motion` respected.

## Branding assets

- `packages/website/public/logo.svg` (mark, 700x700 viewBox) and `packages/website/public/favicon.svg`.
- `packages/desktop/assets/icon.png` (512), `64x64.png`, `128x128.png`, `32x32.png`, `icon.ico`.
- Copied into `web/public/logo.png` (replaces `logo_mybmad.png`, used by the sidebar, login and add-repo card), `web/src/app/icon.png` (app icon) and `web/public/favicon.svg`.
