import React, { useRef, useEffect, useMemo } from 'react';

function smoothScrollTo(el, target, animationRef, duration = 250) {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    const start = el.scrollTop;
    const change = target - start;
    if (Math.abs(change) < 1) return;

    const startTime = performance.now();
    function step(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.scrollTop = start + change * eased;
        if (progress < 1) {
            animationRef.current = requestAnimationFrame(step);
        } else {
            animationRef.current = null;
        }
    }
    animationRef.current = requestAnimationFrame(step);
}

const VisualPacerDisplay = ({ text, currentIndex, pacerStyle }) => {
    const containerRef = useRef(null);
    const scrollAnimationRef = useRef(null);

    useEffect(() => {
        return () => {
            if (scrollAnimationRef.current) cancelAnimationFrame(scrollAnimationRef.current);
        };
    }, []);

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

    // Auto-scroll once the active word would move below the top quarter.
    useEffect(() => {
        if (!containerRef.current) return;
        const container = containerRef.current;
        const currentEl = container.querySelector(`[data-word-index="${currentIndex}"]`)
            ?? container.querySelector(`[data-line-index="${currentLineIndex}"]`);

        if (!currentEl) return;

        const containerRect = container.getBoundingClientRect();
        const elRect = currentEl.getBoundingClientRect();
        const thresholdTop = container.clientHeight * 0.25;
        const currentTop = elRect.top - containerRect.top;

        if (currentTop <= thresholdTop && currentTop >= 0) return;

        const maxScroll = container.scrollHeight - container.clientHeight;
        const targetScrollTop = container.scrollTop + currentTop - thresholdTop;
        const clamped = Math.max(0, Math.min(targetScrollTop, maxScroll));

        smoothScrollTo(container, clamped, scrollAnimationRef);
    }, [currentIndex, currentLineIndex]);

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
            className="w-full max-w-[95vw] md:max-w-[75vw] h-[40vh] md:h-[60vh] overflow-y-auto rounded-xl p-4 sm:p-6 md:p-10 pacer-scroll"
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
                            className={`relative px-2 py-1 rounded transition-colors duration-150 ${
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

                                    const wordBaseClass = pacerStyle === 'word'
                                        ? 'pacer-word px-0.5 rounded'
                                        : '';

                                    if (pacerStyle === 'word' && isCurrentWord) {
                                        return (
                                            <span
                                                key={word.globalIndex}
                                                data-word-index={word.globalIndex}
                                                className={`${wordBaseClass} pacer-word-highlight`}
                                            >
                                                {word.text}{' '}
                                            </span>
                                        );
                                    }

                                    if (pacerStyle === 'word' && word.globalIndex < currentIndex) {
                                        return (
                                            <span
                                                key={word.globalIndex}
                                                data-word-index={word.globalIndex}
                                                className={`${wordBaseClass} text-zinc-500`}
                                            >
                                                {word.text}{' '}
                                            </span>
                                        );
                                    }

                                    return (
                                        <span
                                            key={word.globalIndex}
                                            data-word-index={word.globalIndex}
                                            className={`${wordBaseClass} text-zinc-300`}
                                        >
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
