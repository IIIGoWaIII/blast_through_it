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

    const tocLabelByHref = {};
    function flattenToc(items) {
        for (const item of items) {
            if (item.href) {
                const baseHref = item.href.split('#')[0];
                if (!(baseHref in tocLabelByHref)) {
                    tocLabelByHref[baseHref] = item.label;
                }
            }
            if (item.subitems?.length) flattenToc(item.subitems);
        }
    }
    if (book.navigation?.toc) flattenToc(book.navigation.toc);

    const chapters = [];
    book.spine.each((section) => {
        const label = tocLabelByHref[section.href];
        if (label) {
            chapters.push({
                index: chapters.length,
                label,
                hrefs: [section.href],
                wordCount: 0,
            });
        } else if (chapters.length > 0) {
            chapters[chapters.length - 1].hrefs.push(section.href);
        }
    });

    for (const chapter of chapters) {
        let totalWords = 0;
        for (const href of chapter.hrefs) {
            try {
                const doc = await book.load(href);
                if (doc && doc.body) {
                    const text = doc.body.textContent || '';
                    totalWords += text.trim().split(/\s+/).filter(Boolean).length;
                }
            } catch {
                // Skip sections that fail to load
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
                    texts.push(doc.body.textContent || '');
                }
            } catch {
                // Skip sections that fail to load
            }
        }
    }

    book.destroy();
    return texts.join('\n\n');
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
            if (doc && doc.body) return doc.body.textContent || '';
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
