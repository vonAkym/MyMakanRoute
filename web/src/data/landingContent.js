// All words, numbers and pictures of the landing page (Home, "/"). Components only read
// from here, so the text and images can be changed in one place.
//
// IMAGES: food photos supplied by the student (web/src/assets/landing/photos/, WebP).
// LICENCE TO BE CONFIRMED before any public release. They are illustrative: they show the
// kind of dish, not a photo taken at that stall. The route map is original SVG artwork
// (web/src/assets/landing/). To change a picture: put the file in photos/ (about 800px
// wide, WebP), then change only src, alt, width and height below.
//
// PLACES and REVIEWS are SAMPLE data: the ratings are invented (copied from
// backend/db/seeds/sample-places.json) and the reviewers are fictional people.

import { ChartColumn, ClipboardCheck, Gem, Mail, Route, Search, Share2 } from "lucide-react";
import decoChilli from "../assets/landing/deco-chilli.svg";
import decoLeaf from "../assets/landing/deco-leaf.svg";
import decoAnise from "../assets/landing/deco-anise.svg";
import collageRoute from "../assets/landing/collage-route.svg";
import photoNasiLemak from "../assets/landing/photos/nasi-lemak.webp";
import photoMeeGoreng from "../assets/landing/photos/mee-goreng.webp";
import photoVeganBowl from "../assets/landing/photos/vegan-bowl.webp";
import photoBreadToast from "../assets/landing/photos/bread-toast.webp";
import photoBbqPizza from "../assets/landing/photos/bbq-chicken-pizza.webp";

export const CONTACT_EMAIL = "hello@mymakanroute.example"; // placeholder, not a real inbox

// `to` = a page of the app; `anchor` = a section on this page (smooth scroll).
export const NAV_LINKS = Object.freeze([
  { label: "Home", to: "/" },
  { label: "Discover", to: "/discover" },
  { label: "Plan", to: "/trip" },
  { label: "Analytics", to: "/analytics" },
  { label: "About", anchor: "how-it-works" },
]);

export const HERO = Object.freeze({
  eyebrow: "Malaysia's Food Guide",
  title: "Find Hidden Gems. Plan Your ",
  highlight: "Food Trip",
  text: "Discover well-loved local stalls near Penang's famous spots, then let MyMakanRoute plan the shortest walk between them.",
  ctas: [
    { label: "Start Hopping", to: "/trip", variant: "filled" },
    { label: "See Places", to: "/discover", variant: "outline" },
  ],
  image: {
    src: photoNasiLemak,
    alt: "Nasi lemak on a round plate: coconut rice, sambal, boiled egg halves, cucumber slices, peanuts and fried anchovies",
    width: 736,
    height: 613,
    position: "50% 50%", // object-position: keeps the plate centred in the round crop
  },
  badge: { top: "Est.", bottom: "2026" },
  // Decorative shapes around the plate (alt="" so screen readers skip them).
  decorations: [
    { id: "chilli", src: decoChilli, width: 120, height: 60 },
    { id: "leaf", src: decoLeaf, width: 160, height: 60 },
    { id: "anise", src: decoAnise, width: 80, height: 80 },
  ],
});

export const FEATURE_BADGES = Object.freeze([
  { icon: Gem, title: "Hidden Gems", text: "Highly rated, less crowded" },
  { icon: Route, title: "Smart Routes", text: "Shortest walk between stops" },
  { icon: ChartColumn, title: "Food Insights", text: "See how Penang eats" },
]);

// Price level (1 to 4) -> price range per person. Assumption, see docs/plans/landing-page.md.
export const PRICE_RANGES = Object.freeze({
  1: "RM5–10",
  2: "RM10–20",
  3: "RM20–40",
  4: "RM40+",
});

export const PLACES_SECTION = Object.freeze({
  eyebrow: "Handpicked for you",
  title: "",
  highlight: "Hidden Gems",
  after: " Near You",
  text: "Small stalls with big flavour, close to George Town's famous streets.",
  note: "Sample ratings, not real reviews.",
  photoNote: "Photos are illustrative.",
  cta: { label: "View All Places", to: "/discover" },
});

// Labels follow the Hidden Gem rule: rating >= 4.3 AND reviews <= 100, else "Popular".
export const FEATURED_PLACES = Object.freeze([
  {
    id: "node/4572721390",
    name: "Rasheed Mee Goreng",
    description: "Wok-fried yellow noodles, mamak style.",
    cuisine: "Mamak",
    area: "Jelutong",
    halal: true,
    rating: 4.3,
    reviewCount: 42,
    priceLevel: 1,
    label: "Hidden Gem",
    image: {
      src: photoMeeGoreng,
      alt: "A plate of mee goreng: fried yellow noodles with fish balls, egg and vegetables",
      width: 500,
      height: 333,
    },
  },
  {
    id: "node/4967940623",
    name: "VR Pinxin Vegan",
    description: "Plant-based dishes and colourful bowls.",
    cuisine: "Chinese",
    area: "George Town",
    halal: false,
    rating: 4.6,
    reviewCount: 95,
    priceLevel: 2,
    label: "Hidden Gem",
    image: {
      src: photoVeganBowl,
      alt: "A salad bowl with grilled tofu, edamame, corn, tomatoes, red cabbage and quail eggs",
      width: 880,
      height: 880,
    },
  },
  {
    id: "node/10235391594",
    name: "He and She Coffee",
    description: "Coffee with bread and toast.",
    cuisine: "Cafe",
    area: "Gelugor",
    halal: true,
    rating: 4.6,
    reviewCount: 81,
    priceLevel: 2,
    label: "Hidden Gem",
    image: {
      src: photoBreadToast,
      alt: "Slices of white bread on a wooden board with a dish of butter",
      width: 500,
      height: 749,
    },
  },
  {
    id: "node/9985396776",
    name: "Ali Nasi Lemak Daun Pisang",
    description: "Coconut rice with sambal, egg and peanuts.",
    cuisine: "Malay",
    area: "George Town",
    halal: true,
    rating: 4.5,
    reviewCount: 1650,
    priceLevel: 1,
    label: "Popular",
    image: {
      src: photoNasiLemak,
      alt: "Nasi lemak with sambal, boiled egg, cucumber, peanuts and fried anchovies",
      width: 736,
      height: 613,
    },
  },
]);

