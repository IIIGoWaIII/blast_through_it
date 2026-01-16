import React, { useState } from 'react';
import { Upload, FileText, X } from 'lucide-react';
import { loadFileContent } from '../utils/fileLoaders';

const InputArea = ({ onTextSubmit }) => {
    const [text, setText] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsLoading(true);
        try {
            const content = await loadFileContent(file);
            setText(content);
        } catch (error) {
            console.error('Error loading file:', error);
            alert('Failed to load file. Try copying the text manually.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-[75vw] mx-auto p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="glass rounded-3xl p-8 space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold tracking-tight">Source Material</h2>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setText('')}
                            className="p-2 text-zinc-500 hover:text-white transition-colors"
                            title="Clear text"
                        >
                            <X size={20} />
                        </button>
                        <label className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-full cursor-pointer transition-all border border-zinc-700 text-sm font-medium">
                            <Upload size={16} />
                            <span>{isLoading ? 'Reading...' : 'Import File'}</span>
                            <input
                                type="file"
                                className="hidden"
                                accept=".txt,.pdf,.docx"
                                onChange={handleFileUpload}
                                disabled={isLoading}
                            />
                        </label>
                    </div>
                </div>

                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste your text here or upload a file..."
                    className="w-full h-80 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 text-zinc-300 focus:outline-none focus:ring-2 focus:ring-red-600/50 focus:border-red-600/50 transition-all resize-none font-sans leading-relaxed"
                />

                <button
                    onClick={() => onTextSubmit(text)}
                    disabled={!text.trim()}
                    className="w-full py-4 bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:hover:bg-red-600 text-white rounded-2xl font-bold text-lg transition-all shadow-lg active:scale-[0.98]"
                >
                    Start Reading
                </button>

                <p className="text-center text-xs text-zinc-500 font-medium">
                    Supports .txt, .pdf, and .docx files
                </p>
            </div>
        </div>
    );
};

export default InputArea;
