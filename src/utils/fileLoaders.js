/**
 * Extracts text from a PDF file.
 * @param {File} file 
 * @returns {Promise<string>}
 */
export const extractTextFromPDF = async (file) => {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map(item => item.str);
        fullText += strings.join(' ') + '\n';
    }

    return fullText;
};

/**
 * Extracts text from a DOCX file.
 * @param {File} file 
 * @returns {Promise<string>}
 */
export const extractTextFromDOCX = async (file) => {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
};

/**
 * Reads a TXT file as a string.
 * @param {File} file 
 * @returns {Promise<string>}
 */
export const extractTextFromTXT = async (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
};

const EPUB_BLOCK_TAGS = new Set([
    'ADDRESS',
    'ARTICLE',
    'ASIDE',
    'BLOCKQUOTE',
    'BR',
    'DD',
    'DIV',
    'DL',
    'DT',
    'FIGCAPTION',
    'FIGURE',
    'FOOTER',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'HEADER',
    'HR',
    'LI',
    'MAIN',
    'NAV',
    'OL',
    'P',
    'PRE',
    'SECTION',
    'TABLE',
    'TD',
    'TH',
    'TR',
    'UL',
]);

const appendBreak = (parts) => {
    if (parts.length > 0 && parts[parts.length - 1] !== '\n') {
        parts.push('\n');
    }
};

/**
 * Parses CSS text into an array of rules, each mapping class names to properties.
 * Handles @media blocks by extracting their inner rules.
 */
