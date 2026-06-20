import React, { useState } from 'react';
import { Upload, X, BookOpen, CheckSquare, Square, RotateCcw } from 'lucide-react';
import { loadFileContent, parseEpubChapters, extractEpubChaptersText } from '../utils/fileLoaders';
import { shouldSimplify } from '../utils/device';
import { getBookKey, getProgress } from '../utils/epubProgress';

const InputArea = ({ onTextSubmit }) => {
    const [text, setText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const simplified = shouldSimplify();

    const [epubData, setEpubData] = useState(null);
    const [epubFile, setEpubFile] = useState(null);
    const [selectedChapters, setSelectedChapters] = useState(new Set());
    const [isExtracting, setIsExtracting] = useState(false);
    const [resumeInfo, setResumeInfo] = useState(null);
    const [epubBookKey, setEpubBookKey] = useState(null);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsLoading(true);
        try {
            const extension = file.name.split('.').pop().toLowerCase();
            if (extension === 'epub') {
                const data = await parseEpubChapters(file);
                setEpubData(data);
                setEpubFile(file);
                setSelectedChapters(new Set(data.chapters.map((_, i) => i)));
                setText('');

                const bookKey = getBookKey(file, data);
                setEpubBookKey(bookKey);
                const saved = getProgress(bookKey);
                setResumeInfo(saved);
            } else {
                const content = await loadFileContent(file);
                setText(content);
                setEpubData(null);
                setEpubFile(null);
            }
        } catch (error) {
            console.error('Error loading file:', error);
            alert('Failed to load file. Try copying the text manually.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEpubSubmit = async (resumeWordIndex, resumeChapterIndices) => {
        if (!epubFile) return;
        const chaptersToUse = resumeChapterIndices || Array.from(selectedChapters);
        if (chaptersToUse.length === 0) return;
        setIsExtracting(true);
        try {
            const selected = chaptersToUse.map(i => epubData.chapters[i]);
            const text = await extractEpubChaptersText(epubFile, selected);
            const resumeIdx = typeof resumeWordIndex === 'number' ? resumeWordIndex : undefined;
            const selectedList = chaptersToUse.sort((a, b) => a - b);
            const selectedNames = selectedList.map(i => epubData.chapters[i]?.label || `Chapter ${i + 1}`);
            onTextSubmit(text, resumeIdx, epubBookKey, epubData.title, selectedList, selectedNames);
        } catch (error) {
            console.error('Error extracting EPUB text:', error);
            alert('Failed to extract text from EPUB.');
        } finally {
            setIsExtracting(false);
        }
    };

    const toggleChapter = (index) => {
        setSelectedChapters(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    const toggleAll = () => {
        if (!epubData) return;
        if (selectedChapters.size === epubData.chapters.length) {
            setSelectedChapters(new Set());
        } else {
            setSelectedChapters(new Set(epubData.chapters.map((_, i) => i)));
        }
    };

    const clearEpub = () => {
        setEpubData(null);
        setEpubFile(null);
        setSelectedChapters(new Set());
        setResumeInfo(null);
        setEpubBookKey(null);
    };

    const totalWords = epubData
        ? epubData.chapters.filter((_, i) => selectedChapters.has(i)).reduce((sum, c) => sum + c.wordCount, 0)
        : 0;

    return (
        <div className={`w-full max-w-[95vw] md:max-w-[75vw] mx-auto p-4 md:p-6 space-y-6 ${simplified ? '' : 'animate-in fade-in slide-in-from-bottom-4 duration-700'}`}>
            <div className="glass rounded-2xl md:rounded-3xl p-6 md:p-8 space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl md:text-2xl font-bold tracking-tight">Source Material</h2>
                    <div className="flex gap-2 md:gap-3">
                        <button
                            onClick={() => { setText(''); clearEpub(); }}
                            className="p-2 text-zinc-500 hover:text-white transition-colors"
                            title="Clear text"
                        >
                            <X size={20} />
                        </button>
                        <label className="flex items-center gap-2 px-3 md:px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-full cursor-pointer transition-all border border-zinc-700 text-xs md:text-sm font-medium">
                            <Upload size={14} className="md:w-4 md:h-4" />
                            <span>{isLoading ? 'Reading...' : 'Import File'}</span>
                            <input
                                type="file"
                                className="hidden"
                                accept=".txt,.pdf,.docx,.epub"
                                onChange={handleFileUpload}
                                disabled={isLoading}
                            />
                        </label>
                    </div>
                </div>

                {epubData ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
                            <BookOpen size={20} className="text-red-500 shrink-0" />
                            <div className="min-w-0">
                                <p className="font-bold text-zinc-200 truncate">{epubData.title}</p>
                                {epubData.author && (
                                    <p className="text-xs text-zinc-500 truncate">{epubData.author}</p>
                                )}
                            </div>
                            <button
                                onClick={clearEpub}
                                className="ml-auto p-1 text-zinc-500 hover:text-white transition-colors shrink-0"
                                title="Close EPUB"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {resumeInfo && (
                            <div className="flex flex-col gap-3 p-4 bg-red-500/10 rounded-xl border border-red-500/20">
                                <div className="flex items-center gap-3 min-w-0">
                                    <RotateCcw size={18} className="text-red-400 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-zinc-200">
                                            Resume reading?
                                        </p>
                                        <p className="text-xs text-zinc-500 truncate">
                                            <span className="text-zinc-400">
                                                {resumeInfo.selectedChapterNames?.length === 1
                                                    ? resumeInfo.selectedChapterNames[0]
                                                    : resumeInfo.selectedChapterNames?.length > 1
                                                        ? resumeInfo.selectedChapterNames.join(', ')
                                                        : resumeInfo.selectedChapters?.length > 0
                                                            ? `${resumeInfo.selectedChapters.length} chapters`
                                                            : 'All chapters'}
                                            </span>
                                            {' · '}
                                            Word {resumeInfo.wordIndex.toLocaleString()} of {resumeInfo.totalWords.toLocaleString()} ({Math.round((resumeInfo.wordIndex / resumeInfo.totalWords) * 100)}%)
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            handleEpubSubmit(resumeInfo.wordIndex, resumeInfo.selectedChapters);
                                        }}
                                        disabled={isExtracting}
                                        className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-all"
                                    >
                                        Resume
                                    </button>
                                    <button
                                        onClick={() => setResumeInfo(null)}
                                        className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-bold rounded-lg transition-all"
                                    >
                                        Start Fresh
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between">
                            <button
                                onClick={toggleAll}
                                className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition-colors"
                            >
                                {selectedChapters.size === epubData.chapters.length ? 'Deselect All' : 'Select All'}
                            </button>
                            <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">
                                {selectedChapters.size}/{epubData.chapters.length} chapters
                            </span>
                        </div>

                        <div className="max-h-64 overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
                            {epubData.chapters.map((chapter) => (
                                <button
                                    key={chapter.index}
                                    onClick={() => toggleChapter(chapter.index)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all text-sm ${
                                        selectedChapters.has(chapter.index)
                                            ? 'bg-zinc-800/80 text-zinc-100'
                                            : 'text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300'
                                    }`}
                                >
                                    {selectedChapters.has(chapter.index) ? (
                                        <CheckSquare size={16} className="text-red-500 shrink-0" />
                                    ) : (
                                        <Square size={16} className="shrink-0" />
                                    )}
                                    <span className="truncate flex-1">{chapter.label}</span>
                                    <span className="text-[10px] uppercase tracking-wider text-zinc-600 shrink-0">
                                        {chapter.wordCount.toLocaleString()}w
                                    </span>
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={handleEpubSubmit}
                            disabled={selectedChapters.size === 0 || isExtracting}
                            className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:hover:bg-red-600 text-white rounded-xl md:rounded-2xl font-bold text-lg transition-all active:scale-[0.98]"
                        >
                            {isExtracting ? 'Extracting...' : `Read Selected (${totalWords.toLocaleString()} words)`}
                        </button>
                    </div>
                ) : (
                    <>
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Paste your text here or upload a file..."
                            className="w-full h-64 md:h-80 bg-zinc-900/50 border border-zinc-800 rounded-xl md:rounded-2xl p-4 md:p-6 text-zinc-300 focus:outline-none focus:ring-2 focus:ring-red-600/50 focus:border-red-600/50 transition-all resize-none font-sans leading-relaxed text-sm md:text-base"
                        />

                        <button
                            onClick={() => onTextSubmit(text)}
                            disabled={!text.trim()}
                            className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:hover:bg-red-600 text-white rounded-xl md:rounded-2xl font-bold text-lg transition-all active:scale-[0.98]"
                        >
                            Start Reading
                        </button>
                    </>
                )}

                <p className="text-center text-xs text-zinc-500 font-medium">
                    Supports .txt, .pdf, .docx, and .epub files
                </p>
            </div>
        </div>
    );
};

export default InputArea;
