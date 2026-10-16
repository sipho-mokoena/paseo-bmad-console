# Paseo UI reference

Extracted from `getpaseo/paseo` (main) for restyling Paseo BMAD Console. Two sources are used:

- **Website** (`packages/website`): dark-only marketing/docs site.
- **App** (`packages/app`): the product UI, with light and dark themes.

Paths below are relative to the `getpaseo/paseo` repo root.

## Colour: dark (desktop app, sampled)

The desktop app is more neutral than the website. Values below were sampled with PIL from the
Paseo desktop screenshots (chat, History, model picker) and match `packages/app/src/styles/theme.ts`
`paseoDarkColors` (surface0-4, surfaceSidebar, accent). They supersede the website tokens
(`#101615` background, `#171d1c` card, `#239956` primary) used in the previous pass.

| Token | Value | Sampled from | Paseo BMAD Console token |
| --- | --- | --- | --- |
| main / window background | `#181b1a` (surface0) | main area, header, tab strip | `--background` |
| sidebar background | `#141716` (surfaceSidebar) | left sidebar | `--sidebar` |
| hairline border | `#252b2a` | sidebar edge, header bottom, sidebar divider, modal rules | `--border` |
| hover / selected row | `#272a29` (surface2) | selected workspace row, active tab, selected History row | `--accent`, `--sidebar-accent` |
| raised surface | `#1e2120` (surface1) | modal, composer, search field | `--card`, `--popover`, `--muted` |
| secondary pill / badge | `#434645` (surface3) | "Archived" badge, "Add model" button | `--secondary` |
| primary green | `#20744a` | send button, Refresh button | `--primary`, `--ring` |
| foreground | `#fafafa` | titles, body | `--foreground` |
| muted text | `#a1a5a4` | header project name, sidebar actions, subtitles | `--muted-foreground` |
| diff add / remove | `#67a875` / `#cc7d75` | +/- counters | `--success`, `--destructive-foreground` |
| modal overlay | `#0b0c0c` over main | model picker backdrop | `bg-black/60` |

Layout (`packages/app/src/constants/layout.ts`): `HEADER_INNER_HEIGHT` 36 (screens ~40px with border),
`HEADER_INNER_HEIGHT_MOBILE` 56, `WORKSPACE_SECONDARY_HEADER_HEIGHT` 36 (tab strip), sidebar 320px.
Paseo BMAD Console uses: sidebar 20rem, header 2.5rem desktop / 3rem phone (`--app-header-h`), tab strip 2.25rem,
sidebar action rows 30px (40px on phones), content padding 24px desktop / 8px phone.

### Website tokens (previous pass, superseded for dark)

Website tokens, `packages/website/src/styles.css` (`@theme`, lines 670-690):

| Token | Value |
| --- | --- |
| background | `#101615` |
| card | `#171d1c` |
| muted-foreground | `#a8adac` |
| extra-muted-foreground | `#717574` |
| primary | `#239956` |

App surfaces, `packages/app/src/styles/theme.ts` `paseoDarkColors` (line 460):

| Token | Value | Use in Paseo BMAD Console |
| --- | --- | --- |
| surface0 | `#181B1A` | main background |
| surface1 | `#1E2120` | raised panels, modals |
| surface2 | `#272A29` | hover / active rows |
| surface3 / surface4 | `#434645` / `#595B5B` | secondary pills, disabled tracks |
| surfaceSidebar | `#141716` | sidebar background |
| borderAccent | `#2F3534` | emphasised borders, inputs |
| accent / accentBright | `#20744A` / `#7CCBA0` | brand accent, selected text |
| destructive | `#C64F43` | destructive actions |

## Colour: light

App tokens, `packages/app/src/styles/theme.ts` `lightSemanticColors` (line 323):

| Token | Value | Use in Paseo BMAD Console |
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

### Paseo BMAD Console type scale (rev 9)

Defined once in `@theme` in `src/app/globals.css`; utilities scale with it. Root font-size stays 16px, so rem spacing is unchanged.

