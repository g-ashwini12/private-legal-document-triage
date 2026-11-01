/**
 * Browser SpeechSynthesis utility for Text-to-Speech (TTS).
 * Prioritizes on-device / local voices, with seamless fallback so audio always plays.
 */

const LANG_BCP47: Record<string, string[]> = {
  en: ['en-US', 'en-IN', 'en-GB', 'en'],
  ta: ['ta-IN', 'ta'],
  kn: ['kn-IN', 'kn'],
  te: ['te-IN', 'te'],
  hi: ['hi-IN', 'hi'],
  ml: ['ml-IN', 'ml'],
};

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function stopSpeaking() {
  if (isSpeechSupported()) {
    window.speechSynthesis.cancel();
  }
}

export function speakLocalText(
  text: string,
  lang: string = 'en',
  onEnd?: () => void,
  onError?: (msg: string) => void
): boolean {
  if (!isSpeechSupported()) {
    onError?.('Speech is not supported in this browser.');
    return false;
  }

  // Stop any active speech
  window.speechSynthesis.cancel();

  // Clean text of markdown asterisks/hashes for clean listening
  const cleanText = text
    .replace(/[#*_`~>]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/₹/g, 'Rupees ')
    .trim();

  if (!cleanText) {
    onEnd?.();
    return false;
  }

  const voices = window.speechSynthesis.getVoices();
  const targetPrefixes = LANG_BCP47[lang] || ['en'];

  // 1. Try local voice matching target language
  let matchingVoice = voices.find((v) => {
    const isLocal = v.localService === true || (v as any).local === true;
    return isLocal && targetPrefixes.some((prefix) => v.lang.toLowerCase().replace('_', '-').startsWith(prefix.toLowerCase()));
  });

  // 2. Try any voice matching target language
  if (!matchingVoice) {
    matchingVoice = voices.find((v) =>
      targetPrefixes.some((prefix) => v.lang.toLowerCase().replace('_', '-').startsWith(prefix.toLowerCase()))
    );
  }

  // 3. Fallback to English voice if Indian language voice isn't installed
  if (!matchingVoice) {
    matchingVoice = voices.find((v) => v.lang.toLowerCase().startsWith('en-in')) ||
                    voices.find((v) => v.lang.toLowerCase().startsWith('en')) ||
                    voices[0];
  }

  const utterance = new SpeechSynthesisUtterance(cleanText);
  if (matchingVoice) {
    utterance.voice = matchingVoice;
    utterance.lang = matchingVoice.lang;
  } else {
    utterance.lang = targetPrefixes[0] || 'en-US';
  }

  utterance.rate = 0.95; // Slightly slower for clear legal comprehension
  utterance.pitch = 1.0;

  utterance.onend = () => {
    onEnd?.();
  };

  utterance.onerror = (e) => {
    // If canceled by user, don't treat as error
    if (e.error !== 'canceled') {
      console.warn('Speech error:', e);
    }
    onEnd?.();
  };

  window.speechSynthesis.speak(utterance);
  return true;
}
