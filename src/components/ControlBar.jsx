import React from 'react';
import { Play, Pause, RotateCcw, FastForward, Rewind } from 'lucide-react';

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
        <div className="w-full max-w-[75vw] mx-auto space-y-6 px-4">
            {/* Playhead Slider */}
            <div className="relative group">
                <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.1"
                    value={progress}
                    onChange={(e) => onProgressChange(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-600 transition-all group-hover:h-2"
                />
            </div>

            <div className="flex items-center justify-between">
                {/* Playback Controls */}
                <div className="flex items-center gap-6">
                    <button
                        onClick={onReset}
                        className="p-2 text-zinc-400 hover:text-white transition-colors"
                    >
                        <RotateCcw size={20} />
                    </button>

                    <button
                        onClick={onPrev}
                        className="p-2 text-zinc-400 hover:text-white transition-colors"
                    >
                        <Rewind size={20} fill="currentColor" />
                    </button>

                    <button
                        onClick={onTogglePlay}
                        className="w-14 h-14 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl"
                    >
                        {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} className="translate-x-0.5" fill="currentColor" />}
                    </button>

                    <button
                        onClick={onNext}
                        className="p-2 text-zinc-400 hover:text-white transition-colors"
                    >
                        <FastForward size={20} fill="currentColor" />
                    </button>

                    <div className="flex flex-col">
                        <span className="text-3xl font-bold tracking-tighter italic text-zinc-300">
                            {wpm} <span className="text-sm not-italic opacity-50 uppercase tracking-widest ml-1">wpm</span>
                        </span>
                    </div>
                </div>

                {/* WPM Slider */}
                <div className="flex flex-col gap-2 w-48">
                    <div className="flex justify-between text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                        <span>Slower (S)</span>
                        <span>Faster (D)</span>
                    </div>
                    <input
                        type="range"
                        min="100"
                        max="1000"
                        step="10"
                        value={wpm}
                        onChange={(e) => onWpmChange(parseInt(e.target.value))}
                        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-zinc-400"
                    />
                </div>
            </div>
        </div>
    );
};

export default ControlBar;
