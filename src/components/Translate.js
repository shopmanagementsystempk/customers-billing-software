import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import translations from '../utils/translations';

export function Translate({ textKey, fallback }) {
  const { language } = useLanguage();

  // Get translation for current language, or use fallback if translation is missing
  const translated = translations[language]?.[textKey] || fallback || textKey;

  return <>{translated}</>;
}

/**
 * Utility function to get translated text outside of JSX (e.g. for placeholders)
 * Reads current language from localStorage to stay in sync with LanguageContext
 */
export const getTranslatedAttr = (textKey, fallback) => {
  const language = localStorage.getItem('language') || 'en';
  return translations[language]?.[textKey] || fallback || textKey;
};

export default Translate;
