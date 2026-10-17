# Paseo UI reference

This page records the visual tokens and UI patterns of Paseo BMAD Console: colours, type scale, sizes, radii, mobile rules and the shared component kit. The look follows the Paseo desktop app (getpaseo/paseo); this project is not affiliated with Paseo. The source of truth for every value is `src/app/globals.css`, and this page was checked against it. When the two disagree, the CSS wins.

## Colour

Colours are CSS variables on `:root` (light) and `.dark`, mapped to Tailwind tokens with `@theme inline`. The theme follows the system setting by default (`next-themes`, class strategy).

| Token | Dark | Light |
| --- | --- | --- |
| `--background` | `#181b1a` | `#ffffff` |
| `--foreground` | `#fafafa` | `#1a1a1e` |
| `--card`, `--popover` | `#1e2120` | `#ffffff` |
| `--muted` | `#1e2120` | `#f4f4f5` |
| `--muted-foreground` | `#a1a5a4` | `#71717a` |
| `--accent` (hover, selected row) | `#272a29` | `#f4f4f5` |
| `--secondary` | `#434645` | `#f4f4f5` |
| `--primary` | `#20744a` (green) | `#18181b` (ink) |
| `--primary-foreground` | `#ffffff` | `#fafafa` |
| `--border` | `#252b2a` | `#e4e4e7` |
| `--input` | `#2f3534` | `#e4e4e7` |
| `--ring` | `#20744a` | `#18181b` |
| `--destructive` | `#c64f43` | `#b04138` |
| `--sidebar` | `#141716` | `#f4f4f5` |
| `--sidebar-accent` | `#272a29` | `#e4e4e7` |
| `--sidebar-border` | `#252b2a` | `#e4e4e7` |

In dark mode the primary is the Paseo green, in light mode it is near-black. Surfaces separate by fill and a 1px border. There are no elevation shadows except on floating menus.

### Status colours

One hue per signal, used by pills, icons and charts. Each has a base token and a `-foreground` token for text.

| Signal | Token | Dark | Light |
| --- | --- | --- | --- |
| Success | `--success` | `#67a875` | `#3e704a` |
| Info | `--info` | `#5caaf6` | `#268ae0` (text `#1d6fb8`) |
| Warning | `--warning` | `#c09664` | `#7b5d39` |
| Danger | `--destructive-foreground` | `#cc7d75` | `#9d433b` |
| Merged | `--merged` | `#a890d5` | `#7347af` |

`--chart-1` to `--chart-5` hold a green, blue, violet, brown and red for charts.

## Typography

- Font: Geist (`next/font/google`, variable `--font-geist-sans`) with the fallback `ui-sans-serif, system-ui, sans-serif`. Mono is Geist Mono (`--font-geist-mono`).
- Headings and titles use medium weight (500), not bold.
- The body uses `text-sm`.

Type scale, defined once in `:root` of `globals.css`. Root font size stays 16px, so rem spacing is unchanged.

| Utility | Size | Line height | Use |
| --- | --- | --- | --- |
| `text-2xs` | 12px (`0.75rem`) | 1rem | Pills, badges, micro labels. Nothing is smaller |
| `text-xs` | 13.5px (`0.84375rem`) | 1.25rem | Secondary and muted text |
| `text-sm` | 15px (`0.9375rem`) | 1.4rem | Body and UI text |
| `text-base` | 16px | 1.5rem | Header page title |
| `text-lg` | 18px | 1.6rem | Epic and story page title on phones (22px from `md`) |
| `text-xl` | 21px | 1.75rem | |
| `text-2xl` | 26px | 2.1rem | |
| `text-3xl` | 32px | 2.4rem | |

Other type rules:

- `.prose` (rendered Markdown) is 15px, table cells 14.5px, code `max(0.9em, 13px)`. `.md-compact` (epic and story bodies) is 15px.
- On phones, `input`, `textarea` and `select` are 16px, because iOS Safari zooms the page when a focused field is smaller. From `md` they are 15px. This is an unlayered rule at the end of `globals.css`, so it wins over utility classes. Do not set `text-xs` or `text-sm` on form fields expecting it to apply.
- `src/lib/__tests__/type-scale.test.ts` checks the theme sizes, the body size, the form-control rule and that no arbitrary font size below 12px exists in `src`.

