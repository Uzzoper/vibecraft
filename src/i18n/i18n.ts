import { translations, TranslationLocale } from "./translations";

let currentLocale: TranslationLocale = "en";
const dict: Record<string, string> = {};

function detectLanguage(): TranslationLocale {
  const lang = navigator.language;
  if (lang.startsWith("pt")) {
    return "ptBR";
  }
  return "en";
}

export function initI18n(): void {
  const saved = localStorage.getItem("vibecraft-lang");
  if (saved === "en" || saved === "ptBR") {
    currentLocale = saved;
  } else {
    currentLocale = detectLanguage();
  }
  const selectedDict = translations[currentLocale];
  Object.keys(selectedDict).forEach(key => {
    dict[key] = selectedDict[key];
  });
}

export function setLocale(locale: TranslationLocale): void {
  currentLocale = locale;
  const selectedDict = translations[currentLocale];
  Object.keys(selectedDict).forEach(key => {
    dict[key] = selectedDict[key];
  });
  localStorage.setItem("vibecraft-lang", locale);
}

export function t(key: string): string {
  return dict[key] ?? key;
}

export function getLocale(): TranslationLocale {
  return currentLocale;
}

initI18n();
