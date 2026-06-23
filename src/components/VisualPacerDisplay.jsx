import React, { useRef, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { parseTextToWords } from '../utils/textParser';
import { isMobile } from '../utils/device';

function smoothScrollTo(el, target, animationRef, duration = 250) {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    const start = el.scrollTop;
    const change = target - start;
    if (Math.abs(change) < 1) return;
    if (duration <= 0) {
        el.scrollTop = target;
        animationRef.current = null;
        return;
    }

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

const WINDOW_BEFORE_WORDS = 700;
const WINDOW_AFTER_WORDS = 900;
const WINDOW_SHIFT_WORDS = 300;
const ESTIMATED_WORDS_PER_VISUAL_LINE = 10;
const ESTIMATED_LINE_HEIGHT_PX = 36;

const BLOCK_STYLE_KEYS = new Set([
    'textAlign',
    'textIndent',
    'marginTop',
    'marginRight',
    'marginBottom',
    'marginLeft',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
]);

const pickBlockStyle = (style = {}) => Object.fromEntries(
    Object.entries(style).filter(([key]) => BLOCK_STYLE_KEYS.has(key)),
);

const pickInlineStyle = (style = {}) => Object.fromEntries(
    Object.entries(style).filter(([key]) => !BLOCK_STYLE_KEYS.has(key)),
);

const findBlockStyleForWord = (blockStyleRanges, wordIndex) => (
    blockStyleRanges?.find(range => wordIndex >= range.start && wordIndex <= range.end)?.style || null
);

const VisualPacerDisplay = ({ text, currentIndex, pacerStyle, isPlaying, wordProgress, lineStartRef, images, blockFormatting, visualBlocks, blockStyleRanges, wordStyles }) => {
    const containerRef = useRef(null);
    const scrollAnimationRef = useRef(null);
    const previousWindowStartRef = useRef(null);
    const prevTopSpacerRef = useRef(0);
    const useInstantScroll = useMemo(() => isMobile(), []);
    const [measuredLineHeight, setMeasuredLineHeight] = useState(ESTIMATED_LINE_HEIGHT_PX);
    const [lineHighlight, setLineHighlight] = useState(null);

    useEffect(() => {
        return () => cancelScrollAnimation(scrollAnimationRef);
    }, []);

    // Parse text into structured source rows with word index tracking.
    // Visual line mode measures rendered rows below, so wrapped text follows the device width.
    const lines = useMemo(() => {
        if (visualBlocks?.length) {
            const result = [];

            for (let blockIdx = 0; blockIdx < visualBlocks.length; blockIdx++) {
                const block = visualBlocks[blockIdx];
                const blockLines = block.text.split(/\n/);
                let wordIdx = block.start;

                for (const sourceLine of blockLines) {
                    const lineWords = parseTextToWords(sourceLine);
                    const startIndex = wordIdx;
                    result.push({
                        startIndex,
                        endIndex: startIndex + lineWords.length - 1,
                        words: lineWords.map((w) => ({ text: w, globalIndex: wordIdx++ })),
                        paraIdx: blockIdx,
                        blockStyle: block.style || {},
                    });
                }

                result.push({
                    words: [],
                    isBlank: true,
                    startIndex: wordIdx,
                    endIndex: wordIdx - 1,
                    paraIdx: blockIdx,
                    blockStyle: block.style || {},
                });
            }

            return result;
        }

        if (!text) return [];
        const paragraphs = text.split(/\n\n+/);
        const result = [];
        let wordIdx = 0;

        for (let paraIdx = 0; paraIdx < paragraphs.length; paraIdx++) {
            const para = paragraphs[paraIdx];
            const paraLines = para.split(/\n/);
            for (const line of paraLines) {
                const lineWords = parseTextToWords(line);
                const startIndex = wordIdx;
                const lineData = {
                    startIndex,
                    endIndex: startIndex + lineWords.length - 1,
                    words: lineWords.map((w) => ({ text: w, globalIndex: wordIdx++ })),
                    paraIdx,
                };
                result.push(lineData);
            }
            // Add a blank line between paragraphs
            result.push({ words: [], isBlank: true, startIndex: wordIdx, endIndex: wordIdx - 1, paraIdx });
        }
        return result;
    }, [text, visualBlocks]);

    const totalWords = useMemo(() => {
        const lastLineWithWords = [...lines].reverse().find((line) => line.words.length > 0);
        return lastLineWithWords ? lastLineWithWords.endIndex + 1 : 0;
    }, [lines]);

    const renderWindow = useMemo(() => {
        if (!totalWords) return { start: 0, end: 0 };

        const idealStart = Math.max(0, currentIndex - WINDOW_BEFORE_WORDS);
        const blockStart = Math.floor(idealStart / WINDOW_SHIFT_WORDS) * WINDOW_SHIFT_WORDS;
        const start = Math.min(blockStart, Math.max(0, totalWords - WINDOW_BEFORE_WORDS - WINDOW_AFTER_WORDS - 1));
        const end = Math.min(totalWords - 1, start + WINDOW_BEFORE_WORDS + WINDOW_AFTER_WORDS);

        return { start, end };
    }, [currentIndex, totalWords]);

    const visibleLines = useMemo(() => {
        if (!lines.length) return [];

        return lines.reduce((result, line, lineIdx) => {
            if (line.isBlank) {
                if (line.startIndex >= renderWindow.start && line.startIndex <= renderWindow.end) {
                    result.push({ ...line, lineIdx });
                }
                return result;
            }

            if (line.endIndex < renderWindow.start || line.startIndex > renderWindow.end) {
                return result;
            }

            result.push({
                ...line,
                lineIdx,
                words: line.words.filter((word) => (
                    word.globalIndex >= renderWindow.start && word.globalIndex <= renderWindow.end
                )),
            });
            return result;
        }, []);
    }, [lines, renderWindow.start, renderWindow.end]);

    const topSpacerHeight = Math.floor(renderWindow.start / ESTIMATED_WORDS_PER_VISUAL_LINE) * measuredLineHeight;
    const bottomSpacerHeight = Math.floor(Math.max(totalWords - renderWindow.end - 1, 0) / ESTIMATED_WORDS_PER_VISUAL_LINE) * measuredLineHeight;

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
            const sameLineWordEls = (() => {
                const lineEl = currentEl.closest('[data-line-index]');
                if (!lineEl) return [];
                return Array.from(lineEl.querySelectorAll('[data-word-index]'))
                    .filter((wordEl) => {
                        const rect = getFirstRect(wordEl);
                        return currentCenter >= rect.top && currentCenter <= rect.bottom;
                    });
            })();
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

            if (lineStartRef) {
                lineStartRef.current = nextHighlight.startIndex;
            }

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
    }, [currentIndex, pacerStyle, visibleLines, renderWindow.start, lineStartRef]);

    // Measure actual rendered line heights to replace static ESTIMATED_LINE_HEIGHT_PX.
    // This adapts to the device's font size, container width, and word wrapping.
    useLayoutEffect(() => {
        if (!containerRef.current) return;
        const frameId = requestAnimationFrame(() => {
            const lineEls = containerRef.current?.querySelectorAll('[data-line-index]');
            if (!lineEls || lineEls.length === 0) return;

            let totalHeight = 0;
            let count = 0;
            lineEls.forEach((el) => {
                totalHeight += el.offsetHeight;
                count++;
            });

            if (count > 0) {
                const nextLineHeight = Math.round(totalHeight / count);
                setMeasuredLineHeight((prev) => (
                    Math.abs(prev - nextLineHeight) > 0.5 ? nextLineHeight : prev
                ));
            }
        });

        return () => cancelAnimationFrame(frameId);
    }, [renderWindow.start, renderWindow.end]);

    // Auto-scroll once the active word would move below the top quarter.
    // When the render window shifts, correct scrollTop by the spacer delta to preserve
    // the word's screen position — making the shift invisible.
    useLayoutEffect(() => {
        if (!containerRef.current) return;
        const container = containerRef.current;
        const currentEl = container.querySelector(`[data-word-index="${currentIndex}"]`);

        if (!currentEl) return;

        const windowChanged = previousWindowStartRef.current !== renderWindow.start;
        previousWindowStartRef.current = renderWindow.start;

        // Anchor-based correction: when the window shifts, the top spacer height changes,
        // which shifts all content vertically. Compensate by adjusting scrollTop by the
        // exact spacer delta so the current word stays at the same screen position.
        if (windowChanged) {
            const spacerDelta = topSpacerHeight - prevTopSpacerRef.current;
            if (Math.abs(spacerDelta) > 0.5) {
                cancelScrollAnimation(scrollAnimationRef);
                container.scrollTop += spacerDelta;
            }
        }
        prevTopSpacerRef.current = topSpacerHeight;

        // Normal scroll behavior: keep the active word above the bottom half.
        const containerRect = container.getBoundingClientRect();
        const elRect = currentEl.getBoundingClientRect();
        const thresholdTop = container.clientHeight * 0.25;
        const currentTop = elRect.top - containerRect.top;

        if (currentTop <= thresholdTop && currentTop >= 0) return;

        const maxScroll = container.scrollHeight - container.clientHeight;
        const targetScrollTop = container.scrollTop + currentTop - thresholdTop;
        const clamped = Math.max(0, Math.min(targetScrollTop, maxScroll));

        if (windowChanged) {
            // After anchor correction, snap to threshold if word is still out of bounds
            container.scrollTop = clamped;
            return;
        }

        smoothScrollTo(container, clamped, scrollAnimationRef, useInstantScroll ? 0 : 250);
    }, [currentIndex, renderWindow.start, useInstantScroll, topSpacerHeight]);

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
            className="relative w-full max-w-[95vw] md:max-w-[75vw] h-[40svh] md:h-[60svh] overflow-y-auto overscroll-contain rounded-xl p-4 sm:p-6 md:p-10 pacer-scroll"
            style={{
                overflowAnchor: 'none',
                WebkitOverflowScrolling: 'touch',
            }}
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
                {topSpacerHeight > 0 && <div style={{ height: `${topSpacerHeight}px` }} aria-hidden="true" />}
                {visibleLines.map((line) => {
                    if (line.isBlank) {
                        return <div key={`blank-${line.lineIdx}`} className="h-6" />;
                    }

                    const firstWordStyle = wordStyles?.[line.words[0]?.globalIndex] || {};
                    const rangeBlockStyle = findBlockStyleForWord(blockStyleRanges, line.startIndex);
                    const lineStyle = {
                        ...pickBlockStyle(line.blockStyle || rangeBlockStyle || blockFormatting?.[line.paraIdx]),
                        ...(!line.blockStyle ? pickBlockStyle(firstWordStyle) : {}),
                    };
                    const baseInlineStyle = pickInlineStyle(line.blockStyle || {});

                    return (
                        <div
                            key={`line-${line.lineIdx}`}
                            data-line-index={line.lineIdx}
                            className="relative px-2 py-1 rounded transition-colors duration-150"
                            style={lineStyle}
                        >
                            <span>
                                {line.words.map((word) => {
                                    const isCurrentWord = word.globalIndex === currentIndex;
                                    const authorStyle = {
                                        ...baseInlineStyle,
                                        ...pickInlineStyle(wordStyles?.[word.globalIndex]),
                                    };

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
                                            {word.text.startsWith('¶IMG:') ? (
                                                (() => {
                                                    const match = word.text.match(/¶IMG:(\d+)¶/);
                                                    const imgIdx = match ? parseInt(match[1], 10) : -1;
                                                    const imgData = images?.[imgIdx];
                                                    const src = typeof imgData === 'string' ? imgData : imgData?.src;
                                                    const layout = typeof imgData === 'object' ? imgData : {};

                                                    if (!src) {
                                                        return <span data-word-index={word.globalIndex} className={wordClass}>{word.text}</span>;
                                                    }

                                                    const wrapperClass = layout.inline
                                                        ? `${wordClass} inline-block align-middle`
                                                        : `${wordClass} block w-full text-center my-1`;
                                                    const widthClass = layout.fullWidth ? 'w-full' : '';
                                                    const imgStyle = {
                                                        ...authorStyle,
                                                        ...(layout.maxWidth ? { maxWidth: layout.maxWidth } : {}),
                                                    };

                                                    return (
                                                        <span
                                                            data-word-index={word.globalIndex}
                                                            className={wrapperClass}
                                                            style={authorStyle}
                                                        >
                                                            <img
                                                                src={src}
                                                                alt=""
                                                                className={`${widthClass} max-h-[20em] max-w-full object-contain`}
                                                                style={imgStyle}
                                                                draggable={false}
                                                            />
                                                            {pacerStyle === 'word' && isCurrentWord && isPlaying && (
                                                                <span
                                                                    className="absolute bottom-[-2px] left-0 h-[2px] bg-red-500 rounded-full"
                                                                    style={{ width: `${Math.min(wordProgress * 100, 100)}%` }}
                                                                />
                                                            )}
                                                        </span>
                                                    );
                                                })()
                                            ) : (
                                                <span
                                                    data-word-index={word.globalIndex}
                                                    className={wordClass}
                                                    style={authorStyle}
                                                >
                                                    {word.text}
                                                    {pacerStyle === 'word' && isCurrentWord && isPlaying && (
                                                        <span
                                                            className="absolute bottom-[-2px] left-0 h-[2px] bg-red-500 rounded-full"
                                                            style={{ width: `${Math.min(wordProgress * 100, 100)}%` }}
                                                        />
                                                    )}
                                                </span>
                                            )}
                                            {' '}
                                        </React.Fragment>
                                    );
                                })}
                            </span>
                        </div>
                    );
                })}
                {bottomSpacerHeight > 0 && <div style={{ height: `${bottomSpacerHeight}px` }} aria-hidden="true" />}
            </div>
        </div>
    );
};

export default VisualPacerDisplay;
