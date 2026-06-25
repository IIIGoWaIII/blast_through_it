import type { CSSProperties } from 'react';

export interface EpubChapter {
  index: number;
  label: string;
  hrefs: string[];
  wordCount: number;
}

export interface EpubData {
  title: string;
  author: string;
  chapters: EpubChapter[];
}

export interface EpubImage {
  src: string;
  align: string;
  maxWidth: string | null;
  fullWidth: boolean;
  inline?: boolean;
}

export interface EpubContentResult {
  text: string;
  images: EpubImage[];
  blockFormatting: CSSProperties[];
  visualBlocks: VisualBlock[];
  blockStyleRanges: BlockStyleRange[];
  wordStyles: CSSProperties[];
  fontFaceCSS: string;
}

export interface VisualBlock {
  text: string;
  start: number;
  end: number;
  style: CSSProperties;
}

export interface BlockStyleRange {
  start: number;
  end: number;
  style: CSSProperties;
}

export interface WordBounds {
  [wordIndex: number]: { left: number; width: number };
}

export interface LineHighlight {
  left: number;
  top: number;
  width: number;
  height: number;
  startIndex: number;
  endIndex: number;
  wordBounds: WordBounds;
}

export interface VisualWord {
  text: string;
  globalIndex: number;
}

export interface VisualLine {
  startIndex: number;
  endIndex: number;
  words: VisualWord[];
  paraIdx: number;
  isBlank?: boolean;
  lineIdx?: number;
  blockStyle?: CSSProperties;
}

export interface SavedSettings {
  wpm?: number;
  readingMode?: 'rsvp' | 'visualPacer';
  pacerStyle?: 'line' | 'word';
}

export interface EpubProgressData {
  wordIndex: number;
  totalWords: number;
  title: string;
  selectedChapters: number[];
  selectedChapterNames: string[];
  savedAt: number;
}

export interface SelectorPart {
  tag: string | null;
  id: string | null;
  classes: string[];
}

export interface CssRule {
  selector: string;
  parts: SelectorPart[];
  classes: string[];
  tagNames: (string | null)[];
  specificity: number;
  order: number;
  props: Record<string, string>;
}

export interface ElementContext {
  tagName: string | null;
  id: string;
  classes: string[];
  inlineStyle: string;
}

export interface ImageLayout {
  align: string;
  maxWidth: string | null;
  fullWidth: boolean;
  inline?: boolean;
}

export interface ParsedCss {
  rules: CssRule[];
  fontFaces: Record<string, string>[];
}

export interface WordSplit {
  pre: string;
  orp: string;
  post: string;
}

export interface SearchResult {
  wordIndex: number;
  context: string;
}
