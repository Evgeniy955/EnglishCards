import React, { useState, useEffect } from 'react';
import { ChevronsUpDown, Upload, FileUp, Repeat } from 'lucide-react';
import * as XLSX from 'xlsx';
import { SetSelector } from './components/SetSelector';
import { Flashcard } from './components/Flashcard';
import { ProgressBar } from './components/ProgressBar';
import { WordList } from './components/WordList';
import { SentenceUpload } from './components/SentenceUpload';
import { FileSourceModal } from './components/FileSourceModal';
import type { Word, WordSet, LoadedDictionary } from './types';

const MAX_WORDS_PER_BLOCK = 30;

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
    const [unknownWords, setUnknownWords] = useState<Word[]>([]);
    const [isTraining, setIsTraining] = useState(false);
    const [isSetFinished, setIsSetFinished] = useState(false);
    const [sentences, setSentences] = useState<Map<string, string>>(new Map());

    const currentSet = loadedDictionary && selectedSetIndex !== null ? loadedDictionary.sets[selectedSetIndex] : null;
    const wordsForCurrentMode = isTraining ? unknownWords : currentSet?.words || [];
    const currentWord = wordsForCurrentMode[currentWordIndex];
    
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
      const isFinished = currentWordIndex >= wordsForCurrentMode.length;
      if (isFinished && wordsForCurrentMode.length > 0) {
        setIsSetFinished(true);
      }
    }, [currentWordIndex, wordsForCurrentMode]);

    // --- File & Data Handling ---
    const resetState = () => {
        setLoadedDictionary(null);
        setSelectedSetIndex(null);
        setCurrentWordIndex(0);
        setIsFlipped(false);
        setUnknownWords([]);
        setIsTraining(false);
        setIsSetFinished(false);
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
                handleSelectSet(0, newDictionary.sets, newDictionary.name);
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

    const getUnknownWordsKey = (dictionaryName: string, originalSetIdx: number) => `unknown_words_${dictionaryName}_${originalSetIdx}`;
    
    const loadUnknownWords = (sets: WordSet[], setIndex: number, dictName: string) => {
        const set = sets[setIndex];
        if (!set || !dictName) return [];
        const key = getUnknownWordsKey(dictName, set.originalSetIndex);
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : [];
    };

    const saveUnknownWords = (words: Word[]) => {
      if (!loadedDictionary || !currentSet) return;
      const key = getUnknownWordsKey(loadedDictionary.name, currentSet.originalSetIndex);
      localStorage.setItem(key, JSON.stringify(words));
    };

    // --- User Actions ---
    const handleKnow = () => {
        if (!currentWord) return;
        setIsFlipped(false);
        setTimeout(() => {
          if (isTraining) {
              const updatedUnknown = unknownWords.filter(w => w.en !== currentWord.en || w.ru !== currentWord.ru);
              saveUnknownWords(updatedUnknown);
              setUnknownWords(updatedUnknown);
              // If the last unknown word was just learned, end the set.
              if (updatedUnknown.length === 0) {
                  setIsSetFinished(true);
              }
          } else {
              setCurrentWordIndex(prev => prev + 1);
          }
        }, 250); // Delay to allow flip animation
    };

    const handleDontKnow = () => {
      if (!currentWord) return;
      setIsFlipped(false);
      setTimeout(() => {
        if (!isTraining) {
            setUnknownWords(prev => {
                const isAlreadyInList = prev.some(w => w.en === currentWord.en && w.ru === currentWord.ru);
                const newUnknowns = isAlreadyInList ? prev : [...prev, currentWord];
                saveUnknownWords(newUnknowns);
                return newUnknowns;
            });
        }
        setCurrentWordIndex(prev => prev + 1);
      }, 250);
    };

    const handleSelectSet = (index: number, sets = loadedDictionary?.sets, dictName = loadedDictionary?.name) => {
        if (!sets || !dictName) return;
        setSelectedSetIndex(index);
        setCurrentWordIndex(0);
        setIsFlipped(false);
        setIsSetFinished(false);
        setIsTraining(false);
        setUnknownWords(loadUnknownWords(sets, index, dictName));
    };

    const startTraining = () => {
      if (!loadedDictionary || !currentSet) return;
      const wordsToTrain = loadUnknownWords(loadedDictionary.sets, selectedSetIndex!, loadedDictionary.name);
      setUnknownWords(wordsToTrain);
      setIsTraining(true);
      setCurrentWordIndex(0);
      setIsSetFinished(false);
    };

    const handleReturnToSetSelection = () => {
      setSelectedSetIndex(null); // Deselect the current set to show the selector
      setIsSetFinished(false);   // Hide the finished screen
      setCurrentWordIndex(0);    // Reset index
      setIsTraining(false);      // Exit training mode if active
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
        const loadedUnknowns = currentSet ? loadUnknownWords(loadedDictionary.sets, selectedSetIndex!, loadedDictionary.name) : [];
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
                  <p className="text-emerald-400 mb-6">The words are finished. Well done! Please select a new set.</p>
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
                  <button
                      onClick={() => setIsFileModalOpen(true)}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                  >
                      <Upload size={16} /> Change Dictionary
                  </button>
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
                  <button
                      onClick={() => setIsFileModalOpen(true)}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                  >
                      <Upload size={16} /> Change Dictionary
                  </button>
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
                              <ProgressBar current={currentWordIndex + 1} total={wordsForCurrentMode.length} />
                              <div className="flex justify-between items-center text-sm text-slate-400">
                                  <span>{currentWordIndex + 1} / {wordsForCurrentMode.length}</span>
                                  {!isTraining && (
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setShowWordList(!showWordList)} title="Toggle Word List" className="p-2 rounded-full hover:bg-slate-800 transition-colors"><ChevronsUpDown size={18} /></button>
                                    </div>
                                  )}
                              </div>
                          </div>
  
                          <div className="flex items-center gap-4 mt-6">
                             <button
                                onClick={handleDontKnow}
                                className="px-6 py-3 bg-rose-800 hover:bg-rose-700 rounded-lg font-semibold transition-colors w-36 text-center"
                              >
                                Don't know
                              </button>
                              <button
                                onClick={handleKnow}
                                className="px-6 py-3 bg-emerald-800 hover:bg-emerald-700 rounded-lg font-semibold transition-colors w-36 text-center"
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
                      <p className="text-slate-400 mt-8">Loading words...</p>
                  )}
              </main>
          </div>
      );
    };

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
        <FileSourceModal
            isOpen={isFileModalOpen}
            onClose={() => setIsFileModalOpen(false)}
            onFilesSelect={handleFilesSelect}
            isLoading={isLoading}
        />
        {renderContent()}
      </div>
    );
};

export default App;