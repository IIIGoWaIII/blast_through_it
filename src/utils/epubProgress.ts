import type { EpubProgressData } from '../types';

const STORAGE_KEY = 'blast-epub-progress';

interface ProgressMap {
    [bookKey: string]: EpubProgressData;
}

function getProgressMap(): ProgressMap {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
    } catch {
        return {};
    }
}

function persist(map: ProgressMap): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function getBookKey(file: File, epubData: { title?: string; author?: string }): string {
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

export function saveProgress(bookKey: string, data: Omit<EpubProgressData, 'savedAt'>): void {
    const map = getProgressMap();
    map[bookKey] = { ...data, savedAt: Date.now() };
    persist(map);
}

export function getProgress(bookKey: string): EpubProgressData | null {
    const map = getProgressMap();
    return map[bookKey] || null;
}

export function clearProgress(bookKey: string): void {
    const map = getProgressMap();
    delete map[bookKey];
    persist(map);
}
