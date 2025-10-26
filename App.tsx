import React, { useState, useEffect } from 'react';
import { ChevronsUpDown, Upload, FileUp, Repeat, ArrowLeft, RotateCcw, BookCheck } from 'lucide-react';
import * as XLSX from 'xlsx';
import { SetSelector } from './components/SetSelector';
import { Flashcard } from './components/Flashcard';
import { ProgressBar } from './components/ProgressBar';
import { WordList } from './components/WordList';
import { SentenceUpload } from './components/SentenceUpload';
import { FileSourceModal } from './components/FileSourceModal';
import { InstructionsModal } from './components/InstructionsModal';
import { LearnedWordsModal } from './components/LearnedWordsModal';
import type { Word, WordSet, LoadedDictionary, WordProgress } from './types';

const MAX_WORDS_PER_BLOCK = 30;

// Intervals in days for the spaced repetition system.
// Stage 1 review is after 1 day, Stage 2 after 3 days, etc.
const SRS_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60, 90, 180, 365];

// ----- SRS & Unknown Words Helper Functions -----
const getSrsKey = (dictionaryName: string, originalSetIdx: number) => `srs_progress_${dictionaryName}_${originalSetIdx}`;
const getUnknownWordsKey = (dictionaryName: string, originalSetIdx: number) => `unknown_words_${dictionaryName}_${originalSetIdx}`;


const loadSrsProgress = (dictName: string, originalSetIdx: number): Map<string, WordProgress> => {
    if (!dictName) return new Map();
    try {
        const key = getSrsKey(dictName, originalSetIdx);
        const stored = localStorage.getItem(key);
        if (stored) {
            // Reconstruct Map from stored array
            return new Map(JSON.parse(stored));
        }
    } catch (error) {
        console.error("Failed to load or parse SRS progress:", error);
    }
    return new Map();
};

const saveSrsProgress = (dictName: string, originalSetIdx: number, progressMap: Map<string, WordProgress>) => {
    if (!dictName) return;
    try {
        const key = getSrsKey(dictName, originalSetIdx);
        // Convert Map to array for JSON serialization
        const serialized = JSON.stringify(Array.from(progressMap.entries()));
        localStorage.setItem(key, serialized);
    } catch (error) {
        console.error("Failed to save SRS progress:", error);
    }
};


