import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Word, WordSet } from './types';
import { FileUpload } from './components/FileUpload';
import { SetSelector } from './components/SetSelector';
import { Flashcard } from './components/Flashcard';
import { WordList } from './components/WordList';
import { ProgressBar } from './components/ProgressBar';
import { SentenceUpload } from './components/SentenceUpload';
import { RefreshCw, BookOpen, BrainCircuit, X, FileUp } from 'lucide-react';

// This is required by the xlsx library
declare var XLSX: any;

const GLOBAL_SENTENCES_KEY = 'global_sentence_dictionary';

const App: React.FC = () => {
  const [wordSets, setWordSets] = useState<WordSet[] | null>(null);
  const [selectedSetIndex, setSelectedSetIndex] = useState<number | null>(null);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [unknownWords, setUnknownWords] = useState<Word[]>([]);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isTrainingUnknown, setIsTrainingUnknown] = useState(false);
  const [showAllWords, setShowAllWords] = useState(false);
  const [isSetFinished, setIsSetFinished] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentenceMap, setSentenceMap] = useState<Map<string, string>>(new Map());

  const currentWordList = useMemo(() => {
    if (selectedSetIndex === null || !wordSets) return [];
    return isTrainingUnknown ? unknownWords : wordSets[selectedSetIndex].words;
  }, [selectedSetIndex, wordSets, isTrainingUnknown, unknownWords]);

  const currentWord = useMemo(() => {
    return currentWordList[currentWordIndex] || null;
  }, [currentWordList, currentWordIndex]);

  const exampleSentence = useMemo(() => {
    if (!currentWord || sentenceMap.size === 0) return undefined;
    // Match case-insensitively
    return sentenceMap.get(currentWord.en.trim().toLowerCase());
  }, [currentWord, sentenceMap]);
  
  // Effect to load global sentences once after the main word file is parsed
  useEffect(() => {
    if (wordSets) {
      const storedSentences = localStorage.getItem(GLOBAL_SENTENCES_KEY);
      if (storedSentences) {
        try {
          const sentencesArray = JSON.parse(storedSentences);
          setSentenceMap(new Map(sentencesArray));
        } catch (e) {
          console.error("Failed to parse global stored sentences:", e);
          setSentenceMap(new Map());
        }
      } else {
        setSentenceMap(new Map());
      }
    }
  }, [wordSets]);


  // Effect to load unknown words for the currently selected set
  useEffect(() => {
    if (selectedSetIndex !== null && wordSets) {
      const storedUnknownWords = localStorage.getItem(`unknown_words_set_${selectedSetIndex}`);
      if (storedUnknownWords) {
        setUnknownWords(JSON.parse(storedUnknownWords));
      } else {
        setUnknownWords([]);
      }
    }
  }, [selectedSetIndex, wordSets]);

  const handleFileUpload = (file: File) => {
    setIsLoading(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: (string | null)[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (!jsonData || jsonData.length === 0) {
            throw new Error("The file is empty or could not be read.");
        }

        const tempSets: WordSet[] = [];
        const maxCols = jsonData.reduce((max, row) => (row ? Math.max(max, row.length) : max), 0);

        // A set is [Rus, Empty, Eng]. The next set is separated by an empty column.
        // So we step by 4 columns: [Rus, Empty, Eng, Empty Separator]
        for (let i = 0; i < maxCols; i += 4) {
            const ruColIndex = i;
            const enColIndex = i + 2;

            if (enColIndex >= maxCols) continue;

            const words: Word[] = [];
            jsonData.forEach(row => {
                if (!Array.isArray(row) || row.every(cell => cell == null || String(cell).trim() === '')) {
                    return; // Skip empty rows.
                }
                
                const ruWord = row[ruColIndex] != null ? String(row[ruColIndex]).trim() : '';
                const enWord = row[enColIndex] != null ? String(row[enColIndex]).trim() : '';

                if (ruWord && enWord) {
                    words.push({ ru: ruWord, en: enWord });
                }
            });

            if (words.length > 0) {
                // Temporarily add a dummy index, will be replaced later
                tempSets.push({ name: '', words: words, originalSetIndex: 0 });
            }
        }

        if (tempSets.length === 0) {
            throw new Error("No valid word sets found. Please ensure your file is formatted as [Russian, Empty, English], with an empty column separating each set.");
        }

        const parsedSets = tempSets.map((set, index) => ({
            ...set,
            name: `Set ${index + 1}`
        }));

        const finalSets: WordSet[] = [];
        const blockSize = 30;

        parsedSets.forEach((set, originalIndex) => {
          if (set.words.length <= blockSize) {
            finalSets.push({ ...set, originalSetIndex: originalIndex });
          } else {
            const numBlocks = Math.ceil(set.words.length / blockSize);
            for (let i = 0; i < numBlocks; i++) {
              const start = i * blockSize;
              const end = start + blockSize;
              const blockWords = set.words.slice(start, end);
              const blockName = `${set.name} (${start + 1}-${Math.min(end, set.words.length)})`;
              finalSets.push({ name: blockName, words: blockWords, originalSetIndex: originalIndex });
            }
          }
        });

        setWordSets(finalSets);
        setSelectedSetIndex(0);
        resetStateForNewSet();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse the file.");
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
        setError("Failed to read the file.");
        setIsLoading(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const resetStateForNewSet = () => {
    setCurrentWordIndex(0);
    setIsFlipped(false);
    setIsSetFinished(false);
    setIsTrainingUnknown(false);
    setShowAllWords(false);
  };
  
  const handleChangeFile = () => {
    setWordSets(null);
    setSelectedSetIndex(null);
    resetStateForNewSet();
    setError(null);
    setSentenceMap(new Map());
  };

  const handleSelectSet = (index: number) => {
    setSelectedSetIndex(index);
    resetStateForNewSet();
  };

  const handleKnow = () => {
    setIsFlipped(false); // Trigger the flip-back animation immediately.

    // Delay the logic for changing the word to allow the animation to happen.
    setTimeout(() => {
      if (isTrainingUnknown && currentWord && selectedSetIndex !== null) {
        // In training mode, remove the word from the list.
        const updatedUnknownWords = unknownWords.filter(
          (w) => w.ru !== currentWord.ru || w.en !== currentWord.en
        );
        setUnknownWords(updatedUnknownWords);
        localStorage.setItem(`unknown_words_set_${selectedSetIndex}`, JSON.stringify(updatedUnknownWords));
        
        // Check if the training is finished.
        if (currentWordIndex >= updatedUnknownWords.length) {
            setIsSetFinished(true);
        }
        // Note: We don't increment the index here because the array shifts.
      } else {
        // In normal mode, just advance to the next word.
        if (currentWordIndex < currentWordList.length - 1) {
          setCurrentWordIndex(currentWordIndex + 1);
        } else {
          setIsSetFinished(true);
        }
      }
    }, 250); // 250ms is half the flip animation time.
  };

  const handleDontKnow = () => {
    // If not in training mode, add the word to the "don't know" list.
    if (!isTrainingUnknown && currentWord && selectedSetIndex !== null) {
      const newUnknownWords = [...unknownWords];
      if (!newUnknownWords.some(w => w.ru === currentWord.ru && w.en === currentWord.en)) {
        newUnknownWords.push(currentWord);
      }
      setUnknownWords(newUnknownWords);
      localStorage.setItem(`unknown_words_set_${selectedSetIndex}`, JSON.stringify(newUnknownWords));
    }
  
    setIsFlipped(false); // Trigger the flip-back animation immediately.
  
    // Delay the logic for changing the word.
    setTimeout(() => {
      if (currentWordIndex < currentWordList.length - 1) {
          setCurrentWordIndex(currentWordIndex + 1);
      } else {
          setIsSetFinished(true);
      }
    }, 250);
  };
  
  const handleTrainUnknown = () => {
    if (unknownWords.length > 0) {
        resetStateForNewSet();
        setIsTrainingUnknown(true);
    }
  };

  const handleExitTraining = () => {
    resetStateForNewSet();
    setIsTrainingUnknown(false);
  };
  
  const handleSentencesLoaded = (newSentencesMap: Map<string, string>) => {
    const mergedMap = new Map([...sentenceMap, ...newSentencesMap]);
    const sentencesArray = Array.from(mergedMap.entries());
    localStorage.setItem(GLOBAL_SENTENCES_KEY, JSON.stringify(sentencesArray));
    setSentenceMap(mergedMap);
  };

  const handleClearSentences = () => {
    localStorage.removeItem(GLOBAL_SENTENCES_KEY);
    setSentenceMap(new Map());
  }

  const renderTrainer = () => {
    if (isSetFinished) {
      if (isTrainingUnknown) {
        if (unknownWords.length > 0) {
          return (
            <div className="text-center p-8 bg-slate-800 rounded-lg shadow-lg">
              <h2 className="text-2xl font-bold mb-4">
                Round Complete! You have {unknownWords.length} more words to master.
              </h2>
              <div className="flex flex-col sm:flex-row justify-center gap-4 mt-6">
                <button
                  onClick={() => {
                    setCurrentWordIndex(0);
                    setIsFlipped(false);
                    setIsSetFinished(false);
                  }}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-500 transition-colors"
                >
                  <RefreshCw size={20} /> Practice Remaining
                </button>
                <button onClick={handleExitTraining} className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-500 transition-colors">
                  <BookOpen size={20} /> Back to Full Set
                </button>
              </div>
            </div>
          );
        } else {
          return (
            <div className="text-center p-8 bg-slate-800 rounded-lg shadow-lg">
              <h2 className="text-2xl font-bold mb-4 text-emerald-400">
                Congratulations! You've learned all the difficult words.
              </h2>
              <button onClick={handleExitTraining} className="flex items-center justify-center gap-2 mt-6 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-500 transition-colors">
                <BookOpen size={20} /> Back to Full Set
              </button>
            </div>
          );
        }
      } else {
        return (
          <div className="text-center p-8 bg-slate-800 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-4">This was the last word from the set.</h2>
            <div className="flex flex-col sm:flex-row justify-center gap-4 mt-6">
              <button
                onClick={() => resetStateForNewSet()}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-500 transition-colors"
              >
                <RefreshCw size={20} /> Practice Again
              </button>
              {unknownWords.length > 0 && (
                <button
                  onClick={handleTrainUnknown}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 text-white font-semibold rounded-lg hover:bg-amber-500 transition-colors"
                >
                  <BrainCircuit size={20} /> Train "Don't know" ({unknownWords.length})
                </button>
              )}
            </div>
          </div>
        );
      }
    }

    if (!currentWord) {
        if (isTrainingUnknown && unknownWords.length === 0) {
            return <div className="text-center text-slate-400">Loading...</div>;
        }
        return <div className="text-center text-slate-400">Loading words...</div>;
    }

    return (
      <div className="w-full flex flex-col items-center">
        <div className="relative w-full max-w-md">
            {isTrainingUnknown && (
                <button onClick={handleExitTraining} className="absolute -top-12 right-0 flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
                    <X size={16} /> Exit Training
                </button>
            )}
             <p className="text-center text-slate-400">{currentWordIndex + 1} / {currentWordList.length}</p>
             <ProgressBar current={currentWordIndex + 1} total={currentWordList.length} />
        </div>
       
        <Flashcard word={currentWord} isFlipped={isFlipped} onFlip={() => setIsFlipped(!isFlipped)} exampleSentence={exampleSentence} />
        
        <div className={`transition-opacity duration-300 delay-200 w-full max-w-md mt-8 ${isFlipped ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="flex justify-center gap-4">
            <button onClick={handleDontKnow} className="w-1/2 py-3 px-6 bg-rose-600 text-white font-bold rounded-lg shadow-md hover:bg-rose-500 transition-transform transform hover:scale-105">
              Don't know
            </button>
            <button onClick={handleKnow} className="w-1/2 py-3 px-6 bg-emerald-600 text-white font-bold rounded-lg shadow-md hover:bg-emerald-500 transition-transform transform hover:scale-105">
              Know
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
      {wordSets === null ? (
        <>
          <FileUpload onFileUpload={handleFileUpload} isLoading={isLoading} />
          {error && <p className="mt-4 text-red-400 bg-red-900/50 p-3 rounded-md">{error}</p>}
        </>
      ) : (
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
          <div className="relative w-full text-center mb-6">
            <h1 className="text-4xl font-bold text-slate-100">Word Trainer</h1>
            <button 
              onClick={handleChangeFile}
              title="Load a different file"
              className="absolute top-1/2 right-0 -translate-y-1/2 p-2 text-slate-400 hover:text-white transition-colors"
            >
              <FileUp size={24} />
            </button>
          </div>
          {isTrainingUnknown && <p className="text-amber-400 mb-6 font-semibold">Training "Don't know" words ({unknownWords.length} left)</p>}

          <SetSelector sets={wordSets} selectedSetIndex={selectedSetIndex} onSelectSet={handleSelectSet} />

          {selectedSetIndex !== null && renderTrainer()}

          {selectedSetIndex !== null && wordSets[selectedSetIndex] && !isSetFinished && (
              <div className="mt-8 w-full max-w-md space-y-4">
                 <SentenceUpload 
                    onSentencesLoaded={handleSentencesLoaded} 
                    onClearSentences={handleClearSentences}
                    hasSentences={sentenceMap.size > 0}
                 />
                <button onClick={() => setShowAllWords(!showAllWords)} className="w-full flex justify-center items-center gap-2 py-2 text-slate-400 hover:text-white transition-colors">
                  <BookOpen size={16}/> Show all words
                </button>
                <WordList words={wordSets[selectedSetIndex].words} isVisible={showAllWords} />
              </div>
            )}
        </div>
      )}
    </main>
  );
};

export default App;