import React, { useState, useEffect, useRef } from 'react';
import ReaderDisplay from './components/ReaderDisplay';
import ControlBar from './components/ControlBar';
import InputArea from './components/InputArea';
import { parseTextToWords, getPauseForWord, calculateReadingTime, formatTime } from './utils/textParser';
import { ChevronLeft, Moon } from 'lucide-react';
import { shouldSimplify } from './utils/device';

function App() {
  const simplified = shouldSimplify();

  const [mode, setMode] = useState('input'); // 'input' or 'reader'
  const [text, setText] = useState('');
  const [words, setWords] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wpm, setWpm] = useState(300);
  const [nightMode, setNightMode] = useState(false);

  const timerRef = useRef(null);

  // Handle text submission from InputArea
  const handleTextSubmit = (submittedText) => {
    const parsedWords = parseTextToWords(submittedText);
    if (parsedWords.length > 0) {
      setWords(parsedWords);
      setText(submittedText);
      setCurrentIndex(0);
      setMode('reader');
    }
  };

  // Playback Logic
  useEffect(() => {
    if (isPlaying && currentIndex < words.length - 1) {
      const delay = (60 / wpm) * 1000 + getPauseForWord(words[currentIndex]);
      timerRef.current = setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
      }, delay);
    } else if (currentIndex >= words.length - 1) {
      setIsPlaying(false);
    }

    return () => clearTimeout(timerRef.current);
  }, [isPlaying, currentIndex, words, wpm]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger shortcuts if user is typing in the textarea
      if (mode === 'input' && document.activeElement.tagName === 'TEXTAREA') return;

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          setIsPlaying(prev => !prev);
          break;
        case 'd': // Faster
          setWpm(prev => Math.min(prev + 10, 1200));
          break;
        case 's': // Slower
          setWpm(prev => Math.max(prev - 10, 50));
          break;
        case 'n': // Night mode
          setNightMode(prev => !prev);
          break;
        case 'r': // Reset
          setCurrentIndex(0);
          setIsPlaying(false);
          break;
        case 'arrowleft':
          setCurrentIndex(prev => Math.max(0, prev - 1));
          setIsPlaying(false);
          break;
        case 'arrowright':
          setCurrentIndex(prev => Math.min(words.length - 1, prev + 1));
          setIsPlaying(false);
          break;
        case 'arrowup':
          setWpm(prev => Math.min(prev + 10, 1200));
          break;
        case 'arrowdown':
          setWpm(prev => Math.max(prev - 10, 50));
          break;
        case 'escape':
          if (mode === 'reader') setMode('input');
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode]);

  const handleProgressChange = (val) => {
    const newIndex = Math.floor((val / 100) * (words.length - 1));
    setCurrentIndex(newIndex);
  };

  const currentProgress = words.length > 0 ? (currentIndex / (words.length - 1)) * 100 : 0;

  const totalTime = formatTime(calculateReadingTime(words, wpm));
  const remainingTime = formatTime(calculateReadingTime(words.slice(currentIndex), wpm));

  const bgBlur = simplified ? '' : 'blur-[120px]';
  const animClass = simplified ? '' : 'animate-in fade-in zoom-in-95 duration-500';

  return (
    <div className="min-h-dvh w-full bg-zinc-950 text-zinc-100 font-sans selection:bg-red-500/30">
      {/* Background patterns */}
      {!simplified && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20">
          <div className={`absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-red-900/20 ${bgBlur} rounded-full`} />
          <div className={`absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-zinc-800/20 ${bgBlur} rounded-full`} />
        </div>
      )}

      {/* Night mode overlay */}
      {nightMode && (
        <div
          className="fixed inset-0 z-20 pointer-events-none bg-black/50"
          style={{ maskImage: 'radial-gradient(ellipse 35% 15% at 50% 50%, transparent 100%, black 100%)' }}
        />
      )}

      {/* Night mode toggle — reader mode only */}
      {mode === 'reader' && (
        <button
          onClick={() => setNightMode(prev => !prev)}
          className={`fixed top-4 right-4 z-40 w-12 h-12 md:w-10 md:h-10 rounded-xl flex items-center justify-center transition-all ${
            nightMode
              ? 'bg-yellow-400/20 text-yellow-400 border border-yellow-400/30'
              : 'bg-white/10 text-zinc-400 border border-white/10 hover:bg-white/20 hover:text-white'
          }`}
          aria-label="Toggle night reading mode"
        >
          <Moon size={22} fill={nightMode ? 'currentColor' : 'none'} />
        </button>
      )}

      <main className="relative z-10 container mx-auto flex flex-col items-center justify-center min-h-dvh py-6 md:py-12 px-4">
        {mode === 'input' ? (
          <InputArea onTextSubmit={handleTextSubmit} />
        ) : (
          <div className={`w-full flex flex-col items-center space-y-12 ${animClass}`}>
            {/* Header / Back button */}
            <div className="absolute top-4 left-4 md:top-8 md:left-8">
              <button
                onClick={() => setMode('input')}
                className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors group"
              >
                <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                <span className="font-medium">Back to Editor</span>
              </button>
            </div>

            {/* Reader Stage */}
            <ReaderDisplay word={words[currentIndex]} />

            {/* Controls */}
            <ControlBar
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying(!isPlaying)}
              wpm={wpm}
              onWpmChange={setWpm}
              progress={currentProgress}
              onProgressChange={handleProgressChange}
              remainingTime={remainingTime}
              onReset={() => {
                setCurrentIndex(0);
                setIsPlaying(false);
              }}
              onPrev={() => {
                setCurrentIndex(prev => Math.max(0, prev - 1));
                setIsPlaying(false);
              }}
              onNext={() => {
                setCurrentIndex(prev => Math.min(words.length - 1, prev + 1));
                setIsPlaying(false);
              }}
            />

            {/* Progress Stats */}
            <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-zinc-600">
              Word {currentIndex + 1} of {words.length} • {Math.round(currentProgress)}% Complete • {totalTime}
            </div>
          </div>
        )}
      </main>

      {/* Shortcuts Toast/Hint */}
      {mode === 'reader' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 hidden lg:flex gap-4 text-[10px] uppercase tracking-widest text-zinc-500 pointer-events-none transition-opacity hover:opacity-100 opacity-40">
          <span>[Space] Play/Pause</span>
          <span>[D] Faster</span>
          <span>[S] Slower</span>
          <span>[N] Night Mode</span>
          <span>[R] Reset</span>
          <span>[Esc] Editor</span>
        </div>
      )}
    </div>
  );
}

export default App;
