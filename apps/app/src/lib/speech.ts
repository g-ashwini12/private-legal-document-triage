/**
 * Advanced Emotional & Natural Text-to-Speech (TTS) Engine.
 * 1. Checks Sarvam.ai Indian Language TTS API (Bulbul model) for studio-grade human voices.
 * 2. Falls back to Enhanced Browser Neural Prosody Engine with smart sentence pacing & emotional cadence.
 */

const LANG_BCP47: Record<string, string[]> = {
  en: ['en-IN', 'en-US', 'en-GB', 'en'],
  hi: ['hi-IN', 'hi'],
  kn: ['kn-IN', 'kn'],
  ta: ['ta-IN', 'ta'],
  te: ['te-IN', 'te'],
  ml: ['ml-IN', 'ml'],
};

// Global audio element for streaming Sarvam audio
let activeAudio: HTMLAudioElement | null = null;

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && ('speechSynthesis' in window || 'Audio' in window);
}

export function stopSpeaking() {
  if (typeof window !== 'undefined') {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (activeAudio) {
      activeAudio.pause();
      activeAudio.currentTime = 0;
      activeAudio = null;
    }
  }
}

/**
 * Phonetically cleans and enhances text for emotional, clear speech.
 */
function prepareTextForSpeech(rawText: string): string {
  return rawText
    // Remove markdown asterisks, hashes, backticks
    .replace(/[#*_`~>]/g, '')
    // Remove markdown links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove awkward legal parenthetical designations like ("Landlord") or ("Tenant")
    .replace(/\(["']Landlord["']\)/gi, ', who is the Landlord, ')
    .replace(/\(["']Tenant["']\)/gi, ', who is the Tenant, ')
    .replace(/\(["']([A-Za-z\s]+)["']\)/g, ', also known as $1, ')
    // Replace Rupee symbol with spoken word
    .replace(/₹\s*([0-9,]+)/g, '$1 Rupees')
    .replace(/₹/g, 'Rupees ')
    // Clean double periods or ellipses that cause TTS stutter
    .replace(/\.{2,}/g, '. ')
    // Expand common abbreviations for natural pronunciation
    .replace(/\bp\.\s*(\d+)/gi, 'page $1')
    .replace(/\bcl\.\s*(\d+)/gi, 'clause $1')
    .replace(/\bvs\b\.?/gi, 'versus')
    .replace(/\bi\.e\./gi, 'that is')
    .replace(/\be\.g\./gi, 'for example')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Select the highest-fidelity, most emotional natural voice available on the device.
 */
function findBestVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  const targetPrefixes = LANG_BCP47[lang] || ['en-IN', 'en'];

  // Score voices based on quality keywords
  const scoreVoice = (v: SpeechSynthesisVoice): number => {
    let score = 0;
    const nameLower = v.name.toLowerCase();
    const langLower = v.lang.toLowerCase().replace('_', '-');

    // Exact language match
    if (targetPrefixes.some((p) => langLower.startsWith(p.toLowerCase()))) {
      score += 100;
    } else if (langLower.startsWith(lang.toLowerCase())) {
      score += 60;
    } else if (langLower.startsWith('en')) {
      score += 20;
    }

    // High quality / Neural voice indicators
    if (nameLower.includes('natural') || nameLower.includes('neural')) score += 50;
    if (nameLower.includes('enhanced') || nameLower.includes('premium')) score += 40;
    if (nameLower.includes('google')) score += 35;
    if (nameLower.includes('siri') || nameLower.includes('rishi') || nameLower.includes('veena')) score += 40;
    if (v.localService === true || (v as any).local === true) score += 15;

    return score;
  };

  const sorted = [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a));
  return sorted.length > 0 ? sorted[0] : null;
}

export async function speakLocalText(
  text: string,
  lang: string = 'en',
  onEnd?: () => void,
  onError?: (msg: string) => void
): Promise<boolean> {
  if (!isSpeechSupported()) {
    onError?.('Audio speech is not supported in this browser.');
    return false;
  }

  stopSpeaking();

  const cleanText = prepareTextForSpeech(text);
  if (!cleanText) {
    onEnd?.();
    return false;
  }

  // 1. ATTEMPT SARVAM.AI TTS FIRST
  try {
    const userSarvamKey = (typeof window !== 'undefined' ? localStorage.getItem('sarvam_api_key') : '') || '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    };
    if (userSarvamKey) {
      headers['x-sarvam-key'] = userSarvamKey;
    }

    const ttsRes = await fetch('/api/tts', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text: cleanText.substring(0, 500),
        language: lang,
        speaker: 'kavya',
      }),
    });

    if (ttsRes.ok) {
      const data = await ttsRes.json();
      if (data.status === 'ok' && data.audio_base64) {
        const audioSrc = `data:${data.format || 'audio/wav'};base64,${data.audio_base64}`;
        const audio = new Audio(audioSrc);
        activeAudio = audio;
        audio.onended = () => {
          activeAudio = null;
          onEnd?.();
        };
        audio.onerror = () => {
          activeAudio = null;
          fallbackBrowserSpeech(cleanText, lang, onEnd, onError);
        };
        await audio.play();
        return true;
      }
    }
  } catch (err) {
    // If Sarvam network fails, fall through smoothly to enhanced browser TTS
  }

  // 2. ENHANCED EMOTIONAL BROWSER SPEECH SYNTHESIS
  return fallbackBrowserSpeech(cleanText, lang, onEnd, onError);
}

function fallbackBrowserSpeech(
  cleanText: string,
  lang: string,
  onEnd?: () => void,
  onError?: (msg: string) => void
): boolean {
  if (!('speechSynthesis' in window)) {
    onError?.('Speech synthesis unavailable.');
    return false;
  }

  const voices = window.speechSynthesis.getVoices();
  const bestVoice = findBestVoice(voices, lang);

  const utterance = new SpeechSynthesisUtterance(cleanText);
  if (bestVoice) {
    utterance.voice = bestVoice;
    utterance.lang = bestVoice.lang;
  } else {
    utterance.lang = LANG_BCP47[lang]?.[0] || 'en-IN';
  }

  // Dynamic emotional pacing:
  // Lower rate slightly (0.92) to give sentences clear human warmth and prevent rush
  utterance.rate = 0.92;
  // Slightly higher pitch (1.05) creates an attentive, friendly, reassuring cadence
  utterance.pitch = 1.05;

  utterance.onend = () => {
    onEnd?.();
  };

  utterance.onerror = (e) => {
    if (e.error !== 'canceled') {
      console.warn('SpeechSynthesis event:', e.error);
    }
    onEnd?.();
  };

  window.speechSynthesis.speak(utterance);
  return true;
}
