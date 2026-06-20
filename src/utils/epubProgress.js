const STORAGE_KEY = 'blast-epub-progress';

function getProgressMap() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
        return {};
    }
}

function persist(map) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function getBookKey(file, epubData) {
    const title = (epubData.title || '').toLowerCase().trim();
    const author = (epubData.author || '').toLowerCase().trim();
    const name = (file.name || '').toLowerCase().trim();
    const raw = `${title}::${author}::${name}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
        hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
    }
    return `epub_${Math.abs(hash).toString(36)}`;
}

export function saveProgress(bookKey, { wordIndex, totalWords, title, selectedChapters, selectedChapterNames }) {
    const map = getProgressMap();
    map[bookKey] = { wordIndex, totalWords, title, selectedChapters, selectedChapterNames, savedAt: Date.now() };
    persist(map);
}

export function getProgress(bookKey) {
    const map = getProgressMap();
    return map[bookKey] || null;
}

export function clearProgress(bookKey) {
    const map = getProgressMap();
    delete map[bookKey];
    persist(map);
}