// ----- Main App Component -----
const App: React.FC = () => {
    // --- State Management ---
    const [loadedDictionary, setLoadedDictionary] = useState<LoadedDictionary | null>(null);
    const [selectedSetIndex, setSelectedSetIndex] = useState<number | null>(null);
    const [currentWordIndex, setCurrentWordIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showWordList, setShowWordList] = useState(false);
    const [isFileModalOpen, setIsFileModalOpen] = useState(false);
    const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false);
    const [isLearnedWordsModalOpen, setIsLearnedWordsModalOpen] = useState(false);
    const [allLearnedWords, setAllLearnedWords] = useState<(Word & { progress: WordProgress })[]>([]);
    const [unknownWords, setUnknownWords] = useState<Word[]>([]);
    const [isTraining, setIsTraining] = useState(false);
    const [isSetFinished, setIsSetFinished] = useState(false);
    const [sentences, setSentences] = useState<Map<string, string>>(new Map());
    const [sessionWords, setSessionWords] = useState<Word[]>([]);
    const [history, setHistory] = useState<number[]>([]);
    const [srsProgress, setSrsProgress] = useState<Map<string, WordProgress>>(new Map());
    const [isProcessing, setIsProcessing] = useState(false);

    const currentSet = loadedDictionary && selectedSetIndex !== null ? loadedDictionary.sets[selectedSetIndex] : null;
    const currentWord = sessionWords[currentWordIndex];
    
    // --- Effects ---
    // Auto-load default sentences on first launch
    useEffect(() => {
        const storedSentences = localStorage.getItem('global_sentence_dictionary');
        if (storedSentences) {
            setSentences(new Map(JSON.parse(storedSentences)));
        } else {
            // Pre-load default sentences if none exist
            fetch('/sentences/phrases1.json')
                .then(res => {
                    if (res.ok) return res.json();
                    // Don't throw error, just fail silently if not present
                    console.warn('Default sentences file (phrases1.json) not found.');
                    return null;
                })
                .then(jsonObj => {
                    if (!jsonObj) return;
                    const sentenceMap = new Map<string, string>();
                    for (const key in jsonObj) {
                        if (typeof jsonObj[key] === 'string') {
                            sentenceMap.set(key.trim().toLowerCase(), jsonObj[key]);
                        }
                    }
                    if (sentenceMap.size > 0) {
                        setSentences(sentenceMap);
                        localStorage.setItem('global_sentence_dictionary', JSON.stringify(Array.from(sentenceMap.entries())));
                    }
                })
                .catch(err => console.error("Could not pre-load sentences:", err));
        }
    }, []);

    // Check if the set is finished
    useEffect(() => {
      const isFinished = currentWordIndex >= sessionWords.length;
      if (isFinished && sessionWords.length > 0) {
        setIsSetFinished(true);
      }
    }, [currentWordIndex, sessionWords]);

    // --- File & Data Handling ---
    const resetState = () => {
        setLoadedDictionary(null);
        setSelectedSetIndex(null);
        setCurrentWordIndex(0);
        setIsFlipped(false);
        setUnknownWords([]);
        setIsTraining(false);
        setIsSetFinished(false);
        setSessionWords([]);
        setHistory([]);
        setSrsProgress(new Map());
    };

    const processWordFile = async (file: File): Promise<WordSet[]> => {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const allSets: WordSet[] = [];
      let originalSetCounter = 0;

      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (!jsonData || jsonData.length === 0) return;
        
        const maxCols = Math.max(...jsonData.map(row => row.length));

        // A valid set is considered to be at least 3 columns wide (Ru - Empty - En)
        for (let col = 0; col <= maxCols - 3; col += 4) {
          const wordsInSet: Word[] = [];
          
          for (const row of jsonData) {
            const ru = String(row[col] || '').trim();
            const en = String(row[col + 2] || '').trim();
            if (ru && en) {
              wordsInSet.push({ ru, en });
            }
          }

          if (wordsInSet.length > 0) {
            if (wordsInSet.length > MAX_WORDS_PER_BLOCK) {
              for (let i = 0; i < wordsInSet.length; i += MAX_WORDS_PER_BLOCK) {
                const chunk = wordsInSet.slice(i, i + MAX_WORDS_PER_BLOCK);
                allSets.push({
                  name: `Set ${originalSetCounter + 1} (${i + 1}-${i + chunk.length})`,
                  words: chunk,
                  originalSetIndex: originalSetCounter
                });
              }
            } else {
              allSets.push({
                name: `Set ${originalSetCounter + 1}`,
                words: wordsInSet,
                originalSetIndex: originalSetCounter
              });
            }
            originalSetCounter++;
          }
        }
      });
      return allSets;
    };
    
    const processSentenceFile = async (file: File): Promise<Map<string, string>> => {
      const sentenceMap = new Map<string, string>();
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        const jsonObj = JSON.parse(text);
        for (const key in jsonObj) {
          if (typeof jsonObj[key] === 'string') {
            sentenceMap.set(key.trim().toLowerCase(), jsonObj[key]);
          }
        }
      } else if (file.name.endsWith('.xlsx')) {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: string[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        jsonData.forEach(row => {
          if (row && row[0] && row[1]) {
            sentenceMap.set(String(row[0]).trim().toLowerCase(), String(row[1]).trim());
          }
        });
      }
      return sentenceMap;
    };

    const handleFilesSelect = async (name: string, wordsFile: File, sentencesFile?: File) => {
        setIsLoading(true);
        resetState();
        try {
            const wordSetsFromFile = await processWordFile(wordsFile);
            if (wordSetsFromFile.length > 0) {
                const newDictionary = { name, sets: wordSetsFromFile };
                setLoadedDictionary(newDictionary);
                // Immediately and explicitly select the first set.
                handleSelectSet(0, newDictionary);
            } else {
                alert("No valid words found. Ensure format is 'Russian - Empty Column - English'.");
            }

            if (sentencesFile) {
              const newSentences = await processSentenceFile(sentencesFile);
              handleSentencesLoaded(newSentences);
            }
        } catch (error) {
            console.error("Error processing files:", error);
            alert("Failed to process files.");
        } finally {
            setIsLoading(false);
            setIsFileModalOpen(false);
        }
    };
    
    const handleSentencesLoaded = (newSentences: Map<string, string>) => {
      setSentences(prevSentences => {
          const merged = new Map([...prevSentences, ...newSentences]);
          localStorage.setItem('global_sentence_dictionary', JSON.stringify(Array.from(merged.entries())));
          return merged;
      });
    };

    const handleClearSentences = () => {
        setSentences(new Map());
        localStorage.removeItem('global_sentence_dictionary');
    };

    const loadUnknownWordsForSet = (dict: LoadedDictionary, setIndex: number): Word[] => {
        const set = dict.sets[setIndex];
        if (!set || !dict.name) return [];
        const key = getUnknownWordsKey(dict.name, set.originalSetIndex);
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : [];
    };

    const saveUnknownWordsForSet = (words: Word[]) => {
      if (!loadedDictionary || !currentSet) return;
      const key = getUnknownWordsKey(loadedDictionary.name, currentSet.originalSetIndex);
      localStorage.setItem(key, JSON.stringify(words));
    };

    // --- User Actions ---
    const handlePrevious = () => {
      if (history.length === 0 || isProcessing) return;
      setIsProcessing(true);
      const newHistory = [...history];
      const previousIndex = newHistory.pop();
      if (previousIndex !== undefined) {
        setHistory(newHistory);
        setCurrentWordIndex(previousIndex);
        setIsFlipped(false);
      }
      setIsProcessing(false);
    };
    
    const handleShuffle = () => {
      if (sessionWords.length < 2) return;
      const shuffledWords = [...sessionWords].sort(() => Math.random() - 0.5);
      setSessionWords(shuffledWords);
      setCurrentWordIndex(0);
      setIsFlipped(false);
      setIsSetFinished(false);
      setHistory([]);
    };

    const handleKnow = () => {
        if (!currentWord || !loadedDictionary || !currentSet || isProcessing) return;
        setIsProcessing(true);

        // --- Update SRS Progress ---
        const currentProgress = srsProgress.get(currentWord.en) || { srsStage: 0, nextReviewDate: new Date().toISOString() };
        const newStage = Math.min(currentProgress.srsStage + 1, SRS_INTERVALS_DAYS.length);
        const intervalDays = SRS_INTERVALS_DAYS[newStage - 1];

        const nextReviewDate = new Date();
        nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays);

        const updatedProgress: WordProgress = { srsStage: newStage, nextReviewDate: nextReviewDate.toISOString() };
        const newProgressMap = new Map(srsProgress);
        newProgressMap.set(currentWord.en, updatedProgress);
        setSrsProgress(newProgressMap);
        saveSrsProgress(loadedDictionary.name, currentSet.originalSetIndex, newProgressMap);
        
        setHistory(prev => [...prev, currentWordIndex]);
        setIsFlipped(false);
        setTimeout(() => {
          if (isTraining) {
              const updatedUnknown = unknownWords.filter(w => w.en !== currentWord.en || w.ru !== currentWord.ru);
              saveUnknownWordsForSet(updatedUnknown);
              setUnknownWords(updatedUnknown);
              setSessionWords(prev => prev.filter(w => w.en !== currentWord.en || w.ru !== currentWord.ru));
              
              if (updatedUnknown.length === 0) {
                  setIsSetFinished(true);
              }
          } else {
              setCurrentWordIndex(prev => prev + 1);
          }
          setIsProcessing(false);
        }, 250); // Delay to allow flip animation
    };

    const handleDontKnow = () => {
      if (!currentWord || !loadedDictionary || !currentSet || isProcessing) return;
      setIsProcessing(true);

       // --- Reset SRS Progress for this word ---
      const newProgressMap = new Map(srsProgress);
      if (newProgressMap.has(currentWord.en)) {
        const updatedProgress: WordProgress = { srsStage: 0, nextReviewDate: new Date().toISOString() };
        newProgressMap.set(currentWord.en, updatedProgress);
        setSrsProgress(newProgressMap);
        saveSrsProgress(loadedDictionary.name, currentSet.originalSetIndex, newProgressMap);
      }

      setHistory(prev => [...prev, currentWordIndex]);
      setIsFlipped(false);
      setTimeout(() => {
        if (!isTraining) {
            setUnknownWords(prev => {
                const isAlreadyInList = prev.some(w => w.en === currentWord.en && w.ru === currentWord.ru);
                const newUnknowns = isAlreadyInList ? prev : [...prev, currentWord];
                saveUnknownWordsForSet(newUnknowns);
                return newUnknowns;
            });
        }
        setCurrentWordIndex(prev => prev + 1);
        setIsProcessing(false);
      }, 250);
    };

    const handleSelectSet = (index: number, dict = loadedDictionary) => {
        if (!dict) return;
        
        const set = dict.sets[index];
        const progressMap = loadSrsProgress(dict.name, set.originalSetIndex);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const wordsForReview = set.words.filter(word => {
            const progress = progressMap.get(word.en);
            if (!progress) return true; // New word
            const reviewDate = new Date(progress.nextReviewDate);
            return reviewDate <= today; // Word is due for review
        });
        
        const shuffledWords = wordsForReview.sort(() => Math.random() - 0.5);

        setSelectedSetIndex(index);
        setCurrentWordIndex(0);
        setIsFlipped(false);
        setIsSetFinished(false);
        setIsTraining(false);
        setSessionWords(shuffledWords);
        setUnknownWords(loadUnknownWordsForSet(dict, index));
        setHistory([]);
        setSrsProgress(progressMap);
    };

    const startTraining = () => {
      if (!loadedDictionary || selectedSetIndex === null) return;
      const wordsToTrain = loadUnknownWordsForSet(loadedDictionary, selectedSetIndex);
      const shuffledWords = [...wordsToTrain].sort(() => Math.random() - 0.5);
      
      setUnknownWords(wordsToTrain);
      setSessionWords(shuffledWords);
      setIsTraining(true);
      setCurrentWordIndex(0);
      setIsSetFinished(false);
      setHistory([]);
    };

    const handleReturnToSetSelection = () => {
      setSelectedSetIndex(null); 
      setIsSetFinished(false);   
      setCurrentWordIndex(0);    
      setIsTraining(false);      
    };
    
    const handleResetAllProgress = () => {
        if (!loadedDictionary || !window.confirm("Are you sure you want to reset all learning progress for this dictionary? This cannot be undone.")) {
            return;
        }
    
        // 1. Forcefully clear all localStorage keys related to this dictionary.
        const dictName = loadedDictionary.name;
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith(`srs_progress_${dictName}_`) || key.startsWith(`unknown_words_${dictName}_`))) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
    
        // 2. Clear the in-memory state for learned words and close the modal if open.
        setAllLearnedWords([]);
        if (isLearnedWordsModalOpen) {
            setIsLearnedWordsModalOpen(false);
        }
    
        // 3. Directly reset the state of the currently active set to its initial state.
        if (selectedSetIndex !== null) {
            const set = loadedDictionary.sets[selectedSetIndex];
            const allWordsShuffled = [...set.words].sort(() => Math.random() - 0.5);
            
            setSessionWords(allWordsShuffled);
            setSrsProgress(new Map());
            setUnknownWords([]);
            setCurrentWordIndex(0);
            setIsFlipped(false);
            setIsSetFinished(false);
            setIsTraining(false);
            setHistory([]);
        }
        
        alert("Learning progress has been reset.");
    };

    const handleShowLearnedWords = () => {
        if (!loadedDictionary) return;

        const learnedWordsMap = new Map<string, Word & { progress: WordProgress }>();
        const originalSets: { [key: number]: WordSet[] } = {};

        // Group sets by their original index
        loadedDictionary.sets.forEach(set => {
            if (!originalSets[set.originalSetIndex]) {
                originalSets[set.originalSetIndex] = [];
            }
            originalSets[set.originalSetIndex].push(set);
        });

        // Iterate over each original set group
        for (const originalIndex in originalSets) {
            const progressMap = loadSrsProgress(loadedDictionary.name, parseInt(originalIndex));
            if (progressMap.size > 0) {
                // Check words from all chunks of this original set
                originalSets[originalIndex].forEach(setChunk => {
                    setChunk.words.forEach(word => {
                        const progress = progressMap.get(word.en);
                        if (progress && progress.srsStage > 0) {
                           learnedWordsMap.set(word.en, { ...word, progress });
                        }
                    });
                });
            }
        }
        
        const sortedLearnedWords = Array.from(learnedWordsMap.values()).sort((a, b) => a.ru.localeCompare(b.ru));
        setAllLearnedWords(sortedLearnedWords);
        setIsLearnedWordsModalOpen(true);
    };


    // --- Render Logic ---
    const renderContent = () => {
      if (!loadedDictionary) {
        return (
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-bold mb-2">Flashcard Trainer</h1>
            <p className="text-slate-400 mb-8">Your personal tool for mastering new words.</p>
            <button
              onClick={() => setIsFileModalOpen(true)}
              className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-lg rounded-lg font-semibold transition-colors flex items-center gap-3 shadow-lg mx-auto"
            >
              <FileUp size={20} /> Get Started
            </button>
          </div>
        );
      }
      
      // Finished Screen
      if (isSetFinished) {
        const loadedUnknowns = (selectedSetIndex !== null) ? loadUnknownWordsForSet(loadedDictionary, selectedSetIndex) : [];
        const hasUnknowns = loadedUnknowns.length > 0;
        
        return (
          <div className="text-center">
             <h1 className="text-2xl font-bold text-slate-200 text-center mb-6">{loadedDictionary.name}</h1>
            <h2 className="text-3xl font-bold mb-4">{isTraining ? "Practice Round Finished!" : "Set Finished!"}</h2>
            {isTraining && hasUnknowns && <p className="text-slate-400 mb-6">{loadedUnknowns.length} word(s) still to learn.</p>}
            
            {hasUnknowns ? (
               <button
                  onClick={startTraining}
                  className="px-6 py-3 bg-rose-600 hover:bg-rose-700 rounded-lg font-semibold transition-colors flex items-center gap-2 mx-auto"
                >
                  <Repeat size={18} /> {isTraining ? 'Practice Again' : `Train ${loadedUnknowns.length} "Don't Know" word(s)`}
                </button>
            ) : (
               <>
                  <p className="text-emerald-400 mb-6">{isTraining ? 'Well done! No more unknown words in this set.' : 'Congratulations! All words reviewed.'}</p>
                  <button
                      onClick={handleReturnToSetSelection}
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold transition-colors flex items-center gap-2 mx-auto"
                  >
                      Select New Set
                  </button>
               </>
            )}
          </div>
        );
      }
  
      // Main trainer view when no specific set is selected yet
      if (selectedSetIndex === null) {
        return (
          <div className="w-full max-w-2xl">
              <header className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                  <h1 className="text-2xl font-bold text-slate-200 text-center">{loadedDictionary.name}</h1>
                   <div className="flex items-center gap-2">
                      <button
                          onClick={handleShowLearnedWords}
                          className="px-4 py-2 bg-sky-700 hover:bg-sky-600 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 focus:ring-offset-slate-900"
                          title="View all learned words"
                      >
                          <BookCheck size={16} /> Learned Words
                      </button>
                      <button
                          onClick={handleResetAllProgress}
                          className="px-4 py-2 bg-rose-700 hover:bg-rose-600 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 focus:ring-offset-slate-900"
                          title="Reset all learning progress for this dictionary"
                      >
                          <RotateCcw size={16} /> Reset
                      </button>
                      <button
                          onClick={() => setIsFileModalOpen(true)}
                          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                      >
                          <Upload size={16} /> Change Dictionary
                      </button>
                  </div>
              </header>
              <main className="flex flex-col items-center">
                <SetSelector
                  sets={loadedDictionary.sets}
                  selectedSetIndex={selectedSetIndex}
                  onSelectSet={handleSelectSet}
                />
                <p className="text-slate-400">Please select a set to begin.</p>
              </main>
          </div>
        );
      }


      return (
          <div className="w-full max-w-2xl">
              <header className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                  <h1 className="text-2xl font-bold text-slate-200 text-center">{loadedDictionary.name}</h1>
                  <div className="flex items-center gap-2">
                       <button
                          onClick={handleShowLearnedWords}
                          className="px-4 py-2 bg-sky-700 hover:bg-sky-600 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 focus:ring-offset-slate-900"
                          title="View all learned words"
                      >
                          <BookCheck size={16} /> Learned
                      </button>
                      <button
                          onClick={handleResetAllProgress}
                          className="px-4 py-2 bg-rose-700 hover:bg-rose-600 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 focus:ring-offset-slate-900"
                          title="Reset all learning progress for this dictionary"
                      >
                          <RotateCcw size={16} /> Reset
                      </button>
                      <button
                          onClick={() => setIsFileModalOpen(true)}
                          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                      >
                          <Upload size={16} /> Change
                      </button>
                  </div>
              </header>
  
              <main className="flex flex-col items-center">
                  {!isTraining && (
                    <SetSelector
                      sets={loadedDictionary.sets}
                      selectedSetIndex={selectedSetIndex}
                      onSelectSet={handleSelectSet}
                    />
                  )}
                  {isTraining && <h2 className="text-xl font-semibold text-rose-400 mb-6">Training Mode</h2>}
                  
                  {currentSet && currentWord ? (
                      <>
                          <Flashcard 
                              word={currentWord} 
                              isFlipped={isFlipped} 
                              onFlip={() => setIsFlipped(!isFlipped)} 
                              exampleSentence={sentences.get(currentWord.en.toLowerCase().trim())}
                          />
  
                          <div className="w-full max-w-md mt-6">
                              <ProgressBar current={currentWordIndex + 1} total={sessionWords.length} />
                              <div className="flex justify-between items-center text-sm text-slate-400">
                                  <span>{currentWordIndex + 1} / {sessionWords.length}</span>
                                  <div className="flex items-center gap-1">
                                      <button
                                        onClick={handleShuffle}
                                        title="Shuffle Words"
                                        className="p-2 rounded-full hover:bg-slate-800 transition-colors"
                                        aria-label="Shuffle current set"
                                      >
                                        <Repeat size={18} />
                                      </button>
                                      {!isTraining && (
                                        <button onClick={() => setShowWordList(!showWordList)} title="Toggle Word List" className="p-2 rounded-full hover:bg-slate-800 transition-colors">
                                          <ChevronsUpDown size={18} />
                                        </button>
                                      )}
                                  </div>
                              </div>
                          </div>
  
                          <div className="flex items-center gap-4 mt-6 w-full max-w-md">
                             <button
                                onClick={handlePrevious}
                                disabled={history.length === 0 || isProcessing}
                                className="p-4 rounded-full bg-slate-700 hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-wait"
                                aria-label="Previous card"
                              >
                                <ArrowLeft size={24} />
                              </button>
                              <button
                                onClick={handleDontKnow}
                                disabled={isProcessing}
                                className="flex-1 px-6 py-3 bg-rose-800 hover:bg-rose-700 rounded-lg font-semibold transition-colors text-center disabled:opacity-50 disabled:cursor-wait"
                              >
                                Don't know
                              </button>
                              <button
                                onClick={handleKnow}
                                disabled={isProcessing}
                                className="flex-1 px-6 py-3 bg-emerald-800 hover:bg-emerald-700 rounded-lg font-semibold transition-colors text-center disabled:opacity-50 disabled:cursor-wait"
                              >
                                Know
                              </button>
                          </div>
  
                          <div className="w-full max-w-md mt-8">
                              <WordList words={currentSet.words} isVisible={showWordList && !isTraining} />
                          </div>
                          
                          <div className="w-full max-w-md mt-8 p-4 bg-slate-800 rounded-lg">
                            <SentenceUpload 
                                onSentencesLoaded={handleSentencesLoaded}
                                onClearSentences={handleClearSentences}
                                hasSentences={sentences.size > 0}
                            />
                          </div>
  
                      </>
                  ) : (
                      <p className="text-slate-400 mt-8">No words to review in this set for today. Well done!</p>
                  )}
              </main>
          </div>
      );
    };

    return (
      <div className="min-h-screen flex flex-col p-4 sm:p-6 md:p-8">
        <FileSourceModal
            isOpen={isFileModalOpen}
            onClose={() => setIsFileModalOpen(false)}
            onFilesSelect={handleFilesSelect}
            isLoading={isLoading}
        />
        <InstructionsModal
            isOpen={isInstructionsModalOpen}
            onClose={() => setIsInstructionsModalOpen(false)}
        />
        <LearnedWordsModal
            isOpen={isLearnedWordsModalOpen}
            onClose={() => setIsLearnedWordsModalOpen(false)}
            learnedWords={allLearnedWords}
        />
        <main className="flex-grow flex flex-col items-center justify-center">
          {renderContent()}
        </main>
        <footer className="w-full text-center py-2">
            <button
              onClick={() => setIsInstructionsModalOpen(true)}
              className="text-sm text-slate-500 hover:text-indigo-400 transition-colors underline"
            >
              Інструкція з використання (українською)
            </button>
        </footer>
      </div>
    );
};

export default App;
