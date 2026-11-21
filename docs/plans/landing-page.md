# Plan: Landing page (Home, "/"), dark food guide style

> Replaces the cancelled 3D hero plan of 4 Nov 2026 (Three.js clay blob, starfield, slides). That work stopped halfway and is removed in Step 1.

Status: planned (4 Nov 2026). Scope: the landing page only, plus the shared theme file. No backend changes. **No new libraries**: everything is React, plain CSS and `lucide-react` icons (already installed). Not a submodule: the page is the front door to Food Discovery, Food Hopping, Food Stalls Analytics and User Management.

## 1. Goal
Build a dark, warm landing page from the student's text spec: near-black page, charcoal cards with a thin orange outline, one orange accent, Poppins headings with one orange key word. The student checks it in the browser first. Other pages are restyled only after the student's feedback.

## 2. What the student will see (top to bottom)
1. **Navbar**: "MyMakanRoute" wordmark left; Home, Discover, Plan, Analytics, About in the centre (active one has an orange underline); search, saved places (with a count) and profile icons right. Phones: a menu button.
2. **Hero** (two columns): eyebrow MALAYSIA'S FOOD GUIDE, heading "Find Hidden Gems. Plan Your **Food Trip**", one sentence, buttons START HOPPING and SEE PLACES, three feature badges. Right: a big round plate illustration with an "Est. 2026" badge and small chilli/herb/star-anise shapes.
3. **Hidden Gems Near You**: 4 place cards, VIEW ALL PLACES button, small note "Sample ratings, not real reviews".
4. **How it works**: "Plan Every **Bite**", paragraph, 3 stats, photo collage, 3 steps (Discover, Plan the route, Review the trip).
5. **Testimonials**: "What Food Hoppers **Say**", average 4.9 with stars, 3-card carousel with arrows and dots, marked SAMPLE.
6. **Footer**: 4 columns (logo + line + icons, Quick Links, Contact, Newsletter), thin orange line, copyright, "Privacy Policy | Terms of Services".

## 3. Step 1: clean up the stopped 3D work
| Action | Files |
| --- | --- |
| Delete | `web/src/components/landing/` all files: ClayBlob, HeroScene, Starfield, FallbackBlob(.css), fpsGuard(.test).js, random.js, slides.js, SlideControls(.css), HeroSlide, CtaButton(.css), Navbar(.css, .test). The new Navbar is different, so it is rebuilt, not reused |
| Delete | `web/src/lib/webgl.js`, `web/src/lib/webgl.test.js` |
| Delete | `HeroCarousel.jsx/.css`: not found in the repo any more, so nothing to do (just confirm) |
| Uninstall | `npm.cmd uninstall three @react-three/fiber @react-three/postprocessing postprocessing simplex-noise` (inside `web/`) |
| Remove | the `--landing-*` block and `--font-display` in `tokens.css`; Josefin Sans, Karla, Montserrat in `index.html` (replaced in Step 2) |
| Keep | `hooks/useReducedMotion.js` (tells us if the user turned off animations) |
Nothing about these goes into PLAN.md section 8 (they were never listed there). Test: `npm.cmd test` and `npm.cmd run build` still pass after HomePage is stubbed to a simple placeholder.

## 4. Theme: ONE file (`web/src/styles/tokens.css`)
All colours, fonts, radius and spacing live here as CSS variables. The new palette becomes the **global** theme (the student will restyle other pages in the same style next), so we change the values of the existing names (`--color-background`, `--color-card`, `--color-primary` ...) and add a few new ones (`--radius-card: 16px`, `--color-accent-hover`, `--tracking-eyebrow`, `--section-gap`). **Warning:** Discover, Trip, Analytics and Login pick up the new colours at once but keep their old layout, so they may look half-styled until the next step.

**WCAG AA** = the accessibility rule that normal text needs a contrast ratio of at least 4.5:1 with its background (big text and icons/borders 3:1). Ratios computed with the WCAG formula:

| Pair | Ratio | Result |
| --- | --- | --- |
| Orange `#e8873a` text on page `#0b0b0b` | 7.1:1 | pass |
| Orange `#e8873a` text on card `#2a2a2a` | 5.2:1 | pass (so no extra text-only orange is needed) |
| White `#ffffff` on orange button | 2.8:1 | **fail**: do not use white button text |
| Near-black `#0b0b0b` text on orange button | 7.1:1 | pass: filled/hovered buttons use dark text |
| White headings on page / on card | 19.7:1 / 14.4:1 | pass |
| Body grey `#b3b3b3` on page / on card | 9.4:1 / 6.9:1 | pass |
| Small grey `#8a8a8a` (copyright) on page | 5.7:1 | pass |
| Orange outline/focus ring on card | 5.2:1 (needs 3:1) | pass |
If a later tweak makes orange text fail on a lighter card, add `--color-accent-text` (lighter orange) for text only.

