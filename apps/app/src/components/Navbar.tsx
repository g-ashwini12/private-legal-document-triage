'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Sun, Moon, Globe } from 'lucide-react';
import { SUPPORTED_LANGUAGES, LanguageCode, t } from '@/lib/i18n';

interface NavbarProps {
  currentLanguage?: LanguageCode;
  onLanguageChange?: (lang: LanguageCode) => void;
}

export default function Navbar({ currentLanguage = 'en', onLanguageChange }: NavbarProps) {
  const [selectedLang, setSelectedLang] = useState<LanguageCode>(currentLanguage);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Sync language from localStorage
    const savedLang = (localStorage.getItem('app_lang') || 'en') as LanguageCode;
    if (savedLang && SUPPORTED_LANGUAGES[savedLang]) {
      setSelectedLang(savedLang);
    }

    // Theme initialization
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'dark' || (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const handleLangChange = (lang: LanguageCode) => {
    setSelectedLang(lang);
    localStorage.setItem('app_lang', lang);
    if (onLanguageChange) {
      onLanguageChange(lang);
    }
    // Also dispatch custom event for listeners
    window.dispatchEvent(new CustomEvent('app-language-change', { detail: lang }));
  };

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDark(true);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xs transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand / Title only */}
        <Link href="/" className="flex items-center space-x-2.5 group">
          <img
            src="/logo-icon.png"
            alt="Logo"
            className="w-8 h-8 rounded-lg shadow-xs group-hover:scale-105 transition-transform object-contain"
          />
          <span className="font-bold text-base sm:text-lg text-slate-900 dark:text-white tracking-tight">
            {t('appName', selectedLang)}
          </span>
        </Link>

        {/* Right side: Language selector & Theme toggle ONLY */}
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center">
            <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400 absolute left-2.5 pointer-events-none" />
            <select
              value={selectedLang}
              onChange={(e) => handleLangChange(e.target.value as LanguageCode)}
              aria-label="Select Language"
              className="pl-8 pr-4 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-xs"
            >
              {(Object.keys(SUPPORTED_LANGUAGES) as LanguageCode[]).map((code) => (
                <option key={code} value={code}>
                  {SUPPORTED_LANGUAGES[code].native} ({SUPPORTED_LANGUAGES[code].label})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={toggleTheme}
            aria-label="Toggle Theme"
            className="p-2 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
