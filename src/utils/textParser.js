/**
 * Splits text into an array of words, filtering out empty strings.
 * @param {string} text 
 * @returns {string[]}
 */
export const parseTextToWords = (text) => {
    if (!text) return [];

    // Replace m-dashes with spaces (ignore them)
    // Replace hyphens with hyphen + space (split after hyphen)
    const processedText = text
        .replace(/—/g, ' ')
        .replace(/-/g, '- ');

    // Split by whitespace and filter out empty strings
    return processedText.trim().split(/\s+/).filter(word => word.length > 0);
};

/**
 * Calculates the index of the "Optimal Recognition Point" (ORP) or "Pivot" letter.
 * Standard RSVP algorithm for focus point.
 * @param {string} word 
 * @returns {number}
 */
export const getOrpIndex = (word) => {
    const length = word.length;
    if (length === 0) return 0;
    return Math.floor((length - 1) / 2);
};

// Pause ratios relative to base delay per word
const SENTENCE_END_RATIO = 2.5; // . ! ? ;
const COMMA_RATIO = 1.25;       // , : ( ) " "
const MID_SENTENCE_RATIO = 5;   // mid-word punctuation (e.g. "said.She")
const SPECIAL_CHAR_RATIO = 2;   // * % $ # @ /
const ELLIPSIS_RATIO = 4;       // ...
const PARAGRAPH_RATIO = 3;      // new paragraph start

/**
 * Returns extra pause in ms, scaled by WPM.
 * Mid-word punctuation (e.g. "said.She") gets a larger pause.
 * Special characters (? * % $ # @ ! /) trigger a pause.
 * @param {string} word
 * @param {number} wpm
 * @returns {number}
 */
export const getPauseForWord = (word, wpm) => {
    const baseDelay = (60 / wpm) * 1000;
    let ratio = 0;

    // Mid-word sentence-ending punctuation (period/excl/question followed by a letter)
    if (/[.;:!?][a-zA-Z]/.test(word)) {
        ratio += MID_SENTENCE_RATIO;
    }

    // Leading open-paren or open-quote
    if (word.startsWith('(') || word.startsWith('"')) {
        ratio += COMMA_RATIO;
    }

    // Trailing punctuation
    const trailingMatch = word.match(/[.;:!,)""']+$/);
    if (trailingMatch) {
        for (const char of trailingMatch[0]) {
            if (char === '.' || char === ';' || char === '!' || char === '?') {
                ratio += SENTENCE_END_RATIO;
            } else {
                ratio += COMMA_RATIO;
            }
        }
    }

    // Ellipsis (...)
    if (/\.\.\./.test(word)) {
        ratio += ELLIPSIS_RATIO;
    }

    // Special characters: * % $ # @ /
    const specialChars = word.match(/[*%$#@!/]/g);
    if (specialChars) {
        ratio += SPECIAL_CHAR_RATIO;
    }

    return ratio * baseDelay;
};

/**
 * Calculates total reading time in seconds for a list of words at a given WPM.
 * Accounts for punctuation pauses and line change delays.
 * @param {string[]} words
 * @param {number} wpm
 * @param {Set<number>} [lineStarts] - word indices that start a new visual line
 * @returns {number} seconds
 */
export const calculateReadingTime = (words, wpm, lineStarts) => {
    if (!words.length || wpm <= 0) return 0;
    const baseDelayPerWord = (60 / wpm) * 1000;
    const lineChangeRatio = 5;
    const totalMs = words.reduce((sum, word, i) => {
        let wordDelay = baseDelayPerWord + getPauseForWord(word, wpm);
        if (lineStarts && lineStarts.has(i)) {
            wordDelay += baseDelayPerWord * lineChangeRatio;
        }
        return sum + wordDelay;
    }, 0);
    return totalMs / 1000;
};

/**
 * Formats seconds into human-readable reading time.
 * <60s: "XXmin", <3600s: "M:SSmin", >=3600s: "H:MM:SSh"
 * @param {number} seconds
 * @returns {string}
 */
export const formatTime = (seconds) => {
    const s = Math.max(0, Math.round(seconds));
    if (s < 60) return `${String(s).padStart(2, '0')}sec`;
    if (s < 3600) {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${String(sec).padStart(2, '0')}min`;
    }
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}h`;
};

/**
 * Returns a Set of word indices that start a new paragraph.
 * Paragraphs are split by double newlines, matching VisualPacerDisplay layout.
 * Uses same hyphen handling as parseTextToWords to keep indices aligned.
 * @param {string} text
 * @param {string[]} words
 * @returns {Set<number>}
 */
export const getNewParagraphIndices = (text, words) => {
    const indices = new Set();
    if (!text || !words.length) return indices;

    const paragraphs = text.split(/\n\n+/);
    let wordIdx = 0;

    for (const para of paragraphs) {
        if (wordIdx < words.length) {
            indices.add(wordIdx);
        }
        const processedPara = para.replace(/—/g, ' ').replace(/-/g, '- ');
        const paraWords = processedPara.trim().split(/\s+/).filter(w => w.length > 0);
        wordIdx += paraWords.length;
    }

    return indices;
};

/**
 * Returns a Set of word indices that start a new line (single newline).
 * @param {string} text
 * @param {string[]} words
 * @returns {Set<number>}
 */
export const getNewLineIndices = (text, words) => {
    const indices = new Set();
    if (!text || !words.length) return indices;

    const lines = text.split(/\n/);
    let wordIdx = 0;

    for (const line of lines) {
        if (wordIdx < words.length) {
            indices.add(wordIdx);
        }
        const processedLine = line.replace(/—/g, ' ').replace(/-/g, '- ');
        const lineWords = processedLine.trim().split(/\s+/).filter(w => w.length > 0);
        wordIdx += lineWords.length;
    }

    return indices;
};

/**
 * Splits a word into three parts: pre-ORP, ORP, and post-ORP.
 * @param {string} word 
 * @returns {{pre: string, orp: string, post: string}}
 */
export const splitWordAtOrp = (word) => {
    const orpIndex = getOrpIndex(word);
    return {
        pre: word.substring(0, orpIndex),
        orp: word[orpIndex] || '',
        post: word.substring(orpIndex + 1)
    };
};
