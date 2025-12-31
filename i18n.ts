// i18n.ts (project root)
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "app_language";

export type AppLang = "en" | "es" | "pl" | "tl";

const resources = {
  en: {
    translation: {
      // language toggle
      language: "Language",
      english: "English",
      spanish: "Spanish",
      polish: "Polish",
      tagalog: "Tagalog",

      // home
      home_subtitle:
        "The liturgical year, saints, and novenas of the Catholic Church — presented day by day for prayer and reflection.",

      // tabs
      tabs_home: "Home",
      tabs_novenas: "Novenas",
      tabs_liturgical: "Liturgical",
      tabs_saints: "Saints",
      tabs_about: "About",

      // common
      close: "Close",

      // saints
      saints: "Saints",
      saint_of_the_day: "Saint of the day",
      other_saints_today: "Other saints today",
      no_saint_entry_found: "No saint entry found for this date.",

      // novenas
      novenas: "Novenas",
      starts_today: "Starts today",
      feast_today: "Feast today",
      no_novenas_or_feasts: "No novenas start or feast on this day.",
      start_novena: "Start Novena",

      // liturgical
      liturgical: "Liturgical",
      no_liturgical_observance_found:
        "No liturgical observance found for this date.",

      // about
      about_subtitle:
        "A simple, focused Catholic companion: liturgical seasons, saints, and novenas — with daily readings one tap away.",
      about_whats_in_app: "What’s in the app",
      about_liturgical_desc:
        "seasons + major celebrations that shape the Church year.",
      about_saints_desc: "saint of the day + other saints commemorated.",
      about_novenas_desc: "novenas that start today + related feast days.",
      about_daily_readings: "Daily readings",
      about_daily_readings_body:
        "We link to the official USCCB daily readings by date.",
      about_open_usccb_readings: "Open USCCB Readings",
      about_notes_disclaimer: "Notes & disclaimer",
      about_disclaimer_1:
        "This app is not an official publication of the USCCB or the Holy See. It’s a devotional aid built to be helpful and practical.",
      about_disclaimer_2:
        "If a parish/diocese observes a transferred feast or local proper, always follow local guidance.",
      about_helpful_links: "Helpful links",
      about_usccb_daily_bible_reading: "USCCB Daily Bible Reading",
      about_liturgical_reference: "Liturgical calendar reference",

      // badges
      badge_feast_prefix: "Feast: ",
      badge_rank_prefix: "{{rank}}: {{title}}",

      // month grid
      monthgrid_change_month_year: "Change month and year",
      monthgrid_tap_to_jump: "Tap to jump",
      monthgrid_jump_title: "Jump to month",
      monthgrid_jump_subtitle: "Select a month, then adjust the year.",
      monthgrid_apply: "Apply",
      monthgrid_cancel: "Cancel",
      monthgrid_year_increase: "Increase year",
      monthgrid_year_decrease: "Decrease year",
    },
  },

  es: {
    translation: {
      language: "Idioma",
      english: "Inglés",
      spanish: "Español",
      polish: "Polaco",
      tagalog: "Tagalo",

      home_subtitle:
        "El año litúrgico, santos y novenas de la Iglesia Católica — presentados día a día para la oración y la reflexión.",

      tabs_home: "Inicio",
      tabs_novenas: "Novenas",
      tabs_liturgical: "Litúrgico",
      tabs_saints: "Santos",
      tabs_about: "Acerca de",

      close: "Cerrar",

      saints: "Santos",
      saint_of_the_day: "Santo del día",
      other_saints_today: "Otros santos hoy",
      no_saint_entry_found: "No se encontró ningún santo para esta fecha.",

      novenas: "Novenas",
      starts_today: "Empieza hoy",
      feast_today: "Fiesta hoy",
      no_novenas_or_feasts: "No hay novenas ni fiestas en este día.",
      start_novena: "Comenzar novena",

      liturgical: "Litúrgico",
      no_liturgical_observance_found:
        "No se encontró una celebración litúrgica para esta fecha.",

      // about
      about_subtitle:
        "Un compañero católico simple y enfocado: tiempos litúrgicos, santos y novenas — con las lecturas diarias a un toque.",
      about_whats_in_app: "Qué incluye la app",
      about_liturgical_desc:
        "tiempos + celebraciones mayores que marcan el año de la Iglesia.",
      about_saints_desc: "santo del día + otros santos conmemorados.",
      about_novenas_desc: "novenas que comienzan hoy + fiestas relacionadas.",
      about_daily_readings: "Lecturas diarias",
      about_daily_readings_body:
        "Enlazamos a las lecturas diarias oficiales de la USCCB según la fecha.",
      about_open_usccb_readings: "Abrir lecturas USCCB",
      about_notes_disclaimer: "Notas y aviso",
      about_disclaimer_1:
        "Esta app no es una publicación oficial de la USCCB ni de la Santa Sede. Es una ayuda devocional pensada para ser práctica.",
      about_disclaimer_2:
        "Si una parroquia/diócesis observa una fiesta trasladada o un propio local, siga siempre la guía local.",
      about_helpful_links: "Enlaces útiles",
      about_usccb_daily_bible_reading: "Lectura bíblica diaria USCCB",
      about_liturgical_reference: "Referencia del calendario litúrgico",

      badge_feast_prefix: "Fiesta: ",
      badge_rank_prefix: "{{rank}}: {{title}}",

      monthgrid_change_month_year: "Cambiar mes y año",
      monthgrid_tap_to_jump: "Toca para saltar",
      monthgrid_jump_title: "Ir al mes",
      monthgrid_jump_subtitle: "Selecciona un mes y luego ajusta el año.",
      monthgrid_apply: "Aplicar",
      monthgrid_cancel: "Cancelar",
      monthgrid_year_increase: "Aumentar año",
      monthgrid_year_decrease: "Disminuir año",
    },
  },

  pl: {
    translation: {
      language: "Język",
      english: "Angielski",
      spanish: "Hiszpański",
      polish: "Polski",
      tagalog: "Tagalog",

      home_subtitle:
        "Rok liturgiczny, święci i nowenny Kościoła katolickiego — dzień po dniu dla modlitwy i refleksji.",

      tabs_home: "Start",
      tabs_novenas: "Nowenny",
      tabs_liturgical: "Liturgia",
      tabs_saints: "Święci",
      tabs_about: "O aplikacji",

      close: "Zamknij",

      saints: "Święci",
      saint_of_the_day: "Święty dnia",
      other_saints_today: "Inni święci dziś",
      no_saint_entry_found: "Brak wpisu o świętym dla tej daty.",

      novenas: "Nowenny",
      starts_today: "Zaczyna się dziś",
      feast_today: "Święto dziś",
      no_novenas_or_feasts: "Dziś nie zaczyna się żadna nowenna ani święto.",
      start_novena: "Rozpocznij nowennę",

      liturgical: "Liturgia",
      no_liturgical_observance_found:
        "Brak wydarzenia liturgicznego dla tej daty.",

      // about
      about_subtitle:
        "Prosty, skoncentrowany katolicki towarzysz: okresy liturgiczne, święci i nowenny — z codziennymi czytaniami jednym dotknięciem.",
      about_whats_in_app: "Co jest w aplikacji",
      about_liturgical_desc:
        "okresy + ważne celebracje, które kształtują rok Kościoła.",
      about_saints_desc: "święty dnia + inni wspominani święci.",
      about_novenas_desc:
        "nowenny, które zaczynają się dziś + powiązane dni świąteczne.",
      about_daily_readings: "Czytania dnia",
      about_daily_readings_body:
        "Linkujemy do oficjalnych czytań liturgicznych USCCB według daty.",
      about_open_usccb_readings: "Otwórz czytania USCCB",
      about_notes_disclaimer: "Uwagi i zastrzeżenie",
      about_disclaimer_1:
        "Ta aplikacja nie jest oficjalną publikacją USCCB ani Stolicy Apostolskiej. To pomoc modlitewna stworzona, by była praktyczna i pomocna.",
      about_disclaimer_2:
        "Jeśli parafia/diecezja obchodzi przeniesione święto lub własne uroczystości lokalne, zawsze kieruj się lokalnymi wskazaniami.",
      about_helpful_links: "Przydatne linki",
      about_usccb_daily_bible_reading: "Codzienne czytanie Biblii USCCB",
      about_liturgical_reference: "Źródło kalendarza liturgicznego",

      badge_feast_prefix: "Święto: ",
      badge_rank_prefix: "{{rank}}: {{title}}",

      monthgrid_change_month_year: "Zmień miesiąc i rok",
      monthgrid_tap_to_jump: "Dotknij, aby przejść",
      monthgrid_jump_title: "Przejdź do miesiąca",
      monthgrid_jump_subtitle: "Wybierz miesiąc, potem ustaw rok.",
      monthgrid_apply: "Zastosuj",
      monthgrid_cancel: "Anuluj",
      monthgrid_year_increase: "Zwiększ rok",
      monthgrid_year_decrease: "Zmniejsz rok",
    },
  },

  tl: {
    translation: {
      language: "Wika",
      english: "Ingles",
      spanish: "Espanyol",
      polish: "Polish",
      tagalog: "Tagalog",

      home_subtitle:
        "Ang taon ng liturhiya, mga santo, at mga nobena ng Simbahang Katolika — araw-araw para sa panalangin at pagninilay.",

      tabs_home: "Home",
      tabs_novenas: "Nobena",
      tabs_liturgical: "Liturhiya",
      tabs_saints: "Mga Santo",
      tabs_about: "Tungkol",

      close: "Isara",

      saints: "Mga Santo",
      saint_of_the_day: "Santo ng araw",
      other_saints_today: "Iba pang santo ngayon",
      no_saint_entry_found: "Walang entry ng santo para sa petsang ito.",

      novenas: "Nobena",
      starts_today: "Nagsisimula ngayon",
      feast_today: "Kapistahan ngayon",
      no_novenas_or_feasts: "Walang nobena o kapistahan sa araw na ito.",
      start_novena: "Simulan ang Nobena",

      liturgical: "Liturhiya",
      no_liturgical_observance_found:
        "Walang liturgical na pagdiriwang para sa petsang ito.",

      // about
      about_subtitle:
        "Isang simple at nakatuong Catholic companion: mga panahon ng liturhiya, mga santo, at mga nobena — may arawang pagbasa sa isang tap.",
      about_whats_in_app: "Ano ang nasa app",
      about_liturgical_desc:
        "mga panahon + mahahalagang pagdiriwang na humuhubog sa taon ng Simbahan.",
      about_saints_desc: "santo ng araw + iba pang mga santong ginugunita.",
      about_novenas_desc:
        "mga nobenang nagsisimula ngayon + kaugnay na mga kapistahan.",
      about_daily_readings: "Arawang pagbasa",
      about_daily_readings_body:
        "Nagli-link kami sa opisyal na USCCB daily readings ayon sa petsa.",
      about_open_usccb_readings: "Buksan ang USCCB Readings",
      about_notes_disclaimer: "Paalala at disclaimer",
      about_disclaimer_1:
        "Ang app na ito ay hindi opisyal na publikasyon ng USCCB o ng Holy See. Ito ay devotional aid na ginawa upang maging kapaki-pakinabang at praktikal.",
      about_disclaimer_2:
        "Kung ang parokya/diyosesis ay may inilipat na kapistahan o lokal na proper, sundin palagi ang lokal na gabay.",
      about_helpful_links: "Mga kapaki-pakinabang na link",
      about_usccb_daily_bible_reading: "USCCB Daily Bible Reading",
      about_liturgical_reference: "Liturgical calendar reference",

      badge_feast_prefix: "Kapistahan: ",
      badge_rank_prefix: "{{rank}}: {{title}}",

      monthgrid_change_month_year: "Palitan ang buwan at taon",
      monthgrid_tap_to_jump: "I-tap para lumundag",
      monthgrid_jump_title: "Pumunta sa buwan",
      monthgrid_jump_subtitle:
        "Pumili ng buwan, pagkatapos ay ayusin ang taon.",
      monthgrid_apply: "Ilapat",
      monthgrid_cancel: "Kanselahin",
      monthgrid_year_increase: "Dagdagan ang taon",
      monthgrid_year_decrease: "Bawasan ang taon",
    },
  },
} as const;

async function getInitialLanguage(): Promise<AppLang> {
  const saved = await AsyncStorage.getItem(STORAGE_KEY);
  if (saved === "en" || saved === "es" || saved === "pl" || saved === "tl") {
    return saved;
  }

  // ✅ expo-localization (modern API): getLocales()[0].languageCode
  const device = (
    Localization.getLocales?.()?.[0]?.languageCode || "en"
  ).toLowerCase();

  if (device === "es") return "es";
  if (device === "pl") return "pl";
  if (device === "tl") return "tl";
  return "en";
}

let initialized = false;

export async function initI18n() {
  if (initialized) return i18n;

  const lng = await getInitialLanguage();

  // ✅ Force options overload + fix compatibilityJSON typing
  await i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: "en",
    supportedLngs: ["en", "es", "pl", "tl"],
    interpolation: { escapeValue: false },
    compatibilityJSON: "v4",
    // Nice-to-have: avoid console warnings for missing keys in prod
    // (still returns the key or defaultValue)
    returnNull: false,
  });

  initialized = true;
  return i18n;
}

export async function setLanguage(lang: AppLang) {
  await AsyncStorage.setItem(STORAGE_KEY, lang);
  await i18n.changeLanguage(lang);
}

export default i18n;