## Sizes and spacing

| Item | Phone (below `md`) | Desktop (`md` and up) |
| --- | --- | --- |
| App header (`--app-header-h`) | 3.25rem (52px) | 2.75rem (44px) |
| Project tab strip | 48px | 40px |
| Tab buttons | 40px | 32px |
| List rows (`ROW_CLASS`) | min 40px | min 36px |
| Pills | 22px high | 22px high |
| Search field | 40px | 36px |
| Sidebar width | `min(18rem, 85vw)` as a drawer | 20rem |
| Page padding (`.page-pad`) | 8px (and the bottom safe-area inset) | 24px |

Radius: base `--radius` is 0.5rem (8px). `rounded-md` is 6px, `rounded-lg` 8px, `rounded-xl` 12px. Pills use `rounded-md`, and toggles use `rounded-full`. Borders are 1px (`border-border`). Page content sits directly on the background: no card, no shadow.

Sticky elements offset from the header with `--app-header-h`, for example the tab strip uses `top-[calc(var(--app-header-h)+env(safe-area-inset-top))]`.

## Mobile

Everything below `md` (768px) is the compact layout. It is a separate branch of the styles: desktop spacing is untouched, and `md:` prefixes restore the desktop values.

- The header keeps a top padding and the safe-area inset (`viewportFit: "cover"` in `src/app/layout.tsx`, with a theme colour per scheme).
- The sidebar becomes a drawer capped at `min(18rem, 85vw)` with safe-area padding.
- Touch targets are 40px: header buttons, sidebar rows, dialog and sheet close buttons, tab buttons, rows, toggles and filters.
- Gutters are 8px (`px-2`). Titles use smaller sizes (page titles 18px, 22px from `md`).
- Progress bars render continuously below `md`; the tick marks return from `md`.
- Status pills never shrink (`shrink-0 whitespace-nowrap`). Titles wrap or clamp instead.
- Epics is the single browse page. Inside an epic, the story table becomes a stacked list with "Show more", and the board is a horizontal scroll-snap strip with columns at 85% width.
- Library: the file tree is a collapsible section that closes after a file is picked, and content uses the full width.
- Dialogs are top-anchored (keyboard-safe) with `max-h-[calc(100dvh-2rem)]`. Sheets use `h-dvh` and safe-area padding.

## Components and patterns

Shared building blocks live in `src/components/shared/`. Reuse them instead of styling new lists from scratch.

- **`pill.tsx`**: `Pill` (one style: 22px high, 12px text, 6px radius, hairline border, optional 12px icon) with tones `neutral`, `success`, `info`, `danger` and `fill`, and `StatusPill` for story and epic statuses (Done, In progress, In review, Blocked, Ready for dev, Backlog, Not started, Unknown). The layout pill uses `Pill`.
- **`list-kit.tsx`**: `GroupLabel` (a group title with a count), `ROW_CLASS` (the shared row style), `StateMessage` (flat empty and error states), `PillToggle` (the segmented toggle used for Board/List and Preview/Source), `SearchField` and `StatStrip` (the compact stats row).
- **`definition-table.tsx`**: `DefinitionTable`, a two-column table of labelled values, used for file metadata in the Library and ticket details on stories.
- **Rows**: `epics/epic-row.tsx` and `epics/story-row.tsx` build the history-style list rows on `ROW_CLASS`.
- **Other shared pieces**: `alert-banner.tsx`, `segmented-progress-bar.tsx` (the thin progress bar), `stats-card.tsx`, `staggered-list.tsx`, `parse-errors-dialog.tsx`, and the project action dialogs (`refresh-repo-button.tsx`, `delete-repo-button.tsx`, `repo-settings-modal.tsx`).
- **`src/components/ui/`**: shadcn components, owned by this project (`button`, `dialog`, `sheet`, `tabs`, `sidebar` and others). `src/components/reui/` holds the vendored data grid and filter components and is excluded from lint.

Tailwind conventions (no arbitrary values when a canonical class exists, theme tokens for repeated colours) are in [CONTRIBUTING.md](../CONTRIBUTING.md) and [CLAUDE.md](../CLAUDE.md).

## Branding assets

- `public/logo.png`: the logo mark.
- `public/favicon.svg`: the favicon.
- `src/app/icon.png`: the app icon used by Next.js.
