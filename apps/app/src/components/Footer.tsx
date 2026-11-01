'use client';

import React, { useEffect, useState } from 'react';
import { t } from '@/lib/i18n';

export default function Footer() {
  const [lang, setLang] = useState('en');

  useEffect(() => {
    const saved = localStorage.getItem('app_lang') || 'en';
    setLang(saved);

    const onLangChange = (e: any) => {
      setLang(e.detail || 'en');
    };
    window.addEventListener('app-language-change', onLangChange);
    return () => window.removeEventListener('app-language-change', onLangChange);
  }, []);

  return (
    <footer className="w-full border-t border-slate-200 dark:border-slate-800 py-4 px-4 text-center bg-white dark:bg-slate-900 transition-colors">
      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
        {t('privacyNote', lang)}
      </p>
    </footer>
  );
}