| Token / use | Before | After |
| --- | --- | --- |
| Body, UI text (`text-sm`, body; was `text-[13px] md:text-sm`) | 13px phone / 14px desktop | **15px** both |
| Secondary, muted (`text-xs`) | 12px | **13.5px** (`0.84375rem`) |
| Micro labels, pills, badges (`text-2xs`, new) | 9-11px | **12px** (`0.75rem`), never smaller |
| `text-base` / `text-lg` / `text-xl` / `text-2xl` / `text-3xl` | 16 / 18 / 20 / 24 / 30 | 16 / 18 / 21 / 26 / 32 |
| Header page title | 14px medium | 16px medium (`text-base`) |
| Epic and story page H1 | 14 / 16px | 18px phone, 22px from md |
| `.md-compact` body / h / h1 / table | 13 / 13 / 14 / 12px | 15 / 15 / 15.5 / 13.5px |
| `.prose` body, table cells, code | 14px, 12.9px, 0.875em | 15px, 14.5px, `max(0.9em, 13px)` |

Heights raised with the text: header 40px -> 44px desktop (48 -> 52px phone, `--app-header-h`), project tab strip 36 -> 40px, tabs 28 -> 32px, sidebar rows 30 -> 32px, pills 20 -> 22px, badges 16/18 -> 20px, table header rows 32/36 -> 36/40px. Sticky offsets use `calc(var(--app-header-h) + 2.5rem)` for the tab strip.

iOS rule: `input`, `textarea` and `select` are 16px below `md` (iOS Safari zooms the page when a focused field is smaller) and 15px from `md`. This is an unlayered rule at the end of `globals.css`, so it wins over utility classes. Do not set `text-xs`/`text-sm` on form fields expecting it to apply.

`src/lib/__tests__/type-scale.test.ts` checks the theme sizes and that no arbitrary font size below 12px exists in `src`.

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

## Mobile

Paseo treats everything below `md` as a compact form factor (`packages/app/src/constants/layout.ts`: `isCompactBreakpoint`, `COMPACT_FORM_FACTOR_WIDTH = 500`). Only that file was read for the app package; the other values below are our own choices made in the same spirit, checked visually at 390x844 and 360x740.

Adopted from Paseo:

- Compact layout is a separate branch below `md`, desktop spacing is untouched (`md:` prefixes restore the old values).
- Mobile header has its own height and a fixed 8px top padding plus the safe-area inset (`HEADER_TOP_PADDING_MOBILE = 8`, we use `max(0.5rem, env(safe-area-inset-top))`). Our header is 48px on mobile (Paseo uses 56px inner height with a 36px desktop header; ours is 56px on desktop).
- Sidebar becomes a drawer below `md` (already the shadcn Sheet), capped at `min(18rem, 85vw)`, with safe-area padding top and bottom.

Our own rules:

- Gutters: 8px (`px-2`) page and header margin, `gap-2`/`gap-3` between cards, card padding `py-4`/`px-3`/`px-4` (desktop keeps `py-6`/`px-6`).
- Titles `text-2xl` below `md`, `text-3xl` from `md`.
- Touch targets 40px: header buttons, sidebar rows, sheet and dialog close, story rows.
- Segmented progress bars render a continuous bar below `md`; the ticks return from `md`.
- Status badges never shrink (`shrink-0 whitespace-nowrap`); titles wrap or clamp instead. `min-w-24` only from `md`.
- Breadcrumb shows the last two crumbs below `sm`; the Search button is icon-only below `md`.
- Epic timeline rail is hidden below `md`; the status badge moves next to the title.
- Epics is the single browse page (the old Stories tab redirects to it, keeping `?epic=`). Inside an epic, the stories table is a stacked list (ID and status, title, epic and tasks) below `md`, with "Show more"; the Board is a horizontal scroll-snap strip at 85% column width.
- Library: the file tree is a collapsible section that closes after picking a file; content takes the full width and the page scrolls (no fixed inner height below `md`).
- Dialog: top-anchored on mobile (keyboard-safe), `max-h-[calc(100dvh-2rem)]`, 16px side margins. Sheet: `h-dvh`, safe-area padding.
- `viewport` export in `app/layout.tsx`: `width=device-width`, `initialScale=1`, `viewportFit=cover`, `themeColor` per colour scheme.