**Font:** Poppins (400, 500, 600, 700) from Google Fonts with `display=swap` and the existing `preconnect` links in `index.html`. Recommended: Poppins for headings and body (one family = fewer downloads). See open question 4.

## 5. Components (file → job)
All new files in `web/src/components/landing/` with one CSS file each.
| File | Job |
| --- | --- |
| `Button.jsx` | One button/link look: `variant="filled" or "outline"`, fills orange on hover, renders `<Link>` or `<button>` |
| `SectionHeading.jsx` | Eyebrow (small uppercase orange with a short line), heading with the orange key word, optional divider |
| `Navbar.jsx` | Wordmark, links, search box, saved count, profile link, mobile menu |
| `Hero.jsx` + `FeatureBadges.jsx` | Hero text, CTAs, plate illustration; badges row |
| `PlaceCard.jsx` + `PlaceGrid.jsx` | One card (photo, name, line, label, rating, price, save button); grid of 4 + VIEW ALL PLACES |
| `HowItWorks.jsx` | Text, stats, collage, 3 steps (`id="how-it-works"`) |
| `Testimonials.jsx` | Carousel with arrows, dots, swipe, keyboard |
| `Footer.jsx` | 4 columns, newsletter form (not connected) |
| `web/src/hooks/useRevealOnScroll.js` | Fade + slide-up when a section enters the screen |
| `web/src/hooks/useSavedPlaces.js` | Saved place ids in localStorage (key `mmr.savedPlaces.v1` added to `STORAGE_KEYS` in `lib/storage.js`) |
| `web/src/pages/HomePage.jsx` + `.css` | Rewritten: skip link, Navbar, sections in order, Footer. Stays outside AppShell |
Note: the landing `PlaceCard` is separate from the existing `components/PlaceCard.jsx` (used by Discover); merging them is a later step.

## 6. Data file: `web/src/data/landingContent.js`
Components get all words, numbers and image paths from here (no hard-coded content). Shape:
`NAV_LINKS [{label, to}]`, `HERO {eyebrow, title, highlight, text, ctas[], image{src,alt,width,height}}`, `FEATURE_BADGES [{icon, title, text}]`, `FEATURED_PLACES [...]`, `HOW_IT_WORKS {eyebrow, title, highlight, text, stats[], steps[], images[]}`, `TESTIMONIALS {average, items[{id, name, role, quote, avatar}]}`, `FOOTER {tagline, quickLinks[], email, social[]}`, `PRICE_RANGES`.

**Featured places**: copied from `backend/db/seeds/sample-places.json` (SAMPLE data, invented ratings):
| Name | Cuisine, area | Rating (reviews) | Price level → range | Label |
| --- | --- | --- | --- | --- |
| Sister Yao's Char Koay Kak | chinese, George Town | 4.6 (48) | 1 → RM5–10 | Hidden Gem |
| Ali Bubur Kacang (Mung Bean Sweet Porridge) | dessert, George Town, halal | 4.7 (29) | 1 → RM5–10 | Hidden Gem |
| Restoran Nasi Dalcha Kassim Mustafa | mamak, George Town, halal | 4.4 (64) | 1 → RM5–10 | Hidden Gem |
| Ali Nasi Lemak Daun Pisang | malay, George Town, halal | 4.5 (1650) | 1 → RM5–10 | Popular |
Three gems plus one Popular show both labels. Labels follow the hidden gem rule (rating >= 4.3 and reviews <= 100). **Assumption**: price level 1 = RM5–10, 2 = RM10–20, 3 = RM20–40, 4 = RM40+. Testimonials use fictional names (not real people) and are marked "Sample reviews".

## 7. Links
| Item | Goes to |
| --- | --- |
| Home / Discover / Plan / Analytics | `/`, `/discover`, `/trip`, `/analytics` |
| About | `#how-it-works` (smooth scroll on the landing page) |
| START HOPPING | `/trip`; SEE PLACES and VIEW ALL PLACES → `/discover` |
| Profile icon | `/profile` if a demo user is logged in, else `/login` |
| Saved icon | `/discover?saved=1` (Discover ignores it for now; showing only saved places is a follow-up) |
| Search box submit | `/discover?q=<text>` (Discover does not read `q` yet; optional small follow-up) |

## 8. Behaviour and accessibility
- **Hover**: cards lift 4px and the border brightens; buttons fill orange with dark text. Smooth scroll only when motion is allowed.
- **Reveal on scroll** uses **IntersectionObserver** (a browser feature that tells us when an element comes into view; no library). Content is **visible by default**: it is hidden only after the hook confirms IntersectionObserver exists and motion is allowed, so nothing disappears if JS fails or in tests.
- **Save button**: `aria-pressed` (tells screen readers if a toggle is on or off), aria-label "Save Sister Yao's Char Koay Kak", small pop animation (skipped with reduced motion); the navbar count updates.
- **Carousel**: 3 cards on desktop, 1 on phones, moves one card per click; no autoplay; `aria-roledescription="carousel"`, each slide a labelled group, a polite live region says "Review 2 of 6"; Left/Right keys when the carousel has focus; swipe of 50px+ on touch.
- **Navbar**: menu button with `aria-expanded`; Escape closes menu and search; active link has `aria-current="page"`; icon buttons have aria-labels.
- Semantic HTML (`header`, `nav`, `main`, `section` with headings, `footer`), alt text on every image (decorative shapes `alt=""`), visible orange focus ring, skip link.
- **Newsletter and contact are UI only**: nothing is sent anywhere. Email format checked in the browser; on submit show "Newsletter is not available yet. This is a prototype."
- `prefers-reduced-motion` (the system "turn off animations" setting): no reveal, lift, pop or smooth scroll.

