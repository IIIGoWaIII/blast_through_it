import React, { useRef, useEffect, useMemo } from 'react';

const VisualPacerDisplay = ({ text, currentIndex, pacerStyle }) => {
    const containerRef = useRef(null);

    // Parse text into structured lines with word index tracking
    const lines = useMemo(() => {
        if (!text) return [];
        const paragraphs = text.split(/\n\n+/);
        const result = [];
        let wordIdx = 0;

        for (const para of paragraphs) {
            const paraLines = para.split(/\n/);
            for (const line of paraLines) {
                const lineWords = line.trim().split(/\s+/).filter(w => w.length > 0);
                const lineData = {
                    words: lineWords.map((w) => ({ text: w, globalIndex: wordIdx++ })),
                };
                result.push(lineData);
            }
            // Add a blank line between paragraphs
            result.push({ words: [], isBlank: true });
        }
        return result;
    }, [text]);

    // Find which line contains the current word
    const currentLineIndex = useMemo(() => {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.isBlank) continue;
            for (const w of line.words) {
                if (w.globalIndex === currentIndex) return i;
            }
        }
        return 0;
    }, [lines, currentIndex]);

    // Auto-scroll to keep current line centered
    useEffect(() => {
        if (!containerRef.current) return;
        const container = containerRef.current;
        const lineEls = container.querySelectorAll('[data-line-index]');
        const currentEl = lineEls[currentLineIndex];
        if (!currentEl) return;

        const containerRect = container.getBoundingClientRect();
        const elRect = currentEl.getBoundingClientRect();
        const offset = elRect.top - containerRect.top - (containerRect.height / 2) + (elRect.height / 2);

        container.scrollTo({
            top: container.scrollTop + offset,
            behavior: 'smooth',
        });
    }, [currentLineIndex]);

    if (!text) {
        return (
            <div className="h-64 flex items-center justify-center text-zinc-500 italic">
                Paste text or import a file to begin
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className="w-full max-w-[95vw] md:max-w-[75vw] h-[40vh] md:h-[60vh] overflow-y-auto scroll-smooth rounded-xl p-4 sm:p-6 md:p-10 pacer-scroll"
        >
            <div className="font-serif text-lg md:text-xl leading-relaxed tracking-wide space-y-1">
                {lines.map((line, lineIdx) => {
                    if (line.isBlank) {
                        return <div key={`blank-${lineIdx}`} className="h-6" />;
                    }

                    const isCurrentLine = lineIdx === currentLineIndex;

                    return (
                        <div
                            key={`line-${lineIdx}`}
                            data-line-index={lineIdx}
                            className={`relative px-2 py-1 rounded transition-all duration-150 ${
                                isCurrentLine && pacerStyle === 'line'
                                    ? 'bg-red-500/15'
                                    : ''
                            }`}
                        >
                            {/* Line highlight bar */}
                            {isCurrentLine && pacerStyle === 'line' && (
                                <div className="absolute inset-y-0 left-0 w-1 bg-red-500 rounded-r" />
                            )}

                            <span>
                                {line.words.map((word) => {
                                    const isCurrentWord = word.globalIndex === currentIndex;

                                    if (pacerStyle === 'word' && isCurrentWord) {
                                        return (
                                            <span
                                                key={word.globalIndex}
                                                className="pacer-word-highlight px-0.5 rounded"
                                            >
                                                {word.text}{' '}
                                            </span>
                                        );
                                    }

                                    if (pacerStyle === 'word' && word.globalIndex < currentIndex) {
                                        return (
                                            <span key={word.globalIndex} className="text-zinc-500">
                                                {word.text}{' '}
                                            </span>
                                        );
                                    }

                                    return (
                                        <span key={word.globalIndex} className="text-zinc-300">
                                            {word.text}{' '}
                                        </span>
                                    );
                                })}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default VisualPacerDisplay;
