import type { CSSProperties } from 'react';
import type {
    EpubChapter,
    EpubImage,
    EpubContentResult,
    CssRule,
    SelectorPart,
    ElementContext,
    ImageLayout,
    ParsedCss,
    VisualBlock,
    BlockStyleRange,
} from '../types';

interface EpubBook {
    ready: Promise<void>;
    packaging: { metadata: { title?: string; creator?: string } };
    navigation: { toc: { label: string; href?: string; subitems?: unknown[] }[] };
    archive: { getBlob(path: string): Promise<Blob | null>; getText(path: string): Promise<string | null> };
    spine: { each(callback: (section: { href: string }) => void): void };
    load(href: string): Promise<{ body: HTMLElement; querySelectorAll(selector: string): NodeListOf<HTMLElement> }>;
    destroy(): void;
}

/**
 * Extracts text from a PDF file.
 */
export const extractTextFromPDF = async (file: File): Promise<string> => {
    const pdfjs = await import('pdfjs-dist');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pdfjs as any).GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

    const arrayBuffer = await file.arrayBuffer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdf = await (pdfjs as any).getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const strings: string[] = content.items.map((item: any) => item.str);
        fullText += strings.join(' ') + '\n';
    }

    return fullText;
};

/**
 * Extracts text from a DOCX file.
 */
export const extractTextFromDOCX = async (file: File): Promise<string> => {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (mammoth as any).extractRawText({ arrayBuffer });
    return result.value as string;
};

/**
 * Reads a TXT file as a string.
 */
export const extractTextFromTXT = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target!.result as string);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
};

const EPUB_BLOCK_TAGS = new Set([
    'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'BR', 'DD', 'DIV', 'DL', 'DT',
    'FIGCAPTION', 'FIGURE', 'FOOTER', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'TABLE',
    'TD', 'TH', 'TR', 'UL',
    'address', 'article', 'aside', 'blockquote', 'br', 'dd', 'div', 'dl', 'dt',
    'figcaption', 'figure', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'table',
    'td', 'th', 'tr', 'ul',
]);

const loadEpubFactory = async (): Promise<(data: ArrayBuffer) => EpubBook> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const module: any = await import('epubjs');
    return (module.default?.default || module.default) as (data: ArrayBuffer) => EpubBook;
};

const appendBreak = (parts: string[]): void => {
    if (parts.length > 0 && parts[parts.length - 1] !== '\n') {
        parts.push('\n');
    }
};

const parseInlineStyle = (inlineStyle: string): Record<string, string> => {
    const props: Record<string, string> = {};
    if (!inlineStyle) return props;
    const inlineRe = /([\w-]+)\s*:\s*([^;]+)/g;
    let m: RegExpExecArray | null;
    while ((m = inlineRe.exec(inlineStyle)) !== null) {
        props[m[1].trim().toLowerCase()] = m[2].trim();
    }
    return props;
};

