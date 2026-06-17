import React from 'react';
import { Play, Pause, RotateCcw, FastForward, Rewind, Plus, Minus } from 'lucide-react';

const ControlBar = ({
    isPlaying,
    onTogglePlay,
    wpm,
    onWpmChange,
    progress,
    onProgressChange,
    remainingTime,
    onReset,
    onPrev,
    onNext,
    nightMode,
    totalWords,
    currentIndex,
    onJumpToWord
}) => {
    const [jumpValue, setJumpValue] = React.useState('');

    const handleJumpSubmit = (e) => {
        if (e.key === 'Enter') {
            const num = parseInt(jumpValue, 10);
            if (!isNaN(num) && num >= 1 && num <= totalWords) {
                onJumpToWord(num);
                setJumpValue('');
                e.target.blur();
            }
        }
    };

    return (
        <div className="w-full max-w-[95vw] md:max-w-[75vw] mx-auto space-y-4 sm:space-y-6 md:space-y-8 px-4">
            {/* Playhead Slider + Jump Input */}
            <div className="flex items-center gap-3 progress-container">
                <div className="relative group flex-1">
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="0.1"
                        value={progress}
                        onChange={(e) => onProgressChange(parseFloat(e.target.value))}
                        className="w-full h-2 md:h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-600 transition-all md:group-hover:h-2"
                    />
                </div>
                <div className="flex items-center gap-1.5 text-zinc-500 text-xs shrink-0">
                    <span className="text-zinc-600 hidden sm:inline">Word</span>
                    <input
                        type="number"
                        min={1}
                        max={totalWords}
                        value={jumpValue}
                        onChange={(e) => setJumpValue(e.target.value)}
                        onKeyDown={handleJumpSubmit}
                        placeholder={`${currentIndex + 1}`}
                        className="w-16 md:w-14 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-center text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="text-zinc-600">/ {totalWords}</span>
                </div>
            </div>

            <div className={`space-y-4 sm:space-y-6 md:space-y-8 transition-opacity duration-300 ${nightMode ? 'opacity-5 hover:opacity-100' : ''}`}>
                <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-zinc-600 text-center">
                    {remainingTime}
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between gap-8 md:gap-0">
                {/* Playback Controls */}
                <div className="flex items-center gap-4 md:gap-6 order-2 md:order-1">
                    <button
                        onClick={onReset}
                        className="p-3 md:p-2 text-zinc-400 hover:text-white transition-colors"
                    >
                        <RotateCcw size={24} className="md:w-5 md:h-5" />
                    </button>

                    <button
                        onClick={onPrev}
                        className="p-3 md:p-2 text-zinc-400 hover:text-white transition-colors"
                    >
                        <Rewind size={24} className="md:w-5 md:h-5" fill="currentColor" />
                    </button>

                    <button
                        onClick={onTogglePlay}
                        className="w-16 h-16 md:w-14 md:h-14 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md"
                    >
                        {isPlaying ? <Pause size={32} className="md:w-7 md:h-7" fill="currentColor" /> : <Play size={32} className="md:w-7 md:h-7 translate-x-0.5" fill="currentColor" />}
                    </button>

                    <button
                        onClick={onNext}
                        className="p-3 md:p-2 text-zinc-400 hover:text-white transition-colors"
                    >
                        <FastForward size={24} className="md:w-5 md:h-5" fill="currentColor" />
                    </button>

                    <div className="hidden md:flex items-center gap-3">
                        <span className="text-2xl md:text-3xl font-bold tracking-tighter italic text-zinc-300 min-w-[3ch] text-center">
                            {wpm} <span className="text-xs md:text-sm not-italic opacity-50 uppercase tracking-widest ml-1">wpm</span>
                        </span>
                    </div>
                </div>

                {/* Mobile WPM Controls */}
                <div className="flex md:hidden flex-col items-center gap-4 sm:gap-6 order-3 w-full border-t border-white/5 pt-4 sm:pt-8">
                    <div className="flex items-center justify-between w-full px-4">
                        <button
                            onClick={() => onWpmChange(Math.max(wpm - 10, 50))}
                            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 active:bg-zinc-700 active:text-white transition-all active:scale-90"
                            aria-label="Decrease WPM"
                        >
                            <Minus size={32} strokeWidth={3} className="sm:w-10 sm:h-10" />
                        </button>

                        <div className="flex flex-col items-center">
                            <span className="text-4xl sm:text-5xl font-black tracking-tighter italic text-white">
                                {wpm}
                            </span>
                            <span className="text-[10px] sm:text-xs font-bold opacity-40 uppercase mx-5 tracking-[0.3em] mt-1 text-zinc-400">Words Per Minute</span>
                        </div>

                        <button
                            onClick={() => onWpmChange(Math.min(wpm + 10, 1200))}
                            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 active:bg-zinc-700 active:text-white transition-all active:scale-90"
                            aria-label="Increase WPM"
                        >
                            <Plus size={32} strokeWidth={3} className="sm:w-10 sm:h-10" />
                        </button>
                    </div>
                </div>

                {/* WPM Slider */}
                <div className="flex flex-col gap-2 w-full md:w-48 order-1 md:order-2">
                    <div className="flex justify-between text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                        <span>Slower (S)</span>
                        <span>Faster (D)</span>
                    </div>
                    <input
                        type="range"
                        min="50"
                        max="1200"
                        step="10"
                        value={wpm}
                        onChange={(e) => onWpmChange(parseInt(e.target.value))}
                        className="w-full h-2 md:h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-400"
                    />
                </div>
            </div>
            </div>
        </div>
    );
};

export default ControlBar;
