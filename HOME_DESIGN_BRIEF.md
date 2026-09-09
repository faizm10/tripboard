# Tripboard — Home Screen Design Brief

A self-contained context pack for redesigning the marketing home screen (`/`).
Everything here is read off the actual source at `frontend/`, not from the older
`PROJECT_OVERVIEW.md` (which is now stale on fonts and page structure).

Live: https://tripboard-lovat.vercel.app · Repo: `faizm10/tripboard`

---

## 1. The product in one paragraph

**Tripboard is a shared visual trip board.** People collect travel
recommendations in scattered places — Instagram saves, TikToks, articles, group
chats, notes apps — and lose them. Tripboard turns those saves into a plan:

1. **Save the place, not the post** — search a place, pick a category, write the
   note explaining *why* you saved it, optionally paste the source link.
2. **See it on one shared map** — every save is a pin on a Mapbox map next to a
   scrollable list of place cards.
3. **Turn the shortlist into a day** — assign places to days, add day notes,
   reorder, page through the itinerary.
4. **Leave with a route** — walking/cycling/driving route preview with distance
   and duration, then hand off to Google or Apple Maps.
5. **Plan together** — invite collaborators by email or share link.

It is a mobile-first PWA. The audience is friend groups planning a trip
together, not solo business travellers.

**Voice:** quiet, editorial, lowercase-leaning, a little dry. Never
exclamation-mark startup copy. Existing lines to match in tone:
"the places you save, on one map." · "Save the place, not the post" ·
"A quiet index of everywhere you are considering." · "Your map is empty."

---

## 2. What the home screen is *today*

File: `frontend/src/app/page.tsx` (62 lines). It is deliberately minimal — a
one-viewport hero, no scroll on desktop (`height: 100svh; overflow: hidden`).

```
<main class="landing-page">          ← flex column, 100svh, paper background
  <SiteHeader />                     ← logo left; "Sign in" + "Start a trip" right
                                        (swaps to an AccountMenu when signed in)
  <section class="hero-section">     ← flex: 1, so the visual fills leftover height
    <div class="hero-copy">          ← 2-col grid: headline | aside
      <h1>the places you save,<br/>on one map.</h1>
      <div class="hero-aside">
        <p class="hero-lede">Instagram saves, group-chat links, and notes —
           turned into a trip you can actually walk.</p>
        <div class="hero-actions"><a class="button button-ink" href="/sign-up">
           Start a trip ↗</a></div>
        <div class="hero-note">[walking-pair icon] One shared shortlist for
           everyone going.</div>
      </div>
    </div>
    <div class="hero-tray">          ← tinted rounded tray, big soft shadow
      <div class="hero-visual"><LandingMap /></div>
    </div>
  </section>
  <footer class="site-footer">tripboard · © 2026 ............ [GitHub icon]</footer>
</main>
```

### `LandingMap` — the hero visual (`components/landing-map.tsx`)
A **still of the real product**, server-rendered, built from the same four
Lisbon places as the demo trip at `/trips/lisbon-weekender`:

- A `figure.board` split **56% map / 44% list**.
- **Map panel:** a Mapbox *static* image of Lisbon when
  `NEXT_PUBLIC_MAPBOX_TOKEN` exists, otherwise a hand-drawn SVG map (land,
  water, roads, park). Over it: a dashed accent walking route (animated trace on
  load), numbered circular pins with small label chips that drop in staggered,
  a "Lisbon · 4 places" chip, a "46 min walking · 4 stops" chip, and Mapbox
  attribution.
- **List panel:** eyebrow "Portugal · Sep 18—22", heading "Lisbon, loosely",
  sub "Four places worth crossing town for.", a filter row (All / Eat / Drink /
  See / Shop), then 3 place cards — each with index number, pastel category tag,
  neighbourhood, name, the user's quoted note, and a bookmark icon — plus
  "+ 1 more saved on this board".
- Pin ↔ card hover linkage is pure CSS (`:has`), so this stays a server
  component. No client JS on the home screen at all.

The four demo places: Gulbenkian Garden (See, Avenidas Novas), Seagull Method
Café (Drink, Príncipe Real), Prado Mercearia (Eat, Baixa), Feira da Ladra
(Shop, Alfama).

### Unused-but-available sections
Two built landing sections are **currently not rendered** and can be brought
back or reworked:

- `components/landing-stages.tsx` — a Save → See → Plan three-step section.
  Each stage has a numbered step, a hand-drawn travel mark, a heading, a
  paragraph, and a small "still" visual (a saved card, a mini map with dots, a
  day plan with a "24 min walking" chip).
- `components/landing-collab.tsx` — a shared-board still: 3 avatars, "3
  planners", and three saves each attributed ("Added by Ana").
- `components/travel-marks.tsx` — hand-drawn line marks: `WalkingPairMark`,
  `MapFoldedMark`, `PostcardMark`.

History note: the page was once a full scrolling landing (hero → 3 stages →
collab → CTA) and was deliberately cut back to "a simple hero" (commit
`0dc4e29`). A redesign may go either way — say which you want.

---

## 3. Design system (the real tokens)

All defined in `frontend/src/app/globals.css` (1832 lines, hand-written, plus
Tailwind v4 and shadcn variables). **Light mode only** — `color-scheme: light`,
there is no dark theme.

