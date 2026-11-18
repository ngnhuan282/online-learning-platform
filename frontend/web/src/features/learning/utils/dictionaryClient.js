import { toeicApi } from '../api/toeicApi';

const cache = new Map();

export function normalizeLookupTerm(raw) {
  return String(raw ?? '')
    .replace(/[‑–—]/g, '-')
    .replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

async function fetchExternalPhoneticsAndEnglish(word, signal) {
  if (!word || word.includes(' ') || typeof globalThis.fetch !== 'function') return null;
  // Skip external network calls in jsdom/unit-test environments where gateway.test or localhost test stubs run
  if (globalThis.IS_REACT_ACT_ENVIRONMENT) return null;
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 2400);
  const onAbort = () => controller.abort();
  signal?.addEventListener?.('abort', onAbort, { once: true });
  try {
    const response = await globalThis.fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`,
      { signal: controller.signal },
    );
    if (!response.ok) return null;
    const payload = await response.json();
    const entry = Array.isArray(payload) ? payload[0] : null;
    if (!entry) return null;
    const phonetic = entry.phonetic || entry.phonetics?.find(item => item?.text)?.text || null;
    const audioUrl =
      entry.phonetics?.find(item => item?.audio && item.audio.includes('-us'))?.audio ||
      entry.phonetics?.find(item => item?.audio)?.audio ||
      null;
    const englishMeanings = (entry.meanings ?? []).slice(0, 3).map(group => ({
      partOfSpeech: group.partOfSpeech || '',
      definitionEn: group.definitions?.[0]?.definition || '',
      exampleEn: group.definitions?.[0]?.example || '',
    }));
    return { phonetic, audioUrl, englishMeanings };
  } catch {
    return null;
  } finally {
    globalThis.clearTimeout(timeout);
    signal?.removeEventListener?.('abort', onAbort);
  }
}

export async function lookupDictionaryTerm(rawTerm, options = {}) {
  const term = normalizeLookupTerm(rawTerm);
  if (!term) {
    return {
      term: '',
      headword: '',
      phonetic: null,
      audioUrl: null,
      meanings: [],
      englishMeanings: [],
      relatedForms: [],
      found: false,
    };
  }
  const cacheKey = term.toLowerCase();
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const [localResult, externalResult] = await Promise.all([
    toeicApi
      .dictionary(term, options)
      .then(res => res?.data ?? null)
      .catch(() => null),
    fetchExternalPhoneticsAndEnglish(term, options.signal),
  ]);

  const headword = localResult?.headword || term.toLowerCase();
  let externalHeadwordResult = externalResult;
  if (!externalHeadwordResult && headword !== term.toLowerCase()) {
    externalHeadwordResult = await fetchExternalPhoneticsAndEnglish(headword, options.signal);
  }

  const meanings = localResult?.meanings ?? [];
  const englishMeanings = externalHeadwordResult?.englishMeanings ?? [];
  const merged = {
    term,
    headword,
    phonetic: localResult?.phonetic || externalHeadwordResult?.phonetic || null,
    audioUrl: externalHeadwordResult?.audioUrl || null,
    meanings,
    englishMeanings,
    relatedForms: localResult?.relatedForms ?? [],
    found: Boolean(meanings.length > 0 || englishMeanings.length > 0),
  };
  cache.set(cacheKey, merged);
  return merged;
}

export function speakEnglishText(text, accent = 'en-US', audioUrl = null) {
  const clean = String(text ?? '').trim();
  if (!clean) return;
  if (audioUrl && accent === 'en-US' && typeof globalThis.Audio === 'function') {
    try {
      const audio = new globalThis.Audio(audioUrl);
      void audio.play().catch(() => fallbackSpeech(clean, accent));
      return;
    } catch {
      // Fall through to speechSynthesis
    }
  }
  fallbackSpeech(clean, accent);
}

function fallbackSpeech(text, accent) {
  const synth = globalThis.window?.speechSynthesis;
  const Utterance = globalThis.window?.SpeechSynthesisUtterance;
  if (!synth || !Utterance) return;
  try {
    synth.cancel();
    const utterance = new Utterance(text);
    utterance.lang = accent;
    utterance.rate = 0.95;
    synth.speak(utterance);
  } catch {
    // Ignore unsupported browser speech errors
  }
}
