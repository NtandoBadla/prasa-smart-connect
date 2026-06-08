import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Chatbot } from "@/components/Chatbot";
import { STATIONS, SCHEDULES } from "@/data/prasa";
import { MapPin, Train, Footprints, Info, ArrowRight, Landmark, Clock, Banknote, Tag } from "lucide-react";

export const Route = createFileRoute("/tourist")({
  head: () => ({
    meta: [
      { title: "Tourist Mode — PRASA Smart Connect" },
      { name: "description", content: "Discover real attractions reachable by Metrorail across the Western Cape." },
    ],
  }),
  component: TouristPage,
});

type Category = "Beach" | "Nature" | "Culture" | "Food & Wine" | "History" | "Family" | "Adventure";

interface Attraction {
  name: string;
  category: Category;
  walk: string;
  tip: string;
  hours: string;
  entry: string;
  googleMaps: string;
}

const CATEGORY_COLOR: Record<Category, string> = {
  "Beach":       "bg-blue-100 text-blue-700",
  "Nature":      "bg-green-100 text-green-700",
  "Culture":     "bg-purple-100 text-purple-700",
  "Food & Wine": "bg-orange-100 text-orange-700",
  "History":     "bg-amber-100 text-amber-700",
  "Family":      "bg-pink-100 text-pink-700",
  "Adventure":   "bg-red-100 text-red-700",
};