### Colour — warm paper, near-black ink, one rationed accent
```
--paper          #F4F0E8   page background (warm off-white)
--paper-raised   #FBF8F2   cards, surfaces
--surface        #EBE6DC
--ink            #1A1814   text
--muted          #6F6A62   secondary text
--quiet          #8A847A
--line           #E4DDD2   borders
--line-soft      #EDE8DF

--accent         #1f6f63   deep teal-green — the ONLY interactive hue
--accent-strong  #175a50   hover
--accent-soft    #E8F0EC   tinted fills
--accent-line    #cadfd8
--accent-deep    #123b36
--accent-quiet   #8fb3aa
--accent-warm    #bf5c34   clay — reserved for the handwritten voice only
--destructive    #b42318

map: --map-land #eceee9 · --map-water #d6e6ee · --map-road #ffffff
```
Category tags (pastel chip + darker ink, used everywhere places appear):
```
Eat   #f4cdd6 / #7a3144      See   #d4e4f2 / #2c4a6e
Drink #f3e2c4 / #6b4a1e      Shop  #d8ead4 / #2d5a38
Stay  #e4d8f0 / #4a3568      Other #e8e6e0 / #4a4a46
```
The comment in the CSS states the rule: *"Colour is rationed: one accent hue
carries every interactive state, a warm clay is reserved for the handwritten
voice, and everything else stays ink."* Keep that rule.

### Type — three families via `next/font/google`
```
--font-display      Bricolage Grotesque   h1/h2/h3, brand word
--font-body         Figtree               everything else
--font-handwritten  Kalam (400/700)       rare accent voice
```
Headings: weight 600, `letter-spacing: -.04em`.
Hero h1: `clamp(44px, 5.8vw, 84px)`, weight 580, tracking `-.045em`,
line-height `.98`. Mobile: `clamp(38px, 10vw, 52px)`.
Lede: `clamp(16px, 1.3vw, 19px)`, `max-width: 34ch`, muted.
`.eyebrow`: 13px, weight 560, accent-coloured.

### Shape, depth, motion, layout
```
--radius-sm 10px · --radius-md 16px · --radius-lg 24px · --radius-round 999px
--shadow-sm    0 1px 2px rgb(26 24 20 / .05)
--shadow-card  0 18px 48px -28px rgb(26 24 20 / .38)
--shadow-lift  0 28px 60px -32px rgb(26 24 20 / .42)
--dur-fast 140ms · --dur-base 220ms · --dur-slow 320ms
--ease-out cubic-bezier(.22,.61,.36,1)
--shell 1280px · --gutter clamp(20px,4vw,28px) · --section-y clamp(88px,10vw,148px)
```
Content width on the home screen is `min(100% - 56px, 1440px)`
(`min(100% - 32px, 1440px)` on mobile). Borders are 1px `--line`; shadows are
wide, soft and low-opacity, never tight drop shadows.

### Buttons
`.button` — pill (`--radius-round`), min-height 46px, 1px `--line` border,
`--paper-raised` fill, 14px/600. Hover: accent border + `--accent-soft` fill.
Active: `translateY(1px)`.
`.button-ink` — the primary: accent fill, paper text, `--accent-strong` on hover.
Modifiers: `.button-small` (40px), `.button-large` (54px), `.button-full`.
`.text-link` — underline-on-hover in accent.
Focus: `2px solid var(--accent)` outline, 3px offset.

### Icons
`lucide-react` at small sizes (12–22px), plus the hand-drawn SVG travel marks.

---

## 4. Hard constraints for whatever you design

- **Next.js 16.3.3 App Router + React 19**, TypeScript strict. `page.tsx` is a
  **server component** and should stay one — the hero visual has zero client JS
  today, which is a feature, not an accident.
- **Styling is plain CSS classes in `globals.css`**, not Tailwind utilities in
  JSX. Tailwind v4 and shadcn (`style: radix-nova`, base `neutral`, CSS
  variables) are installed and used by the few `components/ui/*` primitives
  (button, avatar, dropdown-menu), but every landing/product surface is
  hand-written CSS with semantic class names (`.hero-copy`, `.board-card`).
  Match that. Ship new styles as a named block in `globals.css`.
- **Light mode only.** No dark theme exists; don't invent one unless asked.
- **The single CTA is `/sign-up`** ("Start a trip"). Secondary auth link is
  `/sign-in`. `SiteHeader` is a server component that swaps the two links for an
  `AccountMenu` when a real (non-demo) viewer is signed in — any header
  redesign has to keep both states.
- **Demo mode must render.** With no env vars at all the app runs fully; the
  home screen must look right *without* a Mapbox token (that's why `LandingMap`
  has the drawn-map fallback). Any new visual needs a token-less path.
- **Mobile-first.** Breakpoints in `globals.css` sit around 1080px and 700px;
  below ~700px the home screen becomes scrollable (`height: auto; min-height:
  100svh`), hero actions stack full-width, and the "Sign in" text link hides.
- Keep the `<figcaption class="sr-only">` pattern: decorative product stills are
  `aria-hidden`, and the meaning lives in real headings and a screen-reader
  caption.

---

## 5. The other "home" (if you meant the signed-in one)

`/trips` (`src/app/trips/page.tsx`) is the logged-in landing: an `AppHeader`,
eyebrow "your trips", `<h1>Where to next, {firstName}?</h1>`, a note + "New
trip" button, then a list of `TripCard`s and a dashed "Blank trip · Start
somewhere new" card. Empty state: "Your map is empty." Say which screen you
want redesigned; this brief is written for `/`.

---

## 6. What I'd like changed

> _(fill this in before handing the brief off — the sections above are the
> constraints, this is the intent)_
>
> - Keep / drop the one-viewport no-scroll hero?
> - Bring back the Save → See → Plan stages and the collaborator section?
> - Should the hero visual stay a product still, or become something else?
> - Anything about the palette, type scale, or density you want pushed?