## 9. Images and how to replace them
We cannot check photo licences from here and must not invent photo URLs. So we ship **original SVG artwork made in code** in `web/src/assets/landing/`: a round plate with stylised food, chilli/herb/star-anise shapes, and warm gradient placeholders with a food icon for the cards, collage and avatars (initials). SVGs are tiny and every `<img>` has `width` and `height`, which prevents **layout shift** (content jumping when an image loads). Cards and collage use `loading="lazy"`; the hero plate loads first.
**To replace with real photos later**: put the file (own photo, or an Unsplash/Pexels download with the licence noted in a comment) in `web/src/assets/landing/`, resize to about 800px wide (WebP), then change only `src`, `alt`, `width`, `height` in `landingContent.js`.

## 10. Responsive breakpoints
| Width | Layout |
| --- | --- |
| >= 1024px | 4 cards in a row, hero two columns, 3 testimonials, 4 footer columns |
| 640–1023px | 2 cards, hero stacks (text first, then plate), 2 footer columns, menu button below 900px |
| < 640px | 1 card, 1 testimonial, footer 1 column, collage stacks |

## 11. Steps in order (CW = code-writer, CR = code-reviewer, SR = security-reviewer)
| # | Step | Who | How to test |
| --- | --- | --- | --- |
| 1 | Cleanup (section 3), stub HomePage | CW | `npm.cmd test`, `npm.cmd run build`, no `three` in `package.json` |
| 2 | Theme in `tokens.css`, Poppins in `index.html`, reveal + saved-places hooks, storage key | CW | Hook tests: reduced motion and no-IntersectionObserver keep content visible; saved ids persist |
| 3 | `landingContent.js` + SVG assets | CW | Test: 4 places, labels match the hidden gem rule, every image has alt/width/height |
| 4 | Button, SectionHeading, Navbar | CW | Navbar tests: menu toggles `aria-expanded`, active link `aria-current`, search opens and submits to `/discover?q=` |
| 5 | Hero + FeatureBadges | CW | Renders heading, 3 badges, CTA hrefs `/trip` and `/discover` |
| 6 | PlaceCard + PlaceGrid | CW | Label text, save toggles `aria-pressed` and survives a re-render; grid renders from the data file |
| 7 | HowItWorks + Testimonials | CW | Arrows, dots, Left/Right keys, swipe (pointer events), live region text |
| 8 | Footer + HomePage assembly, update `App.test.jsx` and `HomePage.test.jsx` | CW | Bad email shows an error; good email shows the "not available yet" message; About scrolls to `#how-it-works` |
| 9 | Review | CR | Must-fix items go back to CW |
| 10 | Security check | SR | Search text is URL-encoded, no `dangerouslySetInnerHTML`, external links (if any) use `rel="noreferrer"`, newsletter sends nothing |
| 11 | Student checks in the browser, gives feedback | Student | Checklist below. Then WAIT before restyling other pages |

## 12. Browser checklist for the student (`npm.cmd run dev` in `web/`)
- DevTools device bar at 1440px, 768px and 390px wide: card count 4 / 2 / 1, hero stacks, menu button on phone.
- Tab through the whole page with the keyboard: every link and button shows an orange ring, in a sensible order.
- Save a card, refresh: it stays saved and the navbar count matches.
- Carousel: arrows, dots, Left/Right keys, swipe in phone mode.
- Windows: Settings > Accessibility > Visual effects > Animation effects **off**, reload: no fades or lifts, all content visible.
- Check the other pages: new colours, old layout (expected for now).

## 13. Open questions (recommended default in bold)
1. **Photos**: do you have your own food photos? **Default: original SVG placeholders now, swap later.**
2. **Contact email**: **placeholder `hello@mymakanroute.example`** (not a real address) or your preferred address?
3. **Social icons**: brand logos (Instagram, TikTok) are trademarks and lucide no longer ships them. **Default: generic icons (globe, mail, at-sign) shown only if you give real URLs; otherwise hide them.**
4. **Body font**: **Poppins for everything** or keep Karla for body text?
5. **About**: **scroll to the How it works section** or a separate `/about` page later?
6. Featured places: keep the 4 picks above, or **all 4 Hidden Gems**?
