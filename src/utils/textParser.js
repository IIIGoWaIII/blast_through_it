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

/**
 * Returns extra pause in ms for trailing punctuation.
 * . ; ! ? = 500ms each, , : = 250ms each. Multiple stack.
 * @param {string} word
 * @returns {number}
 */
export const getPauseForWord = (word) => {
    let pause = 0;

    if (word.startsWith('(')) pause += 250;

    const match = word.match(/[.;:!,)]+$/);
    if (match) {
        for (const char of match[0]) {
            if (char === '.' || char === ';' || char === '!' || char === '?') {
                pause += 500;
            } else {
                pause += 250;
            }
        }
    }
    return pause;
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
