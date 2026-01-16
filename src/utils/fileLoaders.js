import * as pdfjs from 'pdfjs-dist';
import mammoth from 'mammoth';

// Set up pdfjs worker
// In a real Vite project, you might need to point to the worker file in node_modules
// or use a CDN version for simplicity in this environment.
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

/**
 * Extracts text from a PDF file.
 * @param {File} file 
 * @returns {Promise<string>}
 */
export const extractTextFromPDF = async (file) => {
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
        case 'txt':
        default:
            return await extractTextFromTXT(file);
    }
};
