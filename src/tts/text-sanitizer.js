/**
 * Sanitizes and prepares summary text for natural-sounding Text-to-Speech output.
 */

/**
 * Detects whether the text is primarily German, English, or unknown.
 * @param {string} text
 * @returns {'de' | 'en' | 'auto'}
 */
export function detectLanguage(text) {
  if (!text || typeof text !== 'string') return 'auto';
  const lower = text.toLowerCase();

  const germanMarkers = [' und ', ' der ', ' die ', ' das ', ' ist ', ' nicht ', ' eine ', ' einen ', ' für ', ' video ', ' zusammenfassung '];
  const englishMarkers = [' and ', ' the ', ' is ', ' not ', ' a ', ' an ', ' for ', ' video ', ' summary ', ' about ', ' with '];

  let deScore = 0;
  let enScore = 0;

  for (const marker of germanMarkers) {
    if (lower.includes(marker)) deScore++;
  }
  for (const marker of englishMarkers) {
    if (lower.includes(marker)) enScore++;
  }

  // Also check umlauts
  if (/[äöüßÄÖÜ]/.test(text)) {
    deScore += 3;
  }

  if (deScore > enScore) return 'de';
  if (enScore > deScore) return 'en';
  return 'auto';
}

/**
 * Normalizes timestamps like 01:23 or 1:04:20 into spoken text.
 * @param {string} text
 * @param {'de' | 'en'} [lang='de']
 * @returns {string}
 */
export function normalizeTimestamps(text, lang = 'de') {
  if (!text) return '';

  // Match hh:mm:ss or mm:ss
  return text.replace(/\b(\d{1,2}):(\d{2}):(\d{2})\b/g, (_match, h, m, s) => {
    const hours = parseInt(h, 10);
    const minutes = parseInt(m, 10);
    const seconds = parseInt(s, 10);
    if (lang === 'de') {
      return `${hours} Stunden, ${minutes} Minuten und ${seconds} Sekunden`;
    }
    return `${hours} hours, ${minutes} minutes and ${seconds} seconds`;
  }).replace(/\b(\d{1,2}):(\d{2})\b/g, (_match, m, s) => {
    const minutes = parseInt(m, 10);
    const seconds = parseInt(s, 10);
    if (lang === 'de') {
      return `${minutes} Minuten und ${seconds} Sekunden`;
    }
    return `${minutes} minutes and ${seconds} seconds`;
  });
}

/**
 * Cleans markdown, formatting artifacts, emojis, and raw links.
 * @param {string} text
 * @param {'de' | 'en'} [lang='de']
 * @returns {string}
 */
export function sanitizeForSpeech(text, lang = 'de') {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text;

  // Replace URLs with spoken indicator or remove
  cleaned = cleaned.replace(/https?:\/\/\S+/gi, lang === 'de' ? 'Weblink' : 'link');

  // Normalize timestamps before removing other symbols
  cleaned = normalizeTimestamps(cleaned, lang);

  // Markdown headers (# Header -> Header.)
  cleaned = cleaned.replace(/^#{1,6}\s*(.+)$/gm, '$1.');

  // Markdown bold & italics (**text**, *text*, __text__, _text_)
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
  cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');
  cleaned = cleaned.replace(/__([^_]+)__/g, '$1');
  cleaned = cleaned.replace(/_([^_]+)_/g, '$1');

  // Markdown blockquotes
  cleaned = cleaned.replace(/^\s*>\s*/gm, '');

  // Markdown lists / bullet points: convert into smooth paused lines
  cleaned = cleaned.replace(/^\s*[-*•]\s+/gm, ' ');
  cleaned = cleaned.replace(/^\s*(\d+)\.\s+/gm, '$1. ');

  // Code blocks and inline code (`code`)
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

  // Remove common visual emojis that sound weird in TTS (e.g. ✨, 🤖, 📌, 👉, 💡)
  cleaned = cleaned.replace(/[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, '');

  // Replace repeated punctuation and weird brackets
  cleaned = cleaned.replace(/[\[\]{}()]/g, ' ');
  cleaned = cleaned.replace(/\.{2,}/g, '.');
  cleaned = cleaned.replace(/!{2,}/g, '!');
  cleaned = cleaned.replace(/\?{2,}/g, '?');

  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Chunks a long text into manageable sentences or phrases for Chrome TTS.
 * Chrome TTS can fail or hang on strings longer than ~250 characters.
 * @param {string} text
 * @param {number} [maxChunkLength=180]
 * @returns {string[]} Array of non-empty text chunks
 */
export function chunkTextForTTS(text, maxChunkLength = 180) {
  if (!text || typeof text !== 'string') return [];
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (trimmed.length <= maxChunkLength) {
    return [trimmed];
  }

  // Split primarily by sentence terminators (. ! ? ; \n)
  const sentenceRegex = /([^.!?;\n]+[.!?;\n]+)/g;
  const rawSentences = trimmed.match(sentenceRegex) || [trimmed];
  const remaining = trimmed.replace(sentenceRegex, '').trim();
  if (remaining) {
    rawSentences.push(remaining);
  }

  const chunks = [];
  let currentChunk = '';

  for (let rawSentence of rawSentences) {
    let sentence = rawSentence.trim();
    if (!sentence) continue;

    // If a single sentence is longer than maxChunkLength, split by commas, semicolons, or words
    if (sentence.length > maxChunkLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }

      const clauses = sentence.split(/([,:]\s+)/);
      let subChunk = '';

      for (let clause of clauses) {
        if (!clause) continue;
        if ((subChunk + clause).length > maxChunkLength) {
          if (subChunk.trim()) {
            chunks.push(subChunk.trim());
          }
          // If a single clause is still too long, split by words
          if (clause.length > maxChunkLength) {
            const words = clause.split(/\s+/);
            let wordChunk = '';
            for (let word of words) {
              if ((wordChunk + ' ' + word).length > maxChunkLength) {
                if (wordChunk.trim()) chunks.push(wordChunk.trim());
                wordChunk = word;
              } else {
                wordChunk += (wordChunk ? ' ' : '') + word;
              }
            }
            subChunk = wordChunk;
          } else {
            subChunk = clause;
          }
        } else {
          subChunk += clause;
        }
      }

      if (subChunk.trim()) {
        chunks.push(subChunk.trim());
      }
    } else {
      if ((currentChunk + ' ' + sentence).length > maxChunkLength) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