export const HOW_IT_WORKS = Object.freeze({
  eyebrow: "How it works",
  title: "Plan Every ",
  highlight: "Bite",
  text: "Tell us where you are and what you like. MyMakanRoute finds hidden gem stalls nearby, then orders your stops so you walk less and eat more.",
  stats: [
    { value: "55", label: "Sample places in Penang" },
    { value: "2", label: "Route algorithms (Dijkstra + ACO)" },
    { value: "4.3+", label: "Rating to be a Hidden Gem" },
  ],
  images: [
    {
      src: photoBbqPizza,
      alt: "A BBQ chicken pizza with red onion and coriander on a wooden board",
      width: 500,
      height: 604,
    },
    {
      src: photoVeganBowl,
      alt: "A colourful salad bowl with grilled tofu, edamame, corn and quail eggs",
      width: 880,
      height: 880,
    },
    {
      src: collageRoute,
      alt: "Illustration of a George Town street map with a dotted food route and three numbered stops",
      width: 360,
      height: 260,
    },
  ],
  steps: [
    {
      icon: Search,
      title: "Discover",
      text: "Search near a famous spot and filter by halal, budget or cuisine.",
    },
    {
      icon: Route,
      title: "Plan the route",
      text: "Pick your stops and we work out the shortest walking order.",
    },
    {
      icon: ClipboardCheck,
      title: "Review the trip",
      text: "Reorder, save and look back at your past food hops.",
    },
  ],
});

export const TESTIMONIALS = Object.freeze({
  eyebrow: "Testimonials",
  title: "What Food Hoppers ",
  highlight: "Say",
  note: "Sample reviews from fictional users",
  items: [
    {
      id: "t1",
      name: "Aisyah Rahman",
      role: "Student, USM",
      rating: 5,
      quote:
        "Found a bubur kacang stall I had walked past for years. The route saved my legs in the afternoon heat.",
    },
    {
      id: "t2",
      name: "Wei Jie Tan",
      role: "Weekend food hunter",
      rating: 5,
      quote:
        "I like that the Hidden Gem label is explained. Fewer queues, still great char koay kak.",
    },
    {
      id: "t3",
      name: "Priya Subramaniam",
      role: "First-time visitor",
      rating: 5,
      quote:
        "Halal and budget filters made planning for my family easy. Three stops, one short walk.",
    },
    {
      id: "t4",
      name: "Daniel Koh",
      role: "Photographer",
      rating: 4,
      quote: "The map view helped me plan a morning shoot and breakfast in George Town together.",
    },
    {
      id: "t5",
      name: "Nurul Huda",
      role: "Office worker",
      rating: 5,
      quote:
        "Lunch hop with colleagues, all within twenty minutes of walking. We will do it again.",
    },
    {
      id: "t6",
      name: "Marcus Lim",
      role: "Backpacker",
      rating: 5,
      quote: "Past trips are saved, so I could share my food hop with friends back home.",
    },
  ],
});

export const FOOTER = Object.freeze({
  tagline: "Hidden gem food stalls and smart food hopping routes, starting with Penang.",
  quickLinks: [
    { label: "Discover places", to: "/discover" },
    { label: "Plan a food hop", to: "/trip" },
    { label: "Past trips", to: "/trips" },
    { label: "Food analytics", to: "/analytics" },
    { label: "Log in", to: "/login" },
  ],
  email: CONTACT_EMAIL,
  location: "George Town, Penang, Malaysia",
  newsletter: {
    title: "Newsletter",
    text: "New hidden gems and food routes, once a month.",
    unavailable: "Newsletter is not available yet. This is a prototype.",
  },
  // Generic icons only (no brand logos). type: link (href) | share (share sheet or copy link)
  social: [
    {
      id: "mail",
      icon: Mail,
      label: "Email MyMakanRoute",
      type: "link",
      href: `mailto:${CONTACT_EMAIL}`,
    },
    { id: "share", icon: Share2, label: "Share this page", type: "share" },
  ],
  legal: ["Privacy Policy", "Terms of Services"],
  copyright: "© 2026 MyMakanRoute. A final year project, Universiti Sains Malaysia.",
  photoCredit:
    "Food photos supplied by the project author; licence to be confirmed before public release.",
});