const ATTRACTIONS: Record<string, Attraction[]> = {
  "Cape Town": [
    { name: "V&A Waterfront", category: "Family", walk: "15 min walk", tip: "Iconic harbour with 80+ shops, restaurants, Two Oceans Aquarium and Cape Wheel. Lively day and night.", hours: "Daily 09:00–21:00", entry: "Free entry (attractions vary)", googleMaps: "https://maps.google.com/?q=V%26A+Waterfront+Cape+Town" },
    { name: "Bo-Kaap (Cape Malay Quarter)", category: "Culture", walk: "10 min walk", tip: "Brightly coloured houses, cobblestone streets and Cape Malay cuisine. Visit the Bo-Kaap Museum for history.", hours: "Always accessible", entry: "Free (museum R20)", googleMaps: "https://maps.google.com/?q=Bo-Kaap+Cape+Town" },
    { name: "Table Mountain National Park", category: "Nature", walk: "20 min walk to cable car lower station or MyCiti bus", tip: "Book cable car tickets online at tablemountain.net — queues are long in summer. Clear days only.", hours: "Daily 08:00–19:00 (weather permitting)", entry: "Cable car R420 adults / R210 children", googleMaps: "https://maps.google.com/?q=Table+Mountain+Cape+Town" },
    { name: "District Six Museum", category: "History", walk: "12 min walk", tip: "Powerful exhibition on forced removals under apartheid. Essential Cape Town experience.", hours: "Mon–Sat 09:00–16:00", entry: "R50 adults / R25 students", googleMaps: "https://maps.google.com/?q=District+Six+Museum+Cape+Town" },
    { name: "Company's Garden", category: "Nature", walk: "15 min walk", tip: "Historic garden in the heart of the city — great picnic spot next to the South African Museum and National Gallery.", hours: "Daily 07:00–19:00", entry: "Free", googleMaps: "https://maps.google.com/?q=Company%27s+Garden+Cape+Town" },
    { name: "Long Street", category: "Culture", walk: "10 min walk", tip: "Cape Town's most vibrant street — bookshops, cafés, rooftop bars and street food. Best in the evening.", hours: "Always accessible", entry: "Free", googleMaps: "https://maps.google.com/?q=Long+Street+Cape+Town" },
  ],
  "Woodstock": [
    { name: "The Old Biscuit Mill", category: "Food & Wine", walk: "8 min walk", tip: "Trendy design market and artisan food hall. Saturday morning Neighbourgoods Market is a must-visit.", hours: "Market: Sat 09:00–14:00 | Shops: Mon–Sat", entry: "Free entry", googleMaps: "https://maps.google.com/?q=Old+Biscuit+Mill+Woodstock" },
    { name: "Woodstock Street Art Trail", category: "Culture", walk: "5 min walk", tip: "Open-air urban art gallery — Albert Road is lined with murals by local and international artists.", hours: "Always accessible", entry: "Free", googleMaps: "https://maps.google.com/?q=Woodstock+Street+Art+Cape+Town" },
    { name: "Albert Road Antiques", category: "Culture", walk: "5 min walk", tip: "Dozens of antique dealers along Albert Road — great for vintage finds and Cape Dutch furniture.", hours: "Mon–Sat 09:00–17:00", entry: "Free", googleMaps: "https://maps.google.com/?q=Albert+Road+Woodstock+Cape+Town" },
  ],
  "Salt River": [
    { name: "Salt River Market", category: "Food & Wine", walk: "5 min walk", tip: "Weekend market with local produce, street food and crafts in a converted warehouse space.", hours: "Sat–Sun 09:00–15:00", entry: "Free", googleMaps: "https://maps.google.com/?q=Salt+River+Cape+Town" },
    { name: "Cape Town City Bowl Cycling", category: "Adventure", walk: "10 min walk to cycle hire", tip: "Rent a bicycle and cycle along the Green Point urban park route to the Sea Point promenade.", hours: "Daily 08:00–18:00", entry: "Bike hire from R150/day", googleMaps: "https://maps.google.com/?q=Salt+River+Cape+Town" },
  ],
  "Observatory": [
    { name: "South African Astronomical Observatory", category: "History", walk: "15 min walk", tip: "Oldest astronomical observatory in the Southern Hemisphere. Public viewing nights held regularly — book ahead.", hours: "Public nights: monthly (check saao.ac.za)", entry: "R50 adults / R30 children", googleMaps: "https://maps.google.com/?q=South+African+Astronomical+Observatory" },
    { name: "Observatory Main Road", category: "Food & Wine", walk: "5 min walk", tip: "Bohemian strip packed with independent cafés, vegan restaurants, craft beer bars and live music venues.", hours: "Daily from 08:00", entry: "Free", googleMaps: "https://maps.google.com/?q=Observatory+Main+Road+Cape+Town" },
    { name: "Groote Schuur Estate Walks", category: "Nature", walk: "10 min walk", tip: "Free hiking trails through indigenous fynbos with sweeping views of the Cape Peninsula.", hours: "Daily 07:00–18:00", entry: "Free", googleMaps: "https://maps.google.com/?q=Groote+Schuur+Estate+Cape+Town" },
  ],
  "Mowbray": [
    { name: "Rondebosch Common", category: "Nature", walk: "10 min walk", tip: "Urban nature reserve — good birdwatching and a peaceful walk away from city noise.", hours: "Always accessible", entry: "Free", googleMaps: "https://maps.google.com/?q=Rondebosch+Common+Cape+Town" },
    { name: "Josephine Mill", category: "History", walk: "12 min walk", tip: "Cape Town's only working water mill (1840). Heritage site with café and craft market.", hours: "Tue–Sat 09:00–16:00", entry: "R30 adults", googleMaps: "https://maps.google.com/?q=Josephine+Mill+Cape+Town" },
  ],
  "Rondebosch": [
    { name: "University of Cape Town (UCT) Campus", category: "Culture", walk: "15 min walk uphill", tip: "Stunning colonial campus on the slopes of Devil's Peak — walk up to Jammie Plaza for panoramic views.", hours: "Always accessible", entry: "Free", googleMaps: "https://maps.google.com/?q=UCT+campus+Cape+Town" },
    { name: "Liesbeek River Greenway", category: "Nature", walk: "5 min walk", tip: "Scenic riverside walking and cycling path connecting Rondebosch to Observatory through indigenous vegetation.", hours: "Always accessible", entry: "Free", googleMaps: "https://maps.google.com/?q=Liesbeek+River+Greenway" },
  ],
  "Newlands": [
    { name: "Newlands Cricket Ground", category: "Culture", walk: "10 min walk", tip: "One of the world's most scenic cricket venues — check fixtures at cricket.co.za. Tours available on non-match days.", hours: "Match days / tours by arrangement", entry: "Match tickets vary", googleMaps: "https://maps.google.com/?q=Newlands+Cricket+Ground" },
    { name: "Newlands Rugby Stadium", category: "Culture", walk: "12 min walk", tip: "Historic home of Western Province rugby — tours and match-day experience available.", hours: "Match days / tours by arrangement", entry: "Match tickets vary", googleMaps: "https://maps.google.com/?q=Newlands+Rugby+Stadium" },
    { name: "Newlands Forest", category: "Nature", walk: "20 min walk", tip: "Pine forest walking trails on the slopes of Table Mountain. Dog-friendly and well-shaded.", hours: "Daily 07:00–18:00", entry: "Free", googleMaps: "https://maps.google.com/?q=Newlands+Forest+Cape+Town" },
  ],
  "Claremont": [
    { name: "Kirstenbosch National Botanical Garden", category: "Nature", walk: "20 min walk or Uber", tip: "World-famous botanical garden on the eastern slopes of Table Mountain. Don't miss the Boomslang canopy walkway. Summer sunset concerts on Sundays.", hours: "Daily 08:00–18:00 (summer 19:00)", entry: "R220 adults / R30 children", googleMaps: "https://maps.google.com/?q=Kirstenbosch+Botanical+Garden" },
    { name: "Cavendish Square Shopping Centre", category: "Family", walk: "8 min walk", tip: "Major shopping mall with cinema, restaurants and pick-up point for local tour buses.", hours: "Daily 09:00–21:00", entry: "Free", googleMaps: "https://maps.google.com/?q=Cavendish+Square+Claremont" },
    { name: "Arderne Gardens", category: "Nature", walk: "10 min walk", tip: "Hidden gem — one of Africa's oldest cultivated gardens with massive trees and tranquil ponds.", hours: "Daily 08:00–17:00", entry: "Free", googleMaps: "https://maps.google.com/?q=Arderne+Gardens+Claremont" },
  ],
  "Wynberg": [
    { name: "Maynardville Open Air Theatre", category: "Culture", walk: "10 min walk", tip: "Annual Shakespeare festival held every January–February in a beautiful open-air park setting.", hours: "Jan–Feb season (check schedule)", entry: "Tickets from R150", googleMaps: "https://maps.google.com/?q=Maynardville+Open+Air+Theatre" },
    { name: "Wynberg Village", category: "History", walk: "5 min walk", tip: "Charming Victorian high street with antique shops, deli's and the oldest licensed pub in Cape Town.", hours: "Daily", entry: "Free", googleMaps: "https://maps.google.com/?q=Wynberg+Village+Cape+Town" },
  ],
  "Retreat": [
    { name: "Rondevlei Nature Reserve", category: "Nature", walk: "20 min walk or taxi", tip: "Wetland reserve with hippos, 230+ bird species and peaceful walking trails. Bring binoculars.", hours: "Daily 07:30–17:00", entry: "R40 adults / R20 children", googleMaps: "https://maps.google.com/?q=Rondevlei+Nature+Reserve" },
    { name: "Zandvlei Estuary Nature Reserve", category: "Nature", walk: "15 min walk", tip: "Estuary reserve popular for kayaking, birdwatching and cycling. Canoe hire available.", hours: "Daily 08:00–17:00", entry: "R20", googleMaps: "https://maps.google.com/?q=Zandvlei+Estuary+Nature+Reserve" },
  ],
  "Muizenberg": [
    { name: "Muizenberg Beach & Surfers Corner", category: "Beach", walk: "5 min walk", tip: "Cape Town's premier surf beach with iconic colourful beach huts. Best for beginners — surf lessons from R350. Warm water on the False Bay side.", hours: "Always accessible", entry: "Free (surf lessons vary)", googleMaps: "https://maps.google.com/?q=Muizenberg+Beach" },
    { name: "Het Posthuys (Muizenberg Battle Site)", category: "History", walk: "8 min walk", tip: "Site of the 1806 Battle of Muizenberg — small museum in Cape Town's oldest surviving building.", hours: "Tue–Sun 10:00–16:00", entry: "R20", googleMaps: "https://maps.google.com/?q=Het+Posthuys+Muizenberg" },
    { name: "Rhodes Cottage Museum", category: "History", walk: "5 min walk", tip: "Cecil John Rhodes' seaside cottage where he died in 1902 — preserved as it was with original artefacts.", hours: "Mon–Sat 10:00–16:00", entry: "R20", googleMaps: "https://maps.google.com/?q=Rhodes+Cottage+Museum+Muizenberg" },
    { name: "Muizenberg Mountain Trails", category: "Adventure", walk: "20 min walk to trailhead", tip: "Cape Point Nature Reserve access trails with stunning views over False Bay. Silvermine section highly recommended.", hours: "Daily 07:00–18:00", entry: "R100 (Cape Nature permit)", googleMaps: "https://maps.google.com/?q=Muizenberg+Mountain+Trails" },
  ],
  "Fish Hoek": [
    { name: "Fish Hoek Beach", category: "Beach", walk: "8 min walk", tip: "One of Cape Town's safest swimming beaches — no alcohol, no surfing. Excellent whale watching (June–November). Lifeguards on duty.", hours: "Always accessible", entry: "Free", googleMaps: "https://maps.google.com/?q=Fish+Hoek+Beach" },
    { name: "Peer's Cave", category: "History", walk: "30 min uphill hike", tip: "San archaeological site with 12,000-year-old human remains discovered here. Stunning valley views from the cave entrance.", hours: "Always accessible (self-guided)", entry: "Free", googleMaps: "https://maps.google.com/?q=Peer%27s+Cave+Fish+Hoek" },
    { name: "Jager's Walk", category: "Nature", walk: "10 min walk to start", tip: "Scenic clifftop path between Fish Hoek and Sunny Cove — excellent whale and dolphin sightings in season.", hours: "Always accessible", entry: "Free", googleMaps: "https://maps.google.com/?q=Jager%27s+Walk+Fish+Hoek" },
    { name: "Kalk Bay Harbour & Caves", category: "Adventure", walk: "10 min walk to Kalk Bay station (one stop back)", tip: "Vibrant fishing harbour with fresh fish, antique shops, and the famous Kalk Bay Caves above the village.", hours: "Daily", entry: "Free", googleMaps: "https://maps.google.com/?q=Kalk+Bay+Harbour" },
  ],
  "Simon's Town": [
    { name: "Boulders Beach Penguin Colony", category: "Family", walk: "12 min walk", tip: "African penguin colony of 3,000+ birds — arrive before 09:00 for best experience. Managed by SANParks.", hours: "Daily 08:00–17:00 (summer 19:00)", entry: "R245 adults / R125 children", googleMaps: "https://maps.google.com/?q=Boulders+Beach+Penguins+Simon%27s+Town" },
    { name: "Simon's Town Museum", category: "History", walk: "5 min walk", tip: "Rich naval and social history including the famous dog Able Seaman Just Nuisance. Free entry.", hours: "Mon–Fri 09:00–16:00 | Sat 10:00–13:00", entry: "Free", googleMaps: "https://maps.google.com/?q=Simon%27s+Town+Museum" },
    { name: "Simon's Town Waterfront", category: "Culture", walk: "3 min walk", tip: "Charming Victorian main street with seafood restaurants, navy ships in the harbour and boat trips to Cape Point.", hours: "Daily", entry: "Free", googleMaps: "https://maps.google.com/?q=Simon%27s+Town+Waterfront" },
    { name: "Cape of Good Hope (via boat/taxi)", category: "Adventure", walk: "Taxi or tour bus from station", tip: "Southernmost tip of the Cape Peninsula — dramatic cliffs, wildlife and the famous sign. Best reached by tour from Simon's Town station.", hours: "Daily 07:00–17:00", entry: "R340 adults (SANParks)", googleMaps: "https://maps.google.com/?q=Cape+of+Good+Hope" },
  ],
  "Bellville": [
    { name: "Tyger Valley Shopping Centre", category: "Family", walk: "Taxi / 20 min walk", tip: "Large regional mall with entertainment, cinema and food court.", hours: "Daily 09:00–21:00", entry: "Free", googleMaps: "https://maps.google.com/?q=Tyger+Valley+Shopping+Centre" },
    { name: "Durbanville Wine Valley", category: "Food & Wine", walk: "Taxi from station (15 min)", tip: "18 wine farms within easy reach — Nitida, Diemersdal and Durbanville Hills are top picks. Many open weekends.", hours: "Generally Mon–Sun 10:00–17:00 (farms vary)", entry: "Tasting from R80–R150", googleMaps: "https://maps.google.com/?q=Durbanville+Wine+Valley" },
    { name: "Bellville Velodrome", category: "Adventure", walk: "15 min walk", tip: "International cycling track — public riding sessions and events.", hours: "Check schedule", entry: "Varies", googleMaps: "https://maps.google.com/?q=Bellville+Velodrome" },
  ],
  "Parow": [
    { name: "Parow Civic Centre & Park", category: "Family", walk: "5 min walk", tip: "Well-maintained public park — good for a rest between train connections.", hours: "Daily", entry: "Free", googleMaps: "https://maps.google.com/?q=Parow+Cape+Town" },
  ],
  "Goodwood": [
    { name: "Goodwood Park", category: "Nature", walk: "8 min walk", tip: "Large suburban park with sports facilities and walking paths.", hours: "Daily 07:00–18:00", entry: "Free", googleMaps: "https://maps.google.com/?q=Goodwood+Park+Cape+Town" },
  ],
  "Khayelitsha": [
    { name: "Lookout Hill (Qhakaza)", category: "Culture", walk: "20 min walk", tip: "Cultural heritage site with panoramic views over Khayelitsha and Table Mountain. Community guides available for township tours.", hours: "Daily 08:00–17:00", entry: "R50 (guided tour)", googleMaps: "https://maps.google.com/?q=Lookout+Hill+Khayelitsha" },
    { name: "Khayelitsha Wetlands Park", category: "Nature", walk: "15 min walk", tip: "Restored wetland with boardwalks and birdwatching — a peaceful escape inside the township.", hours: "Daily 07:00–18:00", entry: "Free", googleMaps: "https://maps.google.com/?q=Khayelitsha+Wetlands+Park" },
    { name: "Khayelitsha Craft Market", category: "Culture", walk: "10 min walk", tip: "Local crafts, beadwork, artwork and township cuisine — supports community artists directly.", hours: "Sat–Sun 09:00–16:00", entry: "Free", googleMaps: "https://maps.google.com/?q=Khayelitsha+Craft+Market" },
  ],
  "Mitchells Plain": [
    { name: "Strandfontein Beach & Wetlands", category: "Beach", walk: "Taxi / 25 min walk", tip: "Long, quiet beach on False Bay with extensive wetlands — excellent for birding and beach walks.", hours: "Always accessible", entry: "Free", googleMaps: "https://maps.google.com/?q=Strandfontein+Beach+Cape+Town" },
    { name: "Blue Waters Community Park", category: "Family", walk: "10 min walk", tip: "Community park with sports fields and braai facilities.", hours: "Daily", entry: "Free", googleMaps: "https://maps.google.com/?q=Mitchells+Plain+Cape+Town" },
  ],
  "Philippi": [
    { name: "Philippi Horticultural Area", category: "Nature", walk: "10 min walk", tip: "Unique urban farming area supplying much of Cape Town's fresh produce — guided farm walks available.", hours: "Weekdays by arrangement", entry: "Free / small donation", googleMaps: "https://maps.google.com/?q=Philippi+Horticultural+Area" },
  ],
  "Nyanga": [
    { name: "Gugulethu Memorial", category: "History", walk: "Taxi (10 min)", tip: "Amy Biehl memorial and Gugulethu Seven memorial — important anti-apartheid history sites. Guided township tours recommended.", hours: "Always accessible", entry: "Free", googleMaps: "https://maps.google.com/?q=Amy+Biehl+Memorial+Gugulethu" },
  ],
  "Langa": [
    { name: "Langa Township Heritage Tour", category: "Culture", walk: "5 min walk", tip: "Cape Town's oldest township (1927) — guided heritage walks covering history, street art and local culture. Highly recommended.", hours: "Daily by arrangement (book ahead)", entry: "R150–R300 per person", googleMaps: "https://maps.google.com/?q=Langa+Township+Cape+Town" },
    { name: "Guga S'Thebe Arts Centre", category: "Culture", walk: "10 min walk", tip: "Community arts and culture centre hosting local theatre, music and exhibitions.", hours: "Mon–Fri 09:00–17:00", entry: "Free / small fee for events", googleMaps: "https://maps.google.com/?q=Guga+S%27Thebe+Arts+Centre+Langa" },
  ],
  "Pinelands": [
    { name: "Pinelands Rose Garden", category: "Nature", walk: "10 min walk", tip: "Beautiful public rose garden — best visited October to April when roses are in bloom.", hours: "Daily 08:00–18:00", entry: "Free", googleMaps: "https://maps.google.com/?q=Pinelands+Rose+Garden+Cape+Town" },
    { name: "Century City Canals", category: "Family", walk: "Taxi / 15 min walk", tip: "Walkable canal network with restaurants, canal boat trips and the Ratanga Junction site.", hours: "Daily", entry: "Free", googleMaps: "https://maps.google.com/?q=Century+City+Canal+Cape+Town" },
  ],
  "Stellenbosch": [
    { name: "Stellenbosch Village Museum", category: "History", walk: "5 min walk", tip: "Four restored historic houses spanning 1709–1850 — the finest example of Cape Dutch architecture open to the public.", hours: "Mon–Sat 09:00–17:00 | Sun 10:00–16:00", entry: "R80 adults / R20 children", googleMaps: "https://maps.google.com/?q=Stellenbosch+Village+Museum" },
    { name: "Stellenbosch Winelands", category: "Food & Wine", walk: "Organised tours from station / taxi", tip: "Over 200 wine farms — Spier, Tokara, Rustenburg and Delaire Graff are unmissable. Many offer cellar tours, cheese pairings and restaurants.", hours: "Generally Mon–Sun 10:00–17:00", entry: "Tasting R80–R200 per farm", googleMaps: "https://maps.google.com/?q=Stellenbosch+Winelands" },
    { name: "Dorp Street Historic Walk", category: "Culture", walk: "5 min walk", tip: "One of South Africa's best-preserved historic streets — oak-lined with Cape Dutch, Georgian and Victorian buildings.", hours: "Always accessible", entry: "Free", googleMaps: "https://maps.google.com/?q=Dorp+Street+Stellenbosch" },
    { name: "Jonkershoek Nature Reserve", category: "Adventure", walk: "Taxi (15 min from station)", tip: "World-renowned hiking destination in the Jonkershoek Valley with mountain streams and fynbos.", hours: "Daily 07:00–18:00", entry: "R100 (Cape Nature permit)", googleMaps: "https://maps.google.com/?q=Jonkershoek+Nature+Reserve" },
    { name: "Oom Samie se Winkel", category: "Culture", walk: "5 min walk", tip: "Stellenbosch's most famous general dealer since 1904 — quirky, old-world shop selling everything from antiques to biltong.", hours: "Daily 09:00–17:30", entry: "Free", googleMaps: "https://maps.google.com/?q=Oom+Samie+se+Winkel+Stellenbosch" },
  ],
};

