import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react';
import type { SearchResult } from '../types';

interface SearchPanelProps {
  isOpen: boolean;
  text: string;
  words: string[];
  onJumpToWord: (wordNumber: number) => void;
  onClose: () => void;
}

const CONTEXT_CHARS = 60;

function buildCharToWordMap(text: string, words: string[]): number[] {
  const map: number[] = [];
  let wordIdx = 0;

  for (let i = 0; i < words.length && wordIdx < words.length; i++) {
    const word = words[wordIdx];
    const searchFrom = map.length > 0 ? map[map.length - 1] + 1 : 0;
    let foundAt = text.indexOf(word, searchFrom);
    if (foundAt === -1) foundAt = searchFrom;

    for (let c = foundAt; c < foundAt + word.length && c < text.length; c++) {
      map[c] = wordIdx;
    }
    if (map.length < foundAt) {
      for (let c = map.length; c < foundAt; c++) {
        map[c] = wordIdx;
      }
    }
    wordIdx++;
  }

  const lastWord = wordIdx > 0 ? wordIdx - 1 : 0;
  while (map.length < text.length) {
    map.push(lastWord);
  }

  return map;
}

function buildContext(text: string, matchStart: number, matchEnd: number): string {
  const ctxStart = Math.max(0, matchStart - CONTEXT_CHARS);
  const ctxEnd = Math.min(text.length, matchEnd + CONTEXT_CHARS);
  const before = text.slice(ctxStart, matchStart);
  const match = text.slice(matchStart, matchEnd);
  const after = text.slice(matchEnd, ctxEnd);
  const prefix = ctxStart > 0 ? '...' : '';
  const suffix = ctxEnd < text.length ? '...' : '';
  return `${prefix}${before}${match}${after}${suffix}`;
}

const SearchPanel: React.FC<SearchPanelProps> = ({ isOpen, text, words, onJumpToWord, onClose }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Reset state when panel opens (adjusting state during render — safe per React docs)
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Build char-to-word index map
  const charToWord = useMemo(() => buildCharToWordMap(text, words), [text, words]);

  // Search results — searches the raw text for phrase matches
  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q || !text) return [];

    const processed = text
      .replace(/—/g, ' ')
      .replace(/-/g, '- ');

    const lowerText = processed.toLowerCase();
    const matches: SearchResult[] = [];
    let searchFrom = 0;

    while (searchFrom < lowerText.length) {
      const idx = lowerText.indexOf(q, searchFrom);
      if (idx === -1) break;

      const matchEnd = idx + q.length;
      const wordIndex = charToWord[idx] ?? 0;
      const context = buildContext(text, idx, matchEnd);
      matches.push({ wordIndex, context });

      searchFrom = idx + 1;
    }

    return matches;
  }, [query, text, charToWord]);

  // Clamp for display
  const displayIndex = results.length > 0 ? Math.min(selectedIndex, results.length - 1) : 0;

  // Scroll selected result into view
  useEffect(() => {
    const container = resultsRef.current;
    if (!container) return;
    const el = container.querySelector('[data-selected="true"]');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [displayIndex]);

  const jumpToResult = useCallback((result: SearchResult) => {
    onJumpToWord(result.wordIndex + 1);
    onClose();
  }, [onJumpToWord, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, Math.max(0, results.length - 1)));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    }
    if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      const idx = Math.min(selectedIndex, results.length - 1);
      jumpToResult(results[idx]);
    }
  }, [results, selectedIndex, onClose, jumpToResult]);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    setSelectedIndex(0);
  }, []);

  const highlightMatch = useCallback((ctx: string, q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return ctx;
    const lower = ctx.toLowerCase();
    const idx = lower.indexOf(trimmed.toLowerCase());
    if (idx === -1) return ctx;
    return (
      <>
        {ctx.slice(0, idx)}
        <span className="search-match">{ctx.slice(idx, idx + trimmed.length)}</span>
        {ctx.slice(idx + trimmed.length)}
      </>
    );
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onKeyDown={handleKeyDown}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative glass-desktop rounded-2xl w-[90vw] max-w-lg shadow-2xl shadow-black/40 animate-in fade-in zoom-in-95 duration-200">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <Search size={18} className="text-zinc-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search in text..."
            className="flex-1 bg-transparent text-zinc-100 text-sm placeholder-zinc-500 focus:outline-none"
          />
          {results.length > 0 && (
            <span className="text-xs text-zinc-500 tabular-nums shrink-0">
              {displayIndex + 1} of {results.length}
            </span>
          )}
          <button
            onClick={onClose}
            className="p-1 text-zinc-500 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div ref={resultsRef} className="max-h-[40vh] overflow-y-auto overscroll-contain">
          {query.trim() && results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              No matches found
            </div>
          )}
          {results.map((result, i) => (
            <button
              key={`${result.wordIndex}-${i}`}
              data-selected={i === displayIndex}
              onClick={() => jumpToResult(result)}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-start gap-3 ${
                i === displayIndex
                  ? 'bg-white/10 text-white'
                  : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
              }`}
            >
              <span className="text-[10px] text-zinc-600 font-mono mt-0.5 shrink-0 w-10 text-right">
                #{result.wordIndex + 1}
              </span>
              <span className="leading-relaxed">
                {highlightMatch(result.context, query)}
              </span>
            </button>
          ))}
        </div>

        {/* Footer hint */}
        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between text-[10px] text-zinc-600">
            <span className="flex items-center gap-1.5">
              <ChevronUp size={10} />
              <ChevronDown size={10} />
              <span>navigate</span>
            </span>
            <span>enter select</span>
            <span>esc close</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPanel;
