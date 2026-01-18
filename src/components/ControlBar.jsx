import React from 'react';
import { Play, Pause, RotateCcw, FastForward, Rewind, Plus, Minus } from 'lucide-react';

const ControlBar = ({
    isPlaying,
    onTogglePlay,
    wpm,
    onWpmChange,
    progress,
    onProgressChange,
    onReset,
    onPrev,
    onNext
}) => {
    return (
        <div className="w-full max-w-[95vw] md:max-w-[75vw] mx-auto space-y-6 md:space-y-8 px-4">
            {/* Playhead Slider */}
            <div className="relative group progress-container">
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
                        className="w-16 h-16 md:w-14 md:h-14 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl"
                    >
                        {isPlaying ? <Pause size={32} className="md:w-7 md:h-7" fill="currentColor" /> : <Play size={32} className="md:w-7 md:h-7 translate-x-0.5" fill="currentColor" />}
                    </button>

                    <button
                        onClick={onNext}
                        className="p-3 md:p-2 text-zinc-400 hover:text-white transition-colors"
                    >
                        <FastForward size={24} className="md:w-5 md:h-5" fill="currentColor" />
                    </button>

                    <div className="flex items-center gap-3 ml-2 md:ml-0">
                        <button
                            onClick={() => onWpmChange(Math.max(wpm - 10, 50))}
                            className="flex md:hidden w-10 h-10 rounded-full bg-zinc-800 items-center justify-center text-zinc-400 active:bg-zinc-700 active:text-white transition-colors"
                            aria-label="Decrease WPM"
                        >
                            <Minus size={20} />
                        </button>
                        
                        <span className="text-2xl md:text-3xl font-bold tracking-tighter italic text-zinc-300 min-w-[3ch] text-center">
                            {wpm} <span className="text-xs md:text-sm not-italic opacity-50 uppercase tracking-widest ml-1">wpm</span>
                        </span>

                        <button
                            onClick={() => onWpmChange(Math.min(wpm + 10, 1200))}
                            className="flex md:hidden w-10 h-10 rounded-full bg-zinc-800 items-center justify-center text-zinc-400 active:bg-zinc-700 active:text-white transition-colors"
                            aria-label="Increase WPM"
                        >
                            <Plus size={20} />
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
    );
};

export default ControlBar;