const parseSelectorPart = (part: string): SelectorPart => {
    const idMatch = part.match(/#([\w-]+)/);
    const classMatches: string[] = [...part.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
    const tagMatch = part.match(/^([a-zA-Z][a-zA-Z0-9-]*)/);
    return {
        tag: tagMatch ? tagMatch[1].toLowerCase() : null,
        id: idMatch ? idMatch[1] : null,
        classes: classMatches,
    };
};

const selectorSpecificity = (parts: SelectorPart[]): number => {
    let ids = 0;
    let classes = 0;
    let tags = 0;
    for (const part of parts) {
        if (part.id) ids++;
        classes += part.classes.length;
        if (part.tag) tags++;
    }
    return ids * 100 + classes * 10 + tags;
};

const parseCssText = (cssText: string, baseHref: string = ''): ParsedCss => {
    const cleaned = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
    let expanded = cleaned;
    const mediaRe = /@media[^{]*\{([\s\S]*?)\}/g;
    let m: RegExpExecArray | null;
    while ((m = mediaRe.exec(cleaned)) !== null) {
        expanded += ' ' + m[1];
    }
    const rules: CssRule[] = [];
    const fontFaces: Record<string, string>[] = [];
    const ruleRe = /([^{}]+)\{([^{}]+)\}/g;
    let match: RegExpExecArray | null;
    while ((match = ruleRe.exec(expanded)) !== null) {
        const selector = match[1].trim();
        const body = match[2].trim();
        if (selector.startsWith('@font-face')) {
            const props: Record<string, string> = {};
            const propRe = /([\w-]+)\s*:\s*([^;]+)/g;
            let pm: RegExpExecArray | null;
            while ((pm = propRe.exec(body)) !== null) {
                props[pm[1].trim().toLowerCase()] = pm[2].trim();
            }
            fontFaces.push({ ...props, baseHref });
            continue;
        }
        if (selector.startsWith('@')) continue;
        const props: Record<string, string> = {};
        const propRe = /([\w-]+)\s*:\s*([^;]+)/g;
        let pm: RegExpExecArray | null;
        while ((pm = propRe.exec(body)) !== null) {
            props[pm[1].trim().toLowerCase()] = pm[2].trim();
        }
        for (const rawSelector of selector.split(',')) {
            const cleanSelector = rawSelector
                .trim()
                .replace(/::?[\w-]+(?:\([^)]*\))?/g, '')
                .replace(/\s*[>+~]\s*/g, ' ');
            if (!cleanSelector || /[[\]]/.test(cleanSelector)) continue;
            const parts: SelectorPart[] = cleanSelector
                .split(/\s+/)
                .map(parseSelectorPart)
                .filter((part) => part.tag || part.id || part.classes.length > 0);
            if (parts.length > 0) {
                rules.push({
                    selector: cleanSelector,
                    parts,
                    classes: parts.flatMap((part) => part.classes),
                    tagNames: parts.map((part) => part.tag).filter(Boolean) as (string | null)[],
                    specificity: selectorSpecificity(parts),
                    order: rules.length,
                    props,
                });
            }
        }
    }
    return { rules, fontFaces };
};

const matchesSelectorPart = (elementCtx: ElementContext | null, part: SelectorPart): boolean => {
    if (!elementCtx) return false;
    if (part.tag && part.tag !== elementCtx.tagName?.toLowerCase()) return false;
    if (part.id && part.id !== elementCtx.id) return false;
    return part.classes.every((c) => elementCtx.classes.includes(c));
};

const matchesCssRule = (elementCtx: ElementContext, ancestors: ElementContext[], rule: CssRule): boolean => {
    if (!rule.parts?.length) {
        const classMatch = rule.classes.some((c) => elementCtx.classes.includes(c));
        const tagMatch = rule.tagNames?.some((t) => t === elementCtx.tagName?.toLowerCase());
        return classMatch || tagMatch;
    }

    let partIdx = rule.parts.length - 1;
    if (!matchesSelectorPart(elementCtx, rule.parts[partIdx])) return false;
    partIdx--;

    for (let ancestorIdx = ancestors.length - 1; partIdx >= 0 && ancestorIdx >= 0; ancestorIdx--) {
        if (matchesSelectorPart(ancestors[ancestorIdx], rule.parts[partIdx])) {
            partIdx--;
        }
    }

    return partIdx < 0;
};

const resolveCssProps = (
    elementCtx: ElementContext,
    ancestors: ElementContext[],
    cssRules: CssRule[],
): Record<string, string> => {
    const matched = cssRules
        .filter((rule) => matchesCssRule(elementCtx, ancestors, rule))
        .sort((a, b) => a.specificity - b.specificity || a.order - b.order);
    return matched.reduce((props, rule) => Object.assign(props, rule.props), {} as Record<string, string>);
};

const toPacerStyle = (
    props: Record<string, string>,
    { block = false } = {} as { block?: boolean },
): CSSProperties => {
    const style: Record<string, string> = {};
    const assign = (cssName: string, reactName: string = cssName.replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase())) => {
        if (props[cssName]) style[reactName] = props[cssName];
    };
    const assignBox = (cssName: string, reactPrefix: string) => {
        const value = props[cssName];
        if (!value) return;
        const parts = value.split(/\s+/).filter(Boolean);
        if (parts.length === 0) return;
        const [top, right = top, bottom = top, left = right] = parts;
        style[`${reactPrefix}Top`] = top;
        style[`${reactPrefix}Right`] = right;
        style[`${reactPrefix}Bottom`] = bottom;
        style[`${reactPrefix}Left`] = left;
    };

    assign('font-family');
    assign('font-size');
    assign('font-style');
    assign('font-weight');
    assign('font-variant');
    assign('font-stretch');
    assign('line-height');
    assign('color');
    assign('background-color', 'backgroundColor');
    assign('text-decoration');
    assign('text-transform');
    assign('letter-spacing');
    assign('word-spacing');
    assign('vertical-align');

    if (block) {
        assign('text-align');
        assign('text-indent');
        assignBox('margin', 'margin');
        assignBox('padding', 'padding');
        assign('margin-top');
        assign('margin-bottom');
        assign('margin-left');
        assign('margin-right');
        assign('padding-left');
        assign('padding-right');
    }

    return style as CSSProperties;
};

const countPacerWords = (text: string): number => {
    if (!text) return 0;
    return text
        .replace(/â€"/g, ' ')
        .replace(/-/g, '- ')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .length;
};

/**
 * Resolves image layout metadata from its nearest block ancestor's CSS context.
 */
const resolveImageLayout = (
    parentCtx: ElementContext | null,
    cssRules: CssRule[],
    ancestors: ElementContext[] = [],
): ImageLayout => {
    const layout: ImageLayout = { align: 'center', maxWidth: null, fullWidth: false };
    const props: Record<string, string> = Object.assign(
        {},
        resolveCssProps(parentCtx || ({ tagName: null, id: '', classes: [], inlineStyle: '' } as ElementContext), ancestors, cssRules),
        parseInlineStyle(parentCtx?.inlineStyle || ''),
    );
    if (props['text-align'] === 'right') layout.align = 'right';
    else if (props['text-align'] === 'center' || props['text-align'] === 'justify') layout.align = 'center';
    if (props['margin-left'] === 'auto' && props['margin-right'] === 'auto') layout.align = 'center';
    const margin = props['margin'];
    if (margin) {
        const parts = margin.split(/\s+/);
        if (parts.length >= 3 && parts[0] !== 'auto' && parts[2] === 'auto') layout.align = 'center';
        if (parts.length === 1 && parts[0] === '0' && props['margin-left'] === 'auto') layout.align = 'center';
    }
    if (props['max-width']) layout.maxWidth = props['max-width'];
    if (props['width'] && props['width'] !== 'auto') layout.maxWidth = props['width'];
    if (layout.maxWidth === '100%' || props['width'] === '100%') layout.fullWidth = true;
    if (props['display'] === 'inline' || props['display'] === 'inline-block') layout.inline = true;
    return layout;
};

/**
 * Normalizes a relative EPUB path by resolving ../ and ./ segments.
 */
const normalizeEpubPath = (path: string): string => {
    let decoded: string;
    try { decoded = decodeURIComponent(path); } catch { decoded = path; }
    const parts = decoded.split('/');
    const resolved: string[] = [];
    for (const part of parts) {
        if (part === '..') {
            resolved.pop();
        } else if (part !== '.' && part !== '') {
            resolved.push(part);
        }
    }
    return resolved.join('/');
};

const extractTextFromEpubBody = (body: HTMLElement): string => {
    const parts: string[] = [];

    const walk = (node: ChildNode): void => {
        if (node.nodeType === 3) {
            parts.push(node.textContent!.replace(/\s+/g, ' '));
            return;
        }

        if (node.nodeType !== 1) return;

        const tagName = (node as HTMLElement).tagName;
        const isBlock = EPUB_BLOCK_TAGS.has(tagName);

        if (isBlock) appendBreak(parts);

        for (const child of node.childNodes) {
            walk(child);
        }

        if (isBlock) appendBreak(parts);
    };

    walk(body);

    return parts
        .join('')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};

/**
 * Resolves text formatting for a block element from its CSS context.
 */
const resolveElementFormatting = (
    elementCtx: ElementContext,
    inherited: { props: Record<string, string>; style: CSSProperties } | null,
    cssRules: CssRule[],
    ancestors: ElementContext[],
    { block = false } = {} as { block?: boolean },
): { props: Record<string, string>; style: CSSProperties } => {
    const props: Record<string, string> = Object.assign(
        {},
        inherited?.props || {},
        resolveCssProps(elementCtx, ancestors, cssRules),
        parseInlineStyle(elementCtx.inlineStyle),
    );
    return { props, style: toPacerStyle(props, { block }) };
};

/**
 * Gets context info from a DOM node.
 */
const getElementCtx = (node: HTMLElement | Element): ElementContext => ({
    tagName: node.tagName,
    id: node.getAttribute?.('id') || '',
    classes: Array.from((node as HTMLElement).classList || []),
    inlineStyle: node.getAttribute?.('style') || '',
});

/**
 * Parses an EPUB file and returns chapter metadata.
 */
export const parseEpubChapters = async (file: File): Promise<{ title: string; author: string; chapters: EpubChapter[] }> => {
    const ePub = await loadEpubFactory();
    const arrayBuffer = await file.arrayBuffer();
    const book = ePub(arrayBuffer);
    await book.ready;

    const metadata = book.packaging.metadata || {};
    const title = metadata.title || file.name.replace(/\.epub$/i, '');
    const author = metadata.creator || '';

    const spineHrefs: string[] = [];
    book.spine.each((section) => {
        spineHrefs.push(section.href);
    });

    const tocEntries: { label: string; href: string }[] = [];
    function flattenToc(items: { label: string; href?: string; subitems?: unknown[] }[]): void {
        for (const item of items) {
            if (item.href) {
                const baseHref = normalizeEpubPath(item.href.split('#')[0]);
                tocEntries.push({ label: item.label, href: baseHref });
            }
            if (item.subitems?.length) flattenToc(item.subitems as { label: string; href?: string; subitems?: unknown[] }[]);
        }
    }
    if (book.navigation?.toc) flattenToc(book.navigation.toc);

    if (tocEntries.length === 0) {
        const chapters: EpubChapter[] = [{
            index: 0,
            label: 'Full Text',
            hrefs: spineHrefs.length > 0 ? spineHrefs : [''],
            wordCount: 0,
        }];
        for (const chapter of chapters) {
            let totalWords = 0;
            for (const href of chapter.hrefs) {
                try {
                    const doc = await book.load(href);
                    if (doc && doc.body) {
                        const text = extractTextFromEpubBody(doc.body);
                        totalWords += text.trim().split(/\s+/).filter(Boolean).length;
                    }
                } catch (e) {
                    console.warn(`EPUB: failed to load section "${href}" for chapter "${chapter.label}":`, e);
                }
            }
            chapter.wordCount = totalWords;
        }
        book.destroy();
        return { title, author, chapters };
    }

    const chapters: EpubChapter[] = tocEntries.map((entry, i) => ({
        index: i,
        label: entry.label,
        hrefs: [entry.href],
        wordCount: 0,
    }));

    const coveredHrefs = new Set(chapters.flatMap((c) => c.hrefs));

    const leadingOrphans: string[] = [];
    for (const href of spineHrefs) {
        if (coveredHrefs.has(normalizeEpubPath(href))) break;
        leadingOrphans.push(href);
    }

    if (leadingOrphans.length > 0) {
        chapters.unshift({
            index: 0,
            label: 'Introduction',
            hrefs: leadingOrphans,
            wordCount: 0,
        });
        chapters.forEach((ch, i) => ch.index = i);
    }

    for (const href of spineHrefs) {
        if (coveredHrefs.has(normalizeEpubPath(href))) continue;
        if (leadingOrphans.includes(href)) continue;

        const spineIdx = spineHrefs.indexOf(href);
        let bestChapter = chapters[chapters.length - 1];
        for (let i = chapters.length - 1; i >= 0; i--) {
            const chapterHrefs = chapters[i].hrefs.map((h) => spineHrefs.indexOf(h)).filter((idx) => idx >= 0);
            const nearestSpineIdx = Math.max(...chapterHrefs);
            if (nearestSpineIdx < spineIdx) {
                bestChapter = chapters[i];
                break;
            }
        }
        bestChapter.hrefs.push(href);
    }

    for (const chapter of chapters) {
        let totalWords = 0;
        for (const href of chapter.hrefs) {
            try {
                const doc = await book.load(href);
                if (doc && doc.body) {
                    const text = extractTextFromEpubBody(doc.body);
                    totalWords += text.trim().split(/\s+/).filter(Boolean).length;
                    const html = doc.body.innerHTML || '';
                    const imgCount = (html.match(/<image\b/gi) || []).length + (html.match(/<img\b/gi) || []).length;
                    totalWords += imgCount;
                }
            } catch (e) {
                console.warn(`EPUB: failed to load section "${href}" for chapter "${chapter.label}":`, e);
            }
        }
        chapter.wordCount = totalWords;
    }

    book.destroy();
    return { title, author, chapters };
};

/**
 * Extracts text from selected chapters of an EPUB file.
 */
export const extractEpubChaptersText = async (file: File, chapters: EpubChapter[]): Promise<string> => {
    const ePub = await loadEpubFactory();
    const arrayBuffer = await file.arrayBuffer();
    const book = ePub(arrayBuffer);
    await book.ready;

    const texts: string[] = [];
    for (const chapter of chapters) {
        for (const href of chapter.hrefs) {
            try {
                const doc = await book.load(href);
                if (doc && doc.body) {
                    texts.push(extractTextFromEpubBody(doc.body));
                }
            } catch (e) {
                console.warn(`EPUB: failed to extract text from "${href}" for chapter "${chapter.label}":`, e);
            }
        }
    }

    book.destroy();
    return texts.join('\n\n');
};

/**
 * Extracts text and images from selected EPUB chapters.
 */
export const extractEpubContentWithImages = async (
    file: File,
    chapters: { hrefs: string[]; label: string }[],
): Promise<EpubContentResult> => {
    const ePub = await loadEpubFactory();
    const arrayBuffer = await file.arrayBuffer();
    const book = ePub(arrayBuffer);
    await book.ready;

    const images: EpubImage[] = [];
    const imageIndexBySrc = new Map<string, number>();
    const cssRules: CssRule[] = [];
    const fontFaces: Record<string, string>[] = [];
    const loadedCssHrefs = new Set<string>();

    const resolveImgSrc = (src: string, baseHref: string): string => {
        try {
            const baseParts = baseHref.split('/');
            baseParts.pop();
            const srcParts = src.split('/');
            const resolved = [...baseParts, ...srcParts];
            const final: string[] = [];
            for (const part of resolved) {
                if (part === '..') final.pop();
                else if (part !== '.' && part !== '') final.push(part);
            }
            return final.join('/');
        } catch {
            return src;
        }
    };

    const getImageToken = async (src: string, baseHref: string, layout: ImageLayout): Promise<string | null> => {
        const resolved = resolveImgSrc(src, baseHref);
        if (imageIndexBySrc.has(resolved)) {
            return `¶IMG:${imageIndexBySrc.get(resolved)}¶`;
        }
        try {
            let dataUrl: string | null = null;
            if (book.archive && typeof book.archive.getBlob === 'function') {
                const blob = await book.archive.getBlob('/' + resolved);
                if (blob) {
                    dataUrl = await new Promise<string | null>((resolve) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = () => resolve(null);
                        reader.readAsDataURL(blob);
                    });
                }
            }
            if (!dataUrl) return null;
            const idx = images.length;
            images.push({ src: dataUrl, ...layout });
            imageIndexBySrc.set(resolved, idx);
            return `¶IMG:${idx}¶`;
        } catch (e) {
            console.warn(`EPUB: failed to load image "${resolved}":`, e);
            return null;
        }
    };

    const extractTextAndImagesFromBody = async (
        body: HTMLElement,
        baseHref: string,
    ): Promise<{
        text: string;
        paraFormatting: CSSProperties[];
        visualBlocks: VisualBlock[];
        blockStyleRanges: BlockStyleRange[];
        wordStyles: CSSProperties[];
    }> => {
        const parts: string[] = [];
        const paraFormatting: CSSProperties[] = [];
        const visualBlocks: VisualBlock[] = [];
        const blockStyleRanges: BlockStyleRange[] = [];
        const wordStyles: CSSProperties[] = [];
        let wordIndex = 0;
        let currentParaIndex = -1;
        let currentParaHasText = false;
        let currentBlockStyleRange: BlockStyleRange | null = null;
        let currentVisualBlock: VisualBlock | null = null;

        const bodyCtx = getElementCtx(body);
        const inheritedFormatting = resolveElementFormatting(bodyCtx, null, cssRules, [], { block: true });

        const pushText = (value: string, fmt: { props: Record<string, string>; style: CSSProperties } | null): void => {
            const normalized = value.replace(/\s+/g, ' ');
            if (!normalized.trim()) {
                parts.push(normalized);
                return;
            }
            if (currentParaIndex < 0 || !currentParaHasText) {
                currentParaIndex += 1;
                paraFormatting[currentParaIndex] = fmt?.style || {};
                currentBlockStyleRange = { start: wordIndex, end: wordIndex - 1, style: fmt?.style || {} };
                blockStyleRanges.push(currentBlockStyleRange);
                currentVisualBlock = { text: '', start: wordIndex, end: wordIndex - 1, style: fmt?.style || {} };
                visualBlocks.push(currentVisualBlock);
                currentParaHasText = true;
            }
            parts.push(normalized);
            if (currentVisualBlock) currentVisualBlock.text += normalized;
            const count = countPacerWords(normalized);
            for (let i = 0; i < count; i++) {
                wordStyles[wordIndex + i] = fmt?.style || {};
            }
            wordIndex += count;
            if (currentBlockStyleRange) {
                currentBlockStyleRange.end = wordIndex - 1;
            }
            if (currentVisualBlock) {
                currentVisualBlock.end = wordIndex - 1;
            }
        };

        const pushImageToken = (token: string, fmt: { props: Record<string, string>; style: CSSProperties } | null): void => {
            if (currentParaIndex < 0 || !currentParaHasText) {
                currentParaIndex += 1;
                paraFormatting[currentParaIndex] = fmt?.style || {};
                currentBlockStyleRange = { start: wordIndex, end: wordIndex, style: fmt?.style || {} };
                blockStyleRanges.push(currentBlockStyleRange);
                currentVisualBlock = { text: '', start: wordIndex, end: wordIndex, style: fmt?.style || {} };
                visualBlocks.push(currentVisualBlock);
                currentParaHasText = true;
            }
            const tokenText = ` ${token} `;
            parts.push(tokenText);
            if (currentVisualBlock) currentVisualBlock.text += tokenText;
            wordStyles[wordIndex] = fmt?.style || {};
            wordIndex += 1;
            if (currentBlockStyleRange) {
                currentBlockStyleRange.end = wordIndex - 1;
            }
            if (currentVisualBlock) {
                currentVisualBlock.end = wordIndex - 1;
            }
        };

        const pushParaBreak = (): void => {
            if (parts.length > 0) {
                const last = parts[parts.length - 1];
                if (last === '\n\n') return;
                if (last === '\n') { parts.push('\n'); return; }
            }
            parts.push('\n\n');
            currentParaHasText = false;
            currentBlockStyleRange = null;
            currentVisualBlock = null;
        };

        const pushLineBreak = (): void => {
            if (parts.length > 0 && parts[parts.length - 1] !== '\n') {
                parts.push('\n');
                if (currentVisualBlock) currentVisualBlock.text += '\n';
            }
        };

        const walk = async (
            node: ChildNode,
            blockCtx: ElementContext | null,
            inheritedFmt: { props: Record<string, string>; style: CSSProperties } | null,
            ancestors: ElementContext[],
        ): Promise<void> => {
            if (node.nodeType === 3) {
                pushText(node.textContent!, inheritedFmt);
                return;
            }
            if (node.nodeType !== 1) return;

            const tagName = (node as HTMLElement).tagName;
            if (tagName?.toLowerCase() === 'br') {
                pushLineBreak();
                return;
            }

            const elementCtx = getElementCtx(node as HTMLElement);
            const elementFmt = resolveElementFormatting(
                elementCtx,
                inheritedFmt,
                cssRules,
                ancestors,
                { block: EPUB_BLOCK_TAGS.has(tagName) },
            );

            if (tagName === 'IMG') {
                const imgSrc = (node as HTMLElement).getAttribute('src');
                if (imgSrc) {
                    const layout: ImageLayout = blockCtx
                        ? resolveImageLayout(blockCtx, cssRules, ancestors)
                        : { align: 'center', maxWidth: null, fullWidth: false, inline: false };
                    const token = await getImageToken(imgSrc, baseHref, layout);
                    if (token) {
                        pushImageToken(token, elementFmt);
                    }
                }
                return;
            }

            const isBlock = EPUB_BLOCK_TAGS.has(tagName);
            const childCtx = isBlock ? elementCtx : blockCtx;
            const childAncestors = [...ancestors, elementCtx];

            if (isBlock) {
                pushParaBreak();
                for (const child of node.childNodes) {
                    await walk(child, childCtx, elementFmt, childAncestors);
                }
                pushParaBreak();
            } else {
                for (const child of node.childNodes) {
                    await walk(child, childCtx, elementFmt, childAncestors);
                }
            }
        };

        await walk(body, null, inheritedFormatting, []);

        const html = body.innerHTML || '';
        const svgImageRe = /<image\b[^>]*(?:xlink:)?href="([^"]+)"/gi;
        let match: RegExpExecArray | null;
        const svgSrcs: { src: string; layout: ImageLayout }[] = [];
        while ((match = svgImageRe.exec(html)) !== null) {
            const before = html.substring(0, match.index);
            const tagMatch = before.match(/<(?:div|p|figure|section|td)[^>]*class="([^"]*)"[^>]*>\s*$/i);
            const parentCtx: ElementContext = {
                tagName: null,
                id: '',
                classes: tagMatch ? tagMatch[1].split(/\s+/) : [],
                inlineStyle: '',
            };
            svgSrcs.push({ src: match[1], layout: resolveImageLayout(parentCtx, cssRules, []) });
        }
        for (const { src, layout } of svgSrcs) {
            const token = await getImageToken(src, baseHref, layout);
            if (token) {
                pushImageToken(token, inheritedFormatting);
            }
        }

        const text = parts
            .join('')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n[ \t]+/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .replace(/\s+¶IMG:/g, ' ¶IMG:')
            .replace(/¶IMG:(\d+)¶\s+/g, '¶IMG:$1¶ ')
            .trim();

        return {
            text,
            paraFormatting,
            visualBlocks: visualBlocks
                .map((block) => ({ ...block, text: block.text.trim() }))
                .filter((block) => block.text),
            blockStyleRanges,
            wordStyles,
        };
    };

    const loadCssForChapter = async (href: string): Promise<void> => {
        try {
            const doc = await book.load(href);
            if (!doc) return;
            const links = doc.querySelectorAll('link[rel="stylesheet"], link[type="text/css"]');
            for (const link of Array.from(links)) {
                const cssHref = link.getAttribute('href');
                const resolved = resolveImgSrc(cssHref!, href);
                if (!cssHref || loadedCssHrefs.has(resolved)) continue;
                loadedCssHrefs.add(resolved);
                try {
                    if (book.archive && typeof book.archive.getText === 'function') {
                        const text = await book.archive.getText('/' + resolved);
                        if (text) {
                            const { rules, fontFaces: ff } = parseCssText(text, resolved);
                            cssRules.push(...rules);
                            fontFaces.push(...ff);
                        }
                    }
                } catch { /* CSS file not found or unparsable */ }
            }
        } catch { /* chapter not loadable, skip CSS */ }
    };

    for (const chapter of chapters) {
        for (const href of chapter.hrefs) {
            await loadCssForChapter(href);
        }
    }

    let fontFaceCSS = '';
    if (fontFaces.length > 0) {
        const fontSrcRe = /url\(([^)]+)\)/;
        const fontFaceBlocks: string[] = [];
        for (const ff of fontFaces) {
            const srcRaw = ff['src'];
            if (!srcRaw) continue;
            const srcMatch = srcRaw.match(fontSrcRe);
            if (!srcMatch) continue;
            const fontPath = srcMatch[1].trim().replace(/^['"]|['"]$/g, '');
            const resolved = resolveImgSrc(fontPath, ff.baseHref || '');
            try {
                if (book.archive && typeof book.archive.getBlob === 'function') {
                    const blob = await book.archive.getBlob('/' + resolved);
                    if (blob) {
                        const dataUrl = await new Promise<string | null>((resolve) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result as string);
                            reader.onerror = () => resolve(null);
                            reader.readAsDataURL(blob);
                        });
                        if (dataUrl) {
                            const srcUpdated = srcRaw.replace(fontPath, dataUrl);
                            const parts: string[] = [];
                            if (ff['font-family']) parts.push(`font-family: ${ff['font-family']}`);
                            if (ff['font-weight']) parts.push(`font-weight: ${ff['font-weight']}`);
                            if (ff['font-style']) parts.push(`font-style: ${ff['font-style']}`);
                            parts.push(`src: ${srcUpdated}`);
                            fontFaceBlocks.push(`@font-face { ${parts.join('; ')} }`);
                        }
                    }
                }
            } catch { /* font file not found */ }
        }
        if (fontFaceBlocks.length > 0) {
            fontFaceCSS = fontFaceBlocks.join('\n');
        }
    }

    const texts: string[] = [];
    const allParaFormatting: CSSProperties[] = [];
    const allVisualBlocks: VisualBlock[] = [];
    const allBlockStyleRanges: BlockStyleRange[] = [];
    const allWordStyles: CSSProperties[] = [];
    for (const chapter of chapters) {
        for (const href of chapter.hrefs) {
            try {
                const doc = await book.load(href);
                if (doc && doc.body) {
                    const result = await extractTextAndImagesFromBody(doc.body, href);
                    const wordOffset = allWordStyles.length;
                    texts.push(result.text);
                    allParaFormatting.push(...result.paraFormatting);
                    allWordStyles.push(...result.wordStyles);
                    allVisualBlocks.push(...result.visualBlocks.map((block) => ({
                        ...block,
                        start: block.start + wordOffset,
                        end: block.end + wordOffset,
                    })));
                    allBlockStyleRanges.push(...result.blockStyleRanges.map((range) => ({
                        ...range,
                        start: range.start + wordOffset,
                        end: range.end + wordOffset,
                    })));
                }
            } catch (e) {
                console.warn(`EPUB: failed to extract content from "${href}" for chapter "${chapter.label}":`, e);
            }
        }
    }

    book.destroy();
    return {
        text: texts.join('\n\n'),
        images,
        blockFormatting: allParaFormatting,
        visualBlocks: allVisualBlocks,
        blockStyleRanges: allBlockStyleRanges,
        wordStyles: allWordStyles,
        fontFaceCSS,
    };
};

