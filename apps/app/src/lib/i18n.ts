import en from '../locales/en.json';
import ta from '../locales/ta.json';
import kn from '../locales/kn.json';
import te from '../locales/te.json';
import hi from '../locales/hi.json';
import ml from '../locales/ml.json';

export type LanguageCode = 'en' | 'ta' | 'kn' | 'te' | 'hi' | 'ml';

export const SUPPORTED_LANGUAGES: Record<LanguageCode, { label: string; native: string }> = {
  en: { label: 'English', native: 'English' },
  ta: { label: 'Tamil', native: 'தமிழ்' },
  kn: { label: 'Kannada', native: 'ಕನ್ನಡ' },
  te: { label: 'Telugu', native: 'తెలుగు' },
  hi: { label: 'Hindi', native: 'हिन्दी' },
  ml: { label: 'Malayalam', native: 'മലയാളം' },
};

const translations: Record<LanguageCode, Record<string, string>> = {
  en,
  ta,
  kn,
  te,
  hi,
  ml,
};

export function getDictionary(lang: string = 'en'): Record<string, string> {
  const code = (lang in translations ? lang : 'en') as LanguageCode;
  return translations[code] || translations.en;
}

export function t(key: string, lang: string = 'en'): string {
  const dict = getDictionary(lang);
  return dict[key] || translations.en[key] || key;
}

export function formatCitation(clauseRef?: string, page?: number, lang: string = 'en'): string {
  if (!clauseRef) return '';
  const clauseWord = t('clause', lang);
  const pageWord = t('page', lang);
  
  // Extract number (e.g. 9 or 9.1)
  const match = clauseRef.match(/\d+(?:\.\d+)*/);
  const num = match ? match[0] : '';
  const localizedClause = num ? `${clauseWord} ${num}` : clauseRef;
  
  if (page) {
    return `${localizedClause} (${pageWord} ${page})`;
  }
  return localizedClause;
}
