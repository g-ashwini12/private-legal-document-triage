'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Sun, Moon, Globe, Volume2, Check, X, Sparkles } from 'lucide-react';
import { SUPPORTED_LANGUAGES, LanguageCode, t } from '@/lib/i18n';

interface NavbarProps {
  currentLanguage?: LanguageCode;
  onLanguageChange?: (lang: LanguageCode) => void;
}

export default function Navbar({ currentLanguage = 'en', onLanguageChange }: NavbarProps) {
  const [selectedLang, setSelectedLang] = useState<LanguageCode>(currentLanguage);
  const [isDark, setIsDark] = useState(false);
  const [showSarvamModal, setShowSarvamModal] = useState(false);
  const [sarvamKey, setSarvamKey] = useState('');
  const [tempKey, setTempKey] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

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

    // Sarvam API key initialization
    const key = localStorage.getItem('sarvam_api_key') || '';
    setSarvamKey(key);
    setTempKey(key);
  }, []);

  const handleSaveSarvamKey = () => {
    const trimmed = tempKey.trim();
    setSarvamKey(trimmed);
    if (trimmed) {
      localStorage.setItem('sarvam_api_key', trimmed);
    } else {
      localStorage.removeItem('sarvam_api_key');
    }
    setSavedNotice(true);
    setTimeout(() => {
      setSavedNotice(false);
      setShowSarvamModal(false);
    }, 1200);
  };

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

        {/* Right side: Language selector & Theme toggle & Voice config */}
        <div className="flex items-center space-x-2.5">
          {/* Sarvam.ai Voice status/config button */}
          <button
            onClick={() => {
              setTempKey(sarvamKey);
              setShowSarvamModal(true);
            }}
            aria-label="Sarvam AI Voice"
            title={sarvamKey ? "Sarvam.ai Studio Voice Active" : "Connect Sarvam.ai Voice"}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
              sarvamKey
                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-[11px] font-bold">
              {sarvamKey ? 'Sarvam: ON' : 'Sarvam.ai'}
            </span>
          </button>

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

      {/* Sarvam.ai Voice Modal */}
      {showSarvamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Sarvam.ai Studio Voice</h3>
                  <p className="text-[11px] text-slate-500">Bulbul v1 Ultra-Realistic Indian Voices</p>
                </div>
              </div>
              <button
                onClick={() => setShowSarvamModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Enter your <strong>Sarvam.ai API Subscription Key</strong> to enable emotional, studio-quality speech in Hindi, Tamil, Telugu, Kannada, Malayalam, and Indian English.
            </p>

            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                API Subscription Key
              </label>
              <input
                type="password"
                value={tempKey}
                onChange={(e) => setTempKey(e.target.value)}
                placeholder="Paste your sarvam.ai API key..."
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Keys remain strictly on your device and are never sent to third parties.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowSarvamModal(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSarvamKey}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center space-x-1 shadow-xs cursor-pointer"
              >
                {savedNotice ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <span>Save Key</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