type Step =
  | { type: "train"; trainNo: string; line: string; from: string; to: string; departure: string; arrival: string; platform: string }
  | { type: "walk"; from: string; duration: string }
  | { type: "attraction"; attraction: Attraction; station: string };

function buildItinerary(from: string, to: string): Step[] {
  const steps: Step[] = [];

  const direct = SCHEDULES.find((s) => {
    const stops = s.stops.map((x) => x.toLowerCase());
    const fi = stops.indexOf(from.toLowerCase());
    const ti = stops.indexOf(to.toLowerCase());
    return fi !== -1 && ti !== -1 && fi < ti;
  });

  if (direct) {
    steps.push({ type: "train", trainNo: direct.trainNo, line: direct.line, from, to, departure: direct.departure, arrival: direct.arrival, platform: direct.platform });
  } else {
    const leg1 = SCHEDULES.find((s) => {
      const stops = s.stops.map((x) => x.toLowerCase());
      return stops.includes(from.toLowerCase()) && stops.includes("cape town");
    });
    const leg2 = SCHEDULES.find((s) => {
      const stops = s.stops.map((x) => x.toLowerCase());
      return stops.includes("cape town") && stops.includes(to.toLowerCase());
    });
    if (leg1) steps.push({ type: "train", trainNo: leg1.trainNo, line: leg1.line, from, to: "Cape Town", departure: leg1.departure, arrival: leg1.arrival, platform: leg1.platform });
    if (leg1 && leg2) steps.push({ type: "walk", from: "Cape Town", duration: "5–10 min platform transfer at Cape Town station" });
    if (leg2) steps.push({ type: "train", trainNo: leg2.trainNo, line: leg2.line, from: "Cape Town", to, departure: leg2.departure, arrival: leg2.arrival, platform: leg2.platform });
  }

  steps.push({ type: "walk", from: to, duration: "Exit station — attractions below are walkable or a short taxi away" });

  (ATTRACTIONS[to] ?? []).forEach((a) => steps.push({ type: "attraction", attraction: a, station: to }));

  return steps;
}

