import React, { useState, useEffect, useRef } from 'react';
import ReaderDisplay from './components/ReaderDisplay';
import ControlBar from './components/ControlBar';
import InputArea from './components/InputArea';
import { parseTextToWords } from './utils/textParser';
import { ChevronLeft } from 'lucide-react';

function App() {
  const [mode, setMode] = useState('input'); // 'input' or 'reader'
  const [text, setText] = useState('');
  const [words, setWords] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wpm, setWpm] = useState(300);

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
      const delay = (60 / wpm) * 1000;
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
          setWpm(prev => Math.min(prev + 25, 1200));
          break;
        case 's': // Slower
          setWpm(prev => Math.max(prev - 25, 50));
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
          setWpm(prev => Math.min(prev + 25, 1200));
          break;
        case 'arrowdown':
          setWpm(prev => Math.max(prev - 25, 50));
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

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-100 font-sans selection:bg-red-500/30">
      {/* Background patterns */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-red-900/20 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-zinc-800/20 blur-[120px] rounded-full" />
      </div>

      <main className="relative z-10 container mx-auto flex flex-col items-center justify-center min-h-screen py-6 md:py-12 px-4">
        {mode === 'input' ? (
          <InputArea onTextSubmit={handleTextSubmit} />
        ) : (
          <div className="w-full flex flex-col items-center space-y-12 animate-in fade-in zoom-in-95 duration-500">
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
              Word {currentIndex + 1} of {words.length} • {Math.round(currentProgress)}% Complete
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
          <span>[R] Reset</span>
          <span>[Esc] Editor</span>
        </div>
      )}
    </div>
  );
}

export default App;
