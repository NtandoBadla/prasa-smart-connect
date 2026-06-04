import { createContext, useContext } from "react";

export type Lang = "en" | "af" | "xh" | "zu" | "st";

export const LANG_LABELS: Record<Lang, string> = {
  en: "English",
  af: "Afrikaans",
  xh: "isiXhosa",
  zu: "isiZulu",
  st: "Sesotho",
};

export const T: Record<Lang, Record<string, string>> = {
  en: {
    home: "Home",
    crowding: "Crowding Predictor",
    liveMap: "Live Map",
    getAlerts: "Get Alerts",
    fares: "Fares & Tickets",
    news: "News",
    safety: "Safety & SOS",
    lostFound: "Lost & Found",
    more: "More",
    tagline: "AI Powered Smart Commuter System",
    heroTitle: "Move smarter across the Western Cape.",
    heroSub: "Plan your Metrorail trip, track trains in real time and get instant service alerts — all in one place.",
    liveTrains: "Live trains",
    serviceAlerts: "Service alerts",
    todayServices: "Today's services",
    shareJourney: "Share Journey",
    touristMode: "Tourist Mode",
    crimeMap: "Crime Hotspots",
  },
  af: {
    home: "Tuis",
    crowding: "Drukte Voorspeller",
    liveMap: "Lewendige Kaart",
    getAlerts: "Kry Waarskuwings",
    fares: "Tariewe & Kaartjies",
    news: "Nuus",
    safety: "Veiligheid & SOS",
    lostFound: "Verlore & Gevind",
    more: "Meer",
    tagline: "KI-aangedrewe Slim Pendelaar Stelsel",
    heroTitle: "Beweeg slimmer deur die Wes-Kaap.",
    heroSub: "Beplan jou Metrorail-rit, volg treine intyds en kry onmiddellike diensopdate.",
    liveTrains: "Lewendige treine",
    serviceAlerts: "Dienswaarskuwings",
    todayServices: "Vandag se dienste",
    shareJourney: "Deel Reis",
    touristMode: "Toeristemodus",
    crimeMap: "Misdaadkol-kaart",
  },
  xh: {
    home: "Ikhaya",
    crowding: "Umlinganiselo Wabantu",
    liveMap: "Imephu Ephilayo",
    getAlerts: "Fumana Isilumkiso",
    fares: "Iimali & Amatikiti",
    news: "Iindaba",
    safety: "Ukhuseleko & SOS",
    lostFound: "Lahlekileyo & Fumanekalayo",
    more: "Okungaphezulu",
    tagline: "Inkqubo Ehlakaniphileyo Yomhambi",
    heroTitle: "Hamba ngobuchule eNtshona Koloni.",
    heroSub: "Hlela uhambo lwakho lweMeto, ulandele iitrene ngexesha langoku.",
    liveTrains: "Iitrene eziphilayo",
    serviceAlerts: "Iilumkiso zeenkonzo",
    todayServices: "Iinkonzo zanamhlanje",
    shareJourney: "Yabelana ngoHambo",
    touristMode: "Imowudi yoNdwendwe",
    crimeMap: "Iindawo Ezingalunganga",
  },
  zu: {
    home: "Ikhaya",
    crowding: "Isibalo Sabantu",
    liveMap: "Imephu Ephilayo",
    getAlerts: "Thola Izexwayiso",
    fares: "Izintengo & Amathikithi",
    news: "Izindaba",
    safety: "Ukuphepha & SOS",
    lostFound: "Lahlekile & Kutholakele",
    more: "Okuningi",
    tagline: "Uhlelo Lohamba Oluhlakaniphile",
    heroTitle: "Hamba ngokuhlakanipha eNtshonalanga Kapa.",
    heroSub: "Hlela uhambo lwakho lweMeto, ulandele izitimela ngesikhathi sangempela.",
    liveTrains: "Izitimela eziphilayo",
    serviceAlerts: "Izexwayiso zensizakalo",
    todayServices: "Izinsizakalo zanamhlanje",
    shareJourney: "Yabelana ngoHambo",
    touristMode: "Imodi yoVakashi",
    crimeMap: "Izindawo Eziyingozi",
  },
  st: {
    home: "Hae",
    crowding: "Bohlokwa ba Batho",
    liveMap: "Mmapa o Phelang",
    getAlerts: "Fumana Litemoso",
    fares: "Litheko & Litekete",
    news: "Litaba",
    safety: "Ts'ireletso & SOS",
    lostFound: "Lahlehileng & Fumanoeng",
    more: "Haholoanyane",
    tagline: "Tsamaiso e Bohlale ea Mohahlauli",
    heroTitle: "Tsamaea ka bohlale Kapa Bophirima.",
    heroSub: "Etsa moralo oa leeto la hao la Metrorail, latela likoloi ka nako ea 'nete.",
    liveTrains: "Likoloi tse phelang",
    serviceAlerts: "Litemoso tsa tshebeletso",
    todayServices: "Litshebeletso tsa lehono",
    shareJourney: "Arolelana Leeto",
    touristMode: "Mokhoa oa Mochabi",
    crimeMap: "Libaka tse Kotsi",
  },
};

export const LangContext = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}>({
  lang: "en",
  setLang: () => {},
  t: (k) => k,
});

export function useLang() {
  return useContext(LangContext);
}