/**
 * Extracts text from each chapter separately, returning per-chapter texts.
 */
export const extractEpubPerChapterTexts = async (
    file: File,
    chapters: { hrefs: string[]; label: string }[],
): Promise<string[]> => {
    const ePub = await loadEpubFactory();
    const arrayBuffer = await file.arrayBuffer();
    const book = ePub(arrayBuffer);
    await book.ready;

    const results: string[] = [];
    for (const chapter of chapters) {
        const parts: string[] = [];
        for (const href of chapter.hrefs) {
            try {
                const doc = await book.load(href);
                if (doc && doc.body) {
                    parts.push(extractTextFromEpubBody(doc.body));
                }
            } catch (e) {
                console.warn(`EPUB: failed to extract text from "${href}" for chapter "${chapter.label}":`, e);
            }
        }
        results.push(parts.join('\n\n'));
    }

    book.destroy();
    return results;
};

/**
 * Extracts all text from every chapter of an EPUB file.
 */
const extractEpubFullText = async (file: File): Promise<string> => {
    const ePub = await loadEpubFactory();
    const arrayBuffer = await file.arrayBuffer();
    const book = ePub(arrayBuffer);
    await book.ready;

    const texts: Promise<string>[] = [];
    book.spine.each((section) => {
        const p = book.load(section.href).then((doc) => {
            if (doc && doc.body) return extractTextFromEpubBody(doc.body);
            return '';
        }).catch(() => '');
        texts.push(p);
    });

    const results = await Promise.all(texts);
    book.destroy();
    return results.join('\n\n');
};

/**
 * Universal loader based on file extension.
 */
export const loadFileContent = async (file: File): Promise<string> => {
    const extension = file.name.split('.').pop()!.toLowerCase();

    switch (extension) {
        case 'pdf':
            return await extractTextFromPDF(file);
        case 'docx':
            return await extractTextFromDOCX(file);
        case 'epub':
            return await extractEpubFullText(file);
        case 'txt':
        default:
            return await extractTextFromTXT(file);
    }
};