// Stations that have at least one attraction
const TOURIST_STATIONS = STATIONS.filter((s) => (ATTRACTIONS[s]?.length ?? 0) > 0);

function TouristPage() {
  const [from, setFrom] = useState("Cape Town");
  const [to, setTo]     = useState("Simon's Town");
  const [itinerary, setItinerary] = useState<Step[] | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category | "All">("All");

  const plan = () => {
    setItinerary(buildItinerary(from, to));
    setActiveCategory("All");
  };

  const allAttractions = ATTRACTIONS[to] ?? [];
  const categories = [...new Set(allAttractions.map((a) => a.category))] as Category[];
  const filteredAttractions = activeCategory === "All" ? allAttractions : allAttractions.filter((a) => a.category === activeCategory);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <section className="bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-8">
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
            <Landmark className="h-6 w-6 text-destructive" /> Tourist Mode
          </h1>
          <p className="mt-1 text-sm opacity-90">
            Real attractions reachable by Metrorail — plan your day trip across the Western Cape.
          </p>
        </div>
      </section>

      <section className="container mx-auto flex-1 px-4 py-8 space-y-6">

        {/* Planner form */}
        <div className="rounded-md border border-border bg-card p-5 shadow-card space-y-4">
          <h2 className="text-base font-semibold text-foreground">Plan your tourist journey</h2>
          <div className="flex flex-wrap gap-4">
            <label className="flex flex-col gap-1 flex-1 min-w-[160px]">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">From</span>
              <select value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-sm border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30">
                {STATIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 flex-1 min-w-[160px]">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">To (Destination)</span>
              <select value={to} onChange={(e) => setTo(e.target.value)} className="rounded-sm border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30">
                {TOURIST_STATIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <button onClick={plan} className="flex items-center gap-2 rounded-sm bg-destructive px-5 py-2.5 text-sm font-semibold text-destructive-foreground hover:opacity-90">
            <MapPin className="h-4 w-4" /> Plan Tourist Route
          </button>
        </div>

        {/* Itinerary */}
        {itinerary && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-foreground">
              Your itinerary: <span className="text-primary">{from}</span> → <span className="text-primary">{to}</span>
            </h2>

            {/* Train & walk steps */}
            <div className="space-y-3">
              {itinerary.filter((s) => s.type !== "attraction").map((step, i) => (
                <ItineraryStep key={i} step={step} index={i + 1} />
              ))}
            </div>

            {/* Attraction cards */}
            {filteredAttractions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    {allAttractions.length} attraction{allAttractions.length !== 1 ? "s" : ""} near {to}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {(["All", ...categories] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setActiveCategory(cat as any)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${
                          activeCategory === cat
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border bg-card text-foreground hover:bg-secondary"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {filteredAttractions.map((a, i) => (
                    <AttractionCard key={i} attraction={a} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Browse all attractions without planning */}
        {!itinerary && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider text-muted-foreground">
              Popular Destinations by Train
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {TOURIST_STATIONS.map((station) => (
                <div key={station} className="rounded-md border border-border bg-card p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Train className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-semibold text-sm text-foreground">{station}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {ATTRACTIONS[station].slice(0, 3).map((a) => (
                      <span key={a.name} className={`text-xs rounded-full px-2 py-0.5 font-medium ${CATEGORY_COLOR[a.category]}`}>
                        {a.name}
                      </span>
                    ))}
                    {ATTRACTIONS[station].length > 3 && (
                      <span className="text-xs text-muted-foreground">+{ATTRACTIONS[station].length - 3} more</span>
                    )}
                  </div>
                  <button
                    onClick={() => { setTo(station); plan(); }}
                    className="text-xs text-primary font-semibold hover:underline"
                  >
                    Plan route →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tips */}
        <div className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground mb-2">💡 Metrorail Tourist Tips</p>
          <ul className="space-y-1 list-disc pl-4">
            <li>Buy a <strong>Day Tripper</strong> ticket at Cape Town station — unlimited rides on the day.</li>
            <li>The <strong>Southern Line</strong> (Simon's Town direction) is the most scenic tourist route — stunning False Bay coast.</li>
            <li>Trains run roughly every 30–60 min — always check the Schedules tab before travelling.</li>
            <li>Travel <strong>off-peak</strong> (after 09:00, before 16:00) for a safer, more comfortable journey.</li>
            <li>Keep valuables in a front bag and stay alert at busy stations.</li>
          </ul>
        </div>
      </section>

      <Footer />
      <Chatbot />
    </div>
  );
}

function ItineraryStep({ step, index }: { step: Step; index: number }) {
  if (step.type === "train") {
    return (
      <div className="flex gap-3 rounded-md border border-border bg-card p-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">{index}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Train className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground text-sm">Board train</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{step.line}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span>{step.from}</span><ArrowRight className="h-3 w-3" /><span>{step.to}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Train #{step.trainNo} · Departs {step.departure} · Arrives {step.arrival} · Platform {step.platform}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3 rounded-md border border-border bg-card p-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning/80 text-white text-xs font-bold">{index}</div>
      <div className="flex items-center gap-2 text-sm">
        <Footprints className="h-4 w-4 text-warning" />
        <span className="text-muted-foreground">{step.duration}</span>
      </div>
    </div>
  );
}

function AttractionCard({ attraction: a }: { attraction: Attraction }) {
  return (
    <div className="rounded-md border border-border bg-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-foreground text-sm">{a.name}</span>
        <span className={`shrink-0 text-xs rounded-full px-2 py-0.5 font-semibold ${CATEGORY_COLOR[a.category]}`}>
          {a.category}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{a.tip}</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Footprints className="h-3 w-3 shrink-0" />{a.walk}</span>
        <span className="flex items-center gap-1"><Banknote className="h-3 w-3 shrink-0" />{a.entry}</span>
        <span className="flex items-center gap-1 col-span-2"><Clock className="h-3 w-3 shrink-0" />{a.hours}</span>
      </div>
      <a
        href={a.googleMaps}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
      >
        <MapPin className="h-3 w-3" /> View on Google Maps
      </a>
    </div>
  );
}
