import React, { useState, useEffect, useRef } from 'react';
import ReaderDisplay from './components/ReaderDisplay';
import VisualPacerDisplay from './components/VisualPacerDisplay';
import ControlBar from './components/ControlBar';
import InputArea from './components/InputArea';
import { parseTextToWords, getPauseForWord, calculateReadingTime, formatTime } from './utils/textParser';
import { ChevronLeft, Moon, BookOpen, AlignLeft } from 'lucide-react';
import { shouldSimplify } from './utils/device';

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('blast-settings'));
    if (!saved) return {};
    return {
      wpm: typeof saved.wpm === 'number' && saved.wpm >= 50 && saved.wpm <= 1200 ? saved.wpm : undefined,
      readingMode: ['rsvp', 'visualPacer'].includes(saved.readingMode) ? saved.readingMode : undefined,
      pacerStyle: ['line', 'word'].includes(saved.pacerStyle) ? saved.pacerStyle : undefined,
    };
  } catch { return {}; }
}

function App() {
  const simplified = shouldSimplify();
  const settings = loadSettings();

  const [mode, setMode] = useState('input'); // 'input' or 'reader'
  const [text, setText] = useState('');
  const [words, setWords] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wpm, setWpm] = useState(settings.wpm ?? 300);
  const [nightMode, setNightMode] = useState(false);
  const [readingMode, setReadingMode] = useState(settings.readingMode ?? 'rsvp'); // 'rsvp' or 'visualPacer'
  const [pacerStyle, setPacerStyle] = useState(settings.pacerStyle ?? 'line'); // 'line' or 'word'

  const timerRef = useRef(null);

  // Persist reading settings
  useEffect(() => {
    localStorage.setItem('blast-settings', JSON.stringify({ wpm, readingMode, pacerStyle }));
  }, [wpm, readingMode, pacerStyle]);

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
      const delay = (60 / wpm) * 1000 + getPauseForWord(words[currentIndex], wpm);
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
      // Don't trigger shortcuts if user is typing in an input field
      const tag = document.activeElement.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;

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
        case 'v': // Toggle reading mode (RSVP vs Visual Pacer)
          setReadingMode(prev => prev === 'rsvp' ? 'visualPacer' : 'rsvp');
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

  const handleJumpToWord = (wordNumber) => {
    const idx = Math.max(0, Math.min(words.length - 1, wordNumber - 1));
    setCurrentIndex(idx);
    setIsPlaying(false);
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
      {/* Vignette removed as requested */}

      {/* Reader mode buttons — top right */}
      {mode === 'reader' && (
        <div className="fixed top-4 right-4 z-40 flex items-center gap-2">
          {/* Reading mode toggle (RSVP vs Visual Pacer) */}
          <button
            onClick={() => setReadingMode(prev => prev === 'rsvp' ? 'visualPacer' : 'rsvp')}
            className={`w-12 h-12 md:w-10 md:h-10 rounded-xl flex items-center justify-center transition-all ${
              readingMode === 'visualPacer'
                ? 'bg-red-500/20 text-red-500 border border-red-500/30'
                : 'bg-white/10 text-zinc-400 border border-white/10 hover:bg-white/20 hover:text-white'
            }`}
            aria-label="Toggle between RSVP and Visual Pacer"
            title={readingMode === 'rsvp' ? 'Switch to Visual Pacer' : 'Switch to RSVP'}
          >
            {readingMode === 'rsvp' ? <BookOpen size={22} /> : <AlignLeft size={22} />}
          </button>

          {/* Pacer style sub-toggle — only when visual pacer is active */}
          {readingMode === 'visualPacer' && (
            <button
              onClick={() => setPacerStyle(prev => prev === 'line' ? 'word' : 'line')}
              className="h-12 md:h-10 px-3 rounded-xl flex items-center gap-1.5 text-xs font-medium transition-all bg-white/10 text-zinc-400 border border-white/10 hover:bg-white/20 hover:text-white"
              aria-label={`Switch to ${pacerStyle === 'line' ? 'word' : 'line'} highlight`}
            >
              {pacerStyle === 'line' ? (
                <>
                  <AlignLeft size={14} />
                  <span className="hidden md:inline">Line</span>
                </>
              ) : (
                <>
                  <span className="inline-block w-3 h-3 rounded bg-red-500/60" />
                  <span className="hidden md:inline">Word</span>
                </>
              )}
            </button>
          )}

          {/* Night mode toggle */}
          <button
            onClick={() => setNightMode(prev => !prev)}
            className={`w-12 h-12 md:w-10 md:h-10 rounded-xl flex items-center justify-center transition-all ${
              nightMode
                ? 'bg-yellow-400/20 text-yellow-400 border border-yellow-400/30'
                : 'bg-white/10 text-zinc-400 border border-white/10 hover:bg-white/20 hover:text-white'
            }`}
            aria-label="Toggle night reading mode"
          >
            <Moon size={22} fill={nightMode ? 'currentColor' : 'none'} />
          </button>
        </div>
      )}

      <main className="relative z-10 container mx-auto flex flex-col items-center justify-center min-h-dvh py-2 sm:py-6 md:py-12 px-4">
        {mode === 'input' ? (
          <InputArea onTextSubmit={handleTextSubmit} />
        ) : (
          <div className={`w-full flex flex-col items-center space-y-4 sm:space-y-6 md:space-y-12 ${animClass}`}>
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
            {readingMode === 'rsvp' ? (
              <ReaderDisplay word={words[currentIndex]} />
            ) : (
              <VisualPacerDisplay
                text={text}
                currentIndex={currentIndex}
                pacerStyle={pacerStyle}
                isPlaying={isPlaying}
                wpm={wpm}
              />
            )}

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
              nightMode={nightMode}
              totalWords={words.length}
              currentIndex={currentIndex}
              onJumpToWord={handleJumpToWord}
            />

            {/* Progress Stats */}
            <div className={`text-[10px] uppercase tracking-[0.3em] font-bold text-zinc-600 transition-opacity duration-300 ${nightMode ? 'opacity-5 hover:opacity-100' : ''}`}>
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
          <span>[V] Pacer Mode</span>
          <span>[R] Reset</span>
          <span>[Esc] Editor</span>
        </div>
      )}
    </div>
  );
}

export default App;
