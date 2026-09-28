import type { WordSplit, EpubImage } from '../types';

export const parseTextToWords = (text: string): string[] => {
    if (!text) return [];

    const processedText = text
        .replace(/—/g, ' ')
        .replace(/-/g, '- ');

    return processedText.trim().split(/\s+/).filter(word => word.length > 0);
};

export const getOrpIndex = (word: string): number => {
    const length = word.length;
    if (length === 0) return 0;
    return Math.floor((length - 1) / 2);
};

const SENTENCE_END_RATIO = 2.5;
const COMMA_RATIO = 1.25;
const MID_SENTENCE_RATIO = 5;
const SPECIAL_CHAR_RATIO = 2;
const ELLIPSIS_RATIO = 4;

export const LINE_CHANGE_RATIO = 5;
export const PARAGRAPH_RATIO = 3;
export const IMAGE_PAUSE_RATIO = 9;

export const getPauseForWord = (word: string, wpm: number): number => {
    const baseDelay = (60 / wpm) * 1000;
    let ratio = 0;

    if (/[.;:!?][a-zA-Z]/.test(word)) {
        ratio += MID_SENTENCE_RATIO;
    }

    if (word.startsWith('(') || word.startsWith('"')) {
        ratio += COMMA_RATIO;
    }

    const hasEllipsis = /\.\.\./.test(word);
    if (hasEllipsis) {
        ratio += ELLIPSIS_RATIO;
    }

    const trailingMatch = word.match(/[.;:!?!,)""']+$/);
    if (trailingMatch) {
        for (const char of trailingMatch[0]) {
            if (char === '.' && hasEllipsis) {
                continue;
            } else if (char === '.' || char === ';' || char === '!' || char === '?') {
                ratio += SENTENCE_END_RATIO;
            } else {
                ratio += COMMA_RATIO;
            }
        }
    }

    const specialChars = word.match(/[*%$#@!/]/g);
    if (specialChars) {
        ratio += SPECIAL_CHAR_RATIO;
    }

    return ratio * baseDelay;
};

export const getImagePauseMultiplier = (word: string, images?: EpubImage[] | null): number => {
    if (!word.startsWith('¶IMG:')) return 0;
    const match = word.match(/¶IMG:(\d+)¶/);
    const imgIdx = match ? parseInt(match[1], 10) : -1;
    const imgData = images?.[imgIdx];
    const layout: EpubImage = typeof imgData === 'object' ? imgData : { src: '', align: '', maxWidth: null, fullWidth: false };
    // Centered block images are decorative separators — no extra pause
    return layout.align === 'center' && !layout.inline ? 0 : IMAGE_PAUSE_RATIO;
};

export const calculateReadingTime = (
    words: string[],
    wpm: number,
    lineStarts?: Set<number>,
    wordsPerLine?: number,
    paragraphStarts?: Set<number>,
    images?: EpubImage[] | null
): number => {
    if (!words.length || wpm <= 0) return 0;
    const baseDelayPerWord = (60 / wpm) * 1000;

    const visualLineStarts = new Set<number>();
    if (lineStarts && wordsPerLine && wordsPerLine > 0) {
        const sortedStarts = [...lineStarts].sort((a, b) => a - b);
        for (const start of sortedStarts) {
            const nextStart = sortedStarts.find(s => s > start) ?? words.length;
            const sourceLineWordCount = nextStart - start;
            const wraps = Math.ceil(sourceLineWordCount / wordsPerLine);
            for (let w = 0; w < wraps; w++) {
                const idx = start + w * wordsPerLine;
                if (idx < words.length) {
                    visualLineStarts.add(idx);
                }
            }
        }
    } else if (lineStarts) {
        for (const idx of lineStarts) {
            visualLineStarts.add(idx);
        }
    }

    const totalMs = words.reduce((sum: number, word: string, i: number) => {
        let wordDelay = baseDelayPerWord + getPauseForWord(word, wpm);
        wordDelay += getImagePauseMultiplier(word, images) * baseDelayPerWord;
        if (visualLineStarts.has(i) && i !== 0) {
            wordDelay += baseDelayPerWord * LINE_CHANGE_RATIO;
        }
        if (paragraphStarts?.has(i)) {
            wordDelay += baseDelayPerWord * PARAGRAPH_RATIO;
        }
        return sum + wordDelay;
    }, 0);
    return totalMs / 1000;
};

export const formatTime = (seconds: number): string => {
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

export const getNewParagraphIndices = (text: string, words: string[]): Set<number> => {
    const indices = new Set<number>();
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

export const getNewLineIndices = (text: string, words: string[]): Set<number> => {
    const indices = new Set<number>();
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

export const splitWordAtOrp = (word: string): WordSplit => {
    const orpIndex = getOrpIndex(word);
    return {
        pre: word.substring(0, orpIndex),
        orp: word[orpIndex] || '',
        post: word.substring(orpIndex + 1)
    };
};
