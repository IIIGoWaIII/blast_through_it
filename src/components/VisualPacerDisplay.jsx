import React, { useRef, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { parseTextToWords } from '../utils/textParser';

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

function cancelScrollAnimation(animationRef) {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
}

function getFirstRect(el) {
    return el.getClientRects()[0] ?? el.getBoundingClientRect();
}

const VisualPacerDisplay = ({ text, currentIndex, pacerStyle, isPlaying, wordProgress }) => {
    const containerRef = useRef(null);
    const scrollAnimationRef = useRef(null);
    const [lineHighlight, setLineHighlight] = useState(null);

    useEffect(() => {
        return () => cancelScrollAnimation(scrollAnimationRef);
    }, []);

    // Parse text into structured source rows with word index tracking.
    // Visual line mode measures rendered rows below, so wrapped text follows the device width.
    const lines = useMemo(() => {
        if (!text) return [];
        const paragraphs = text.split(/\n\n+/);
        const result = [];
        let wordIdx = 0;

        for (const para of paragraphs) {
            const paraLines = para.split(/\n/);
            for (const line of paraLines) {
                const lineWords = parseTextToWords(line);
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

    useLayoutEffect(() => {
        if (pacerStyle !== 'line' || !containerRef.current) {
            setLineHighlight(null);
            return undefined;
        }

        let frameId = null;

        const measureCurrentVisualLine = () => {
            const container = containerRef.current;
            const currentEl = container?.querySelector(`[data-word-index="${currentIndex}"]`);

            if (!container || !currentEl) {
                setLineHighlight(null);
                return;
            }

            const containerRect = container.getBoundingClientRect();
            const elRect = getFirstRect(currentEl);
            const currentCenter = elRect.top + (elRect.height / 2);
            const sameLineWordEls = Array.from(container.querySelectorAll('[data-word-index]'))
                .filter((wordEl) => {
                    const rect = getFirstRect(wordEl);
                    return currentCenter >= rect.top && currentCenter <= rect.bottom;
                });
            const sameLineWords = sameLineWordEls
                .map((wordEl) => Number(wordEl.dataset.wordIndex))
                .filter(Number.isFinite);
            const sameLineRects = sameLineWordEls.map(getFirstRect);
            const left = Math.min(...sameLineRects.map((rect) => rect.left));
            const right = Math.max(...sameLineRects.map((rect) => rect.right));
            const wordBounds = sameLineWordEls.reduce((bounds, wordEl) => {
                const rect = getFirstRect(wordEl);
                bounds[Number(wordEl.dataset.wordIndex)] = {
                    left: rect.left - left,
                    width: rect.width,
                };
                return bounds;
            }, {});
            const nextHighlight = {
                left: left - containerRect.left + container.scrollLeft - 4,
                top: elRect.top - containerRect.top + container.scrollTop - 4,
                width: right - left + 8,
                height: elRect.height + 8,
                startIndex: Math.min(...sameLineWords),
                endIndex: Math.max(...sameLineWords),
                wordBounds,
            };

            setLineHighlight((prev) => {
                if (
                    prev
                    && Math.abs(prev.left - nextHighlight.left) < 0.5
                    && Math.abs(prev.top - nextHighlight.top) < 0.5
                    && Math.abs(prev.width - nextHighlight.width) < 0.5
                    && Math.abs(prev.height - nextHighlight.height) < 0.5
                    && prev.startIndex === nextHighlight.startIndex
                    && prev.endIndex === nextHighlight.endIndex
                ) {
                    return { ...prev, wordBounds: nextHighlight.wordBounds };
                }
                return nextHighlight;
            });
        };

        const scheduleMeasure = () => {
            if (frameId) cancelAnimationFrame(frameId);
            frameId = requestAnimationFrame(measureCurrentVisualLine);
        };

        scheduleMeasure();

        const container = containerRef.current;
        let observer = null;
        if (typeof ResizeObserver !== 'undefined') {
            observer = new ResizeObserver(scheduleMeasure);
            observer.observe(container);
        } else {
            window.addEventListener('resize', scheduleMeasure);
        }

        return () => {
            if (frameId) cancelAnimationFrame(frameId);
            if (observer) observer.disconnect();
            else window.removeEventListener('resize', scheduleMeasure);
        };
    }, [currentIndex, pacerStyle, text]);

    // Auto-scroll once the active word would move below the top quarter.
    useEffect(() => {
        if (!containerRef.current) return;
        const container = containerRef.current;
        const currentEl = container.querySelector(`[data-word-index="${currentIndex}"]`);

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
    }, [currentIndex]);

    const lineProgress = useMemo(() => {
        if (!lineHighlight) return 0;
        if (currentIndex < lineHighlight.startIndex) return 0;
        if (currentIndex > lineHighlight.endIndex) return 1;

        const currentBounds = lineHighlight.wordBounds[currentIndex];
        if (!currentBounds) return 0;

        const textWidth = Math.max(lineHighlight.width - 8, 1);
        const progressPx = currentBounds.left + (currentBounds.width * wordProgress);
        return Math.min(Math.max(progressPx / textWidth, 0), 1);
    }, [currentIndex, lineHighlight, wordProgress]);

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
            className="relative w-full max-w-[95vw] md:max-w-[75vw] h-[40vh] md:h-[60vh] overflow-y-auto rounded-xl p-4 sm:p-6 md:p-10 pacer-scroll"
        >
            {lineHighlight && (
                <div
                    className="absolute bg-red-500/15 rounded pointer-events-none transition-[left,top,width,height] duration-150"
                    style={{
                        left: `${lineHighlight.left}px`,
                        top: `${lineHighlight.top}px`,
                        width: `${lineHighlight.width}px`,
                        height: `${lineHighlight.height}px`,
                    }}
                    aria-hidden="true"
                >
                    <div className="absolute inset-y-0 left-0 w-1 bg-red-500 rounded-r" />
                    <div
                        className="absolute bottom-0 left-0 h-[2px] bg-red-500 rounded-full"
                        style={{ width: `${lineProgress * 100}%` }}
                    />
                </div>
            )}
            <div className="relative font-serif text-lg md:text-xl leading-relaxed tracking-wide space-y-1">
                {lines.map((line, lineIdx) => {
                    if (line.isBlank) {
                        return <div key={`blank-${lineIdx}`} className="h-6" />;
                    }

                    return (
                        <div
                            key={`line-${lineIdx}`}
                            data-line-index={lineIdx}
                            className="relative px-2 py-1 rounded transition-colors duration-150"
                        >
                            <span>
                                {line.words.map((word) => {
                                    const isCurrentWord = word.globalIndex === currentIndex;

                                    let wordClass = '';
                                    if (pacerStyle === 'word') {
                                        if (isCurrentWord) {
                                            wordClass = 'pacer-word px-0.5 rounded pacer-word-highlight relative inline-block';
                                        } else if (word.globalIndex < currentIndex) {
                                            wordClass = 'pacer-word px-0.5 rounded text-zinc-500';
                                        } else {
                                            wordClass = 'pacer-word px-0.5 rounded text-zinc-300';
                                        }
                                    } else if (
                                        lineHighlight
                                        && word.globalIndex >= lineHighlight.startIndex
                                        && word.globalIndex <= lineHighlight.endIndex
                                    ) {
                                        wordClass = 'text-zinc-100';
                                    } else if (word.globalIndex < currentIndex) {
                                        wordClass = 'text-zinc-500';
                                    } else {
                                        wordClass = 'text-zinc-300';
                                    }

                                    return (
                                        <React.Fragment key={word.globalIndex}>
                                            <span
                                                data-word-index={word.globalIndex}
                                                className={wordClass}
                                            >
                                                {word.text}
                                                {pacerStyle === 'word' && isCurrentWord && isPlaying && (
                                                    <span
                                                        className="absolute bottom-[-2px] left-0 h-[2px] bg-red-500 rounded-full"
                                                        style={{ width: `${Math.min(wordProgress * 100, 100)}%` }}
                                                    />
                                                )}
                                            </span>
                                            {' '}
                                        </React.Fragment>
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
