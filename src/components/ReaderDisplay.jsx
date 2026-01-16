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
    const fontSize = "3.5rem";

    return (
        <div className="relative w-[75vw] mx-auto h-80 flex flex-col items-center justify-center select-none overflow-hidden px-4 reader-container">
            {/* Top Guide */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[2px] h-12 bg-zinc-700 reader-guide z-20" />

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
            <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-[2px] h-12 bg-zinc-700 reader-guide z-20" />
        </div>
    );
};

export default ReaderDisplay;