const parseCssText = (cssText) => {
    const cleaned = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
    let expanded = cleaned;
    const mediaRe = /@media[^{]*\{([\s\S]*?)\}/g;
    let m;
    while ((m = mediaRe.exec(cleaned)) !== null) {
        expanded += ' ' + m[1];
    }
    const rules = [];
    const ruleRe = /([^{}]+)\{([^{}]+)\}/g;
    let match;
    while ((match = ruleRe.exec(expanded)) !== null) {
        const selector = match[1].trim();
        const body = match[2].trim();
        if (selector.startsWith('@')) continue;
        const props = {};
        const propRe = /([\w-]+)\s*:\s*([^;]+)/g;
        let pm;
        while ((pm = propRe.exec(body)) !== null) {
            props[pm[1].trim()] = pm[2].trim();
        }
        const classes = [];
        const classRe = /\.([\w-]+)/g;
        let cm;
        while ((cm = classRe.exec(selector)) !== null) {
            classes.push(cm[1]);
        }
        if (classes.length > 0) {
            rules.push({ classes, props });
        }
    }
    return rules;
};

/**
 * Resolves image layout metadata from its nearest block ancestor's CSS context.
 */
const resolveImageLayout = (parentClasses, parentInlineStyle, cssRules) => {
    const layout = { align: 'center', maxWidth: null, fullWidth: false };
    const props = {};
    for (const rule of cssRules) {
        if (rule.classes.some(c => parentClasses.includes(c))) {
            Object.assign(props, rule.props);
        }
    }
    if (parentInlineStyle) {
        const inlineRe = /([\w-]+)\s*:\s*([^;]+)/g;
        let m;
        while ((m = inlineRe.exec(parentInlineStyle)) !== null) {
            props[m[1].trim()] = m[2].trim();
        }
    }
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
 * E.g., "../Text/ch1.xhtml" → "Text/ch1.xhtml", "./Text/ch1.xhtml" → "Text/ch1.xhtml"
 */
const normalizeEpubPath = (path) => {
    let decoded;
    try { decoded = decodeURIComponent(path); } catch { decoded = path; }
    const parts = decoded.split('/');
    const resolved = [];
    for (const part of parts) {
        if (part === '..') {
            resolved.pop();
        } else if (part !== '.' && part !== '') {
            resolved.push(part);
        }
    }
    return resolved.join('/');
};

/**
 * Extracts just the filename from a path (e.g., "Text/ch1.xhtml" → "ch1.xhtml").
 */


const extractTextFromEpubBody = (body) => {
    const parts = [];

    const walk = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            parts.push(node.textContent.replace(/\s+/g, ' '));
            return;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const tagName = node.tagName;
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
 * Parses an EPUB file and returns chapter metadata.
 * @param {File} file
 * @returns {Promise<{title: string, author: string, chapters: {index: number, label: string, wordCount: number}[]}>}
 */
export const parseEpubChapters = async (file) => {
    const ePub = (await import('epubjs')).default;
    const arrayBuffer = await file.arrayBuffer();
    const book = ePub(arrayBuffer);
    await book.ready;

    const metadata = book.packaging.metadata || {};
    const title = metadata.title || file.name.replace(/\.epub$/i, '');
    const author = metadata.creator || '';

    // Collect all spine hrefs in reading order
    const spineHrefs = [];
    book.spine.each((section) => {
        spineHrefs.push(section.href);
    });

    // Flatten TOC into an ordered list of { label, href } entries
    const tocEntries = [];
    function flattenToc(items) {
        for (const item of items) {
            if (item.href) {
                const baseHref = normalizeEpubPath(item.href.split('#')[0]);
                tocEntries.push({ label: item.label, href: baseHref });
            }
            if (item.subitems?.length) flattenToc(item.subitems);
        }
    }
    if (book.navigation?.toc) flattenToc(book.navigation.toc);

    // If there's no TOC or it has no entries, put everything in one chapter
    if (tocEntries.length === 0) {
        const chapters = [{
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

    // Build chapters directly from TOC entries
    const chapters = tocEntries.map((entry, i) => ({
        index: i,
        label: entry.label,
        hrefs: [entry.href],
        wordCount: 0,
    }));

    // Group spine sections not covered by any TOC entry
    const coveredHrefs = new Set(chapters.flatMap(c => c.hrefs));

    // Collect spine sections that appear BEFORE the first TOC entry
    const leadingOrphans = [];
    for (const href of spineHrefs) {
        if (coveredHrefs.has(normalizeEpubPath(href))) break;
        leadingOrphans.push(href);
    }

    // Prepend an "Introduction" chapter for leading orphans
    if (leadingOrphans.length > 0) {
        chapters.unshift({
            index: 0,
            label: 'Introduction',
            hrefs: leadingOrphans,
            wordCount: 0,
        });
        // Re-index chapters
        chapters.forEach((ch, i) => ch.index = i);
    }

    // Group remaining orphan sections (between or after TOC entries) into nearest chapter
    for (const href of spineHrefs) {
        if (coveredHrefs.has(normalizeEpubPath(href))) continue;
        if (leadingOrphans.includes(href)) continue;

        const spineIdx = spineHrefs.indexOf(href);
        let bestChapter = chapters[chapters.length - 1];
        for (let i = chapters.length - 1; i >= 0; i--) {
            const chapterHrefs = chapters[i].hrefs.map(h => spineHrefs.indexOf(h)).filter(idx => idx >= 0);
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
                    // Also count SVG <image> and <img> tags that DOM walk misses
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
 * @param {File} file
 * @param {number[]} indices - Chapter indices to extract (from parseEpubChapters)
 * @returns {Promise<string>}
 */
export const extractEpubChaptersText = async (file, chapters) => {
    const ePub = (await import('epubjs')).default;
    const arrayBuffer = await file.arrayBuffer();
    const book = ePub(arrayBuffer);
    await book.ready;

    const texts = [];
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
 * Images are converted to data URLs and referenced via ¶IMG:N¶ tokens in the text.
 * Each image entry includes layout metadata resolved from the epub's CSS.
 * @param {File} file
 * @param {{hrefs: string[], label: string}[]} chapters
 * @returns {Promise<{text: string, images: {src: string, align: string, maxWidth: string|null, fullWidth: boolean, inline: boolean}[]}>}
 */
export const extractEpubContentWithImages = async (file, chapters) => {
    const ePub = (await import('epubjs')).default;
    const arrayBuffer = await file.arrayBuffer();
    const book = ePub(arrayBuffer);
    await book.ready;

    const images = [];
    const imageIndexBySrc = new Map();
    const cssRules = [];
    const loadedCssHrefs = new Set();

    const resolveImgSrc = (src, baseHref) => {
        try {
            const baseParts = baseHref.split('/');
            baseParts.pop();
            const srcParts = src.split('/');
            const resolved = [...baseParts, ...srcParts];
            const final = [];
            for (const part of resolved) {
                if (part === '..') final.pop();
                else if (part !== '.' && part !== '') final.push(part);
            }
            return final.join('/');
        } catch {
            return src;
        }
    };

    const getImageToken = async (src, baseHref, layout) => {
        const resolved = resolveImgSrc(src, baseHref);
        if (imageIndexBySrc.has(resolved)) {
            return `¶IMG:${imageIndexBySrc.get(resolved)}¶`;
        }
        try {
            let dataUrl = null;
            if (book.archive && typeof book.archive.getBlob === 'function') {
                const blob = await book.archive.getBlob('/' + resolved);
                if (blob) {
                    dataUrl = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
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

    const extractTextAndImagesFromBody = async (body, baseHref) => {
        const parts = [];

        const walk = async (node, blockCtx) => {
            if (node.nodeType === Node.TEXT_NODE) {
                parts.push(node.textContent.replace(/\s+/g, ' '));
                return;
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return;

            const tagName = node.tagName;

            if (tagName === 'IMG') {
                const imgSrc = node.getAttribute('src');
                if (imgSrc) {
                    const layout = blockCtx
                        ? resolveImageLayout(blockCtx.classes, blockCtx.inlineStyle, cssRules)
                        : { align: 'center', maxWidth: null, fullWidth: false, inline: false };
                    const token = await getImageToken(imgSrc, baseHref, layout);
                    if (token) {
                        parts.push(` ${token} `);
                    }
                }
                return;
            }

            const isBlock = EPUB_BLOCK_TAGS.has(tagName);
            if (isBlock) appendBreak(parts);

            const childCtx = isBlock
                ? { classes: Array.from(node.classList || []), inlineStyle: node.getAttribute('style') || '' }
                : blockCtx;

            for (const child of node.childNodes) {
                await walk(child, childCtx);
            }

            if (isBlock) appendBreak(parts);
        };

        await walk(body, null);

        // Fallback: scan raw HTML for SVG <image> tags that the DOM walk misses
        // due to XML namespace issues in epubjs-loaded documents
        const html = body.innerHTML || '';
        const svgImageRe = /<image\b[^>]*(?:xlink:)?href="([^"]+)"/gi;
        let match;
        const svgSrcs = [];
        while ((match = svgImageRe.exec(html)) !== null) {
            const before = html.substring(0, match.index);
            const tagMatch = before.match(/<(?:div|p|figure|section|td)[^>]*class="([^"]*)"[^>]*>\s*$/i);
            const parentClasses = tagMatch ? tagMatch[1].split(/\s+/) : [];
            svgSrcs.push({ src: match[1], layout: resolveImageLayout(parentClasses, '', cssRules) });
        }
        for (const { src, layout } of svgSrcs) {
            const token = await getImageToken(src, baseHref, layout);
            if (token) {
                parts.push(` ${token} `);
            }
        }

        return parts
            .join('')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n[ \t]+/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .replace(/\s+¶IMG:/g, ' ¶IMG:')
            .replace(/¶IMG:(\d+)¶\s+/g, '¶IMG:$1¶ ')
            .trim();
    };

    // Load CSS from chapter link tags
    const loadCssForChapter = async (href) => {
        try {
            const doc = await book.load(href);
            if (!doc) return;
            const links = doc.querySelectorAll('link[rel="stylesheet"], link[type="text/css"]');
            for (const link of links) {
                const cssHref = link.getAttribute('href');
                if (!cssHref || loadedCssHrefs.has(cssHref)) continue;
                loadedCssHrefs.add(cssHref);
                const resolved = resolveImgSrc(cssHref, href);
                try {
                    if (book.archive && typeof book.archive.getText === 'function') {
                        const text = await book.archive.getText('/' + resolved);
                        if (text) {
                            cssRules.push(...parseCssText(text));
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

    const texts = [];
    for (const chapter of chapters) {
        for (const href of chapter.hrefs) {
            try {
                const doc = await book.load(href);
                if (doc && doc.body) {
                    texts.push(await extractTextAndImagesFromBody(doc.body, href));
                }
            } catch (e) {
                console.warn(`EPUB: failed to extract content from "${href}" for chapter "${chapter.label}":`, e);
            }
        }
    }

    book.destroy();
    return { text: texts.join('\n\n'), images };
};

/**
 * Extracts text from each chapter separately, returning per-chapter texts.
 * @param {File} file
 * @param {{hrefs: string[]}[]} chapters
 * @returns {Promise<string[]>}
 */
export const extractEpubPerChapterTexts = async (file, chapters) => {
    const ePub = (await import('epubjs')).default;
    const arrayBuffer = await file.arrayBuffer();
    const book = ePub(arrayBuffer);
    await book.ready;

    const results = [];
    for (const chapter of chapters) {
        const parts = [];
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
 * Used as fallback when loadFileContent is called directly.
 * @param {File} file
 * @returns {Promise<string>}
 */
const extractEpubFullText = async (file) => {
    const ePub = (await import('epubjs')).default;
    const arrayBuffer = await file.arrayBuffer();
    const book = ePub(arrayBuffer);
    await book.ready;

    const texts = [];
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
 * @param {File} file 
 * @returns {Promise<string>}
 */
export const loadFileContent = async (file) => {
    const extension = file.name.split('.').pop().toLowerCase();

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
