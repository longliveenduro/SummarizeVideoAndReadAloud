import { describe, it, expect } from 'vitest';
import {
  detectLanguage,
  removeTimestamps,
  optimizePronunciation,
  normalizeTimestamps,
  sanitizeForSpeech,
  chunkTextForTTS
} from '../src/tts/text-sanitizer.js';

describe('Text Sanitizer & Processor', () => {
  describe('detectLanguage', () => {
    it('detects German texts accurately', () => {
      const deText = 'In diesem Video geht es um künstliche Intelligenz und maschinelles Lernen.';
      expect(detectLanguage(deText)).toBe('de');
    });

    it('detects English texts accurately', () => {
      const enText = 'In this video we are talking about machine learning and artificial intelligence.';
      expect(detectLanguage(enText)).toBe('en');
    });

    it('detects German with umlauts', () => {
      const umlautText = 'Schöne Grüße aus München!';
      expect(detectLanguage(umlautText)).toBe('de');
    });
  });

  describe('removeTimestamps', () => {
    it('removes timestamps in parentheses and ranges', () => {
      const input = 'Sie neigen dazu, Aufgaben zu sabotieren, wenn sie Zielen entgegenstehen (0:47-2:33).';
      const output = removeTimestamps(input);
      expect(output).toBe('Sie neigen dazu, Aufgaben zu sabotieren, wenn sie Zielen entgegenstehen.');
      expect(output).not.toContain('0:47');
      expect(output).not.toContain('2:33');
    });

    it('removes multiple single timestamps cleanly without orphan commas', () => {
      const input = 'Widerstand gegen Abschaltungen (3:14), Versuche, andere KIs zu schützen (3:26), und Fairness (4:16).';
      const output = removeTimestamps(input);
      expect(output).toBe('Widerstand gegen Abschaltungen, Versuche, andere KIs zu schützen, und Fairness.');
    });
  });

  describe('optimizePronunciation', () => {
    it('optimizes KI and tech acronyms so German TTS spells them out as K-I', () => {
      const input = 'Moderne KI-Modelle wie GPT oder Claude und autonome KIs nutzen APIs.';
      const output = optimizePronunciation(input, 'de');
      expect(output).toContain('K-I-Modelle');
      expect(output).toContain('K-Is');
      expect(output).toContain('G-P-T');
      expect(output).toContain('A-P-I');
    });

    it('expands common abbreviations into natural spoken words', () => {
      const input = 'Ergebnisse z.B. von Anthropic bzw. OpenAI u.a. d.h. etc.';
      const output = optimizePronunciation(input, 'de');
      expect(output).toContain('zum Beispiel');
      expect(output).toContain('beziehungsweise');
      expect(output).toContain('unter anderem');
      expect(output).toContain('das heißt');
      expect(output).toContain('et cetera');
    });
  });

  describe('normalizeTimestamps', () => {
    it('converts mm:ss timestamps to spoken German', () => {
      const input = 'Das Thema beginnt bei 02:45 und endet bei 10:15.';
      const output = normalizeTimestamps(input, 'de');
      expect(output).toContain('2 Minuten und 45 Sekunden');
      expect(output).toContain('10 Minuten und 15 Sekunden');
    });

    it('converts hh:mm:ss timestamps to spoken English', () => {
      const input = 'Check chapter at 01:23:45.';
      const output = normalizeTimestamps(input, 'en');
      expect(output).toContain('1 hours, 23 minutes and 45 seconds');
    });
  });

  describe('sanitizeForSpeech', () => {
    it('removes markdown formatting and symbols', () => {
      const input = '### Übersicht\n**Wichtiger Punkt:** Dies ist ein _Test_ mit `code`.';
      const output = sanitizeForSpeech(input, 'de');
      expect(output).not.toContain('###');
      expect(output).not.toContain('**');
      expect(output).not.toContain('`');
      expect(output).toContain('Übersicht');
      expect(output).toContain('Wichtiger Punkt: Dies ist ein Test mit code');
    });

    it('expands URLs and removes emojis', () => {
      const input = '✨ Besuche https://example.com für mehr Details! 🚀';
      const output = sanitizeForSpeech(input, 'de');
      expect(output).not.toContain('✨');
      expect(output).not.toContain('🚀');
      expect(output).toContain('Weblink für mehr Details');
    });

    it('cleans bullet lists into continuous speech', () => {
      const input = `Zusammenfassung:
- Erstens: Einleitung
- Zweitens: Hauptteil
- Drittens: Fazit`;
      const output = sanitizeForSpeech(input, 'de');
      expect(output).toContain('Erstens: Einleitung Zweitens: Hauptteil Drittens: Fazit');
    });

    it('strips timestamps and tunes KI pronunciation from video summary sentence', () => {
      const input = 'Zielen übereinstimmen. Anhand verschiedener Forschungsergebnisse wird gezeigt, dass moderne KI-Modelle wie Gemini, GPT oder Claude dazu neigen, Aufgaben zu sabotieren, wenn sie ihren eigenen, internen Zielen entgegenstehen (0:47-2:33).';
      const output = sanitizeForSpeech(input, 'de');
      expect(output).toContain('K-I-Modelle');
      expect(output).toContain('G-P-T');
      expect(output).toContain('entgegenstehen.');
      expect(output).not.toContain('0:47');
      expect(output).not.toContain('2:33');
    });
  });

  describe('chunkTextForTTS', () => {
    it('returns single chunk for short texts', () => {
      const text = 'Dies ist ein kurzer Satz.';
      const chunks = chunkTextForTTS(text, 100);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(text);
    });

    it('splits long text into multiple sentences under max chunk length', () => {
      const text = 'Satz eins ist etwas länger und erklärt ein Konzept. Satz zwei baut darauf auf und führt das Thema weiter aus. Satz drei schließt die Erklärung ab.';
      const chunks = chunkTextForTTS(text, 80);
      expect(chunks.length).toBeGreaterThan(1);
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(80);
      }
    });

    it('splits long clauses or sentences without terminators', () => {
      const longSentence = 'Dies ist ein außergewöhnlich langer Satz ohne Satzpunkt der aber durch Kommas gegliedert ist, damit er aufgeteilt werden kann, und die Sprachausgabe nicht abbricht.';
      const chunks = chunkTextForTTS(longSentence, 70);
      expect(chunks.length).toBeGreaterThan(1);
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(70);
      }
    });
  });
});

