import React from 'react';
import { splitWordAtOrp } from '../utils/textParser';

const ReaderDisplay = ({ word }) => {
    if (!word) return (
        <div className="h-64 flex items-center justify-center text-zinc-500 italic">
            Paste text or import a file to begin
        </div>
    );

    const { pre, orp, post } = splitWordAtOrp(word);

    // Reduced font size by 50% per user request
    // Responsive font size using clamp, reduced by 25% for mobile per user request
    const fontSize = "clamp(1.125rem, 6vw, 3.5rem)";

    return (
        <div className="relative w-full max-w-[95vw] md:max-w-[75vw] mx-auto h-64 md:h-80 flex flex-col items-center justify-center select-none overflow-hidden px-4">
            {/* Top Guide */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[2px] h-8 md:h-12 bg-zinc-700 z-20" />

            {/* Word Container */}
            <div
                className="relative flex items-center justify-center w-full font-serif tracking-tight whitespace-nowrap transition-all duration-75"
                style={{ fontSize: fontSize }}
            >
                {/* The ORP is the anchor in the exact center */}
                <div className="relative flex items-center justify-center">
                    {/* Pre-ORP: Absolutely positioned to the left of the center */}
                    <div className="absolute right-full text-zinc-400 text-right pr-[0.02em]">
                        {pre}
                    </div>

                    {/* ORP: The focus red letter, centered */}
                    <div className="text-red-600 font-bold px-[0.025em]">
                        {orp}
                    </div>

                    {/* Post-ORP: Absolutely positioned to the right of the center */}
                    <div className="absolute left-full text-zinc-200 text-left pl-[0.02em]">
                        {post}
                    </div>
                </div>
            </div>

            {/* Bottom Guide */}
            <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-[2px] h-8 md:h-12 bg-zinc-700 z-20" />
        </div>
    );
};

export default ReaderDisplay;
