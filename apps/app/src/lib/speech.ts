/**
 * Local SpeechSynthesis utility.
 * Strictly uses local voices (voice.localService === true).
 * Never calls remote or cloud speech services.
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

  window.speechSynthesis.cancel();

  const voices = window.speechSynthesis.getVoices();
  const targetPrefixes = LANG_BCP47[lang] || ['en'];

  // STRICT REQUIREMENT: Only localService voices!
  // Filter for local voices matching language prefix
  const localVoices = voices.filter((v) => {
    const isLocal = v.localService === true || (v as any).local === true;
    return isLocal;
  });

  const matchingVoice = localVoices.find((v) =>
    targetPrefixes.some((prefix) => v.lang.toLowerCase().startsWith(prefix.toLowerCase()))
  ) || (lang === 'en' ? localVoices.find((v) => v.lang.toLowerCase().startsWith('en')) : null);

  if (!matchingVoice) {
    onError?.('No local voice installed on your device for this language.');
    return false;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = matchingVoice;
  utterance.lang = matchingVoice.lang;
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  utterance.onend = () => {
    onEnd?.();
  };
  utterance.onerror = (e) => {
    console.warn('Speech error:', e);
    onEnd?.();
  };

  window.speechSynthesis.speak(utterance);
  return true;
}
