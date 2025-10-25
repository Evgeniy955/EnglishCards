import React, { useState } from 'react';
import { BookMarked, Loader2 } from 'lucide-react';

interface BuiltInDictionariesProps {
  onSelect: (name: string, wordsFile: File, sentencesFile?: File) => void;
}

// This list is configured to load the user's specific files.
// It assumes the word files are in /dictionaries and the sentence file in /sentences
const dictionaries = [
    { name: 'Food', wordsPath: '/dictionaries/Food.xlsx', sentencesPath: null },
    { name: 'List 1', wordsPath: '/dictionaries/List1.xlsx', sentencesPath: '/sentences/phrases1.json' },
    { name: 'List 2', wordsPath: '/dictionaries/List2.xlsx', sentencesPath: null },
    { name: 'List 3.1', wordsPath: '/dictionaries/List3.1.xlsx', sentencesPath: null },
    { name: 'List 4', wordsPath: '/dictionaries/List4.xlsx', sentencesPath: null },
    { name: 'List 5', wordsPath: '/dictionaries/List5.xlsx', sentencesPath: null },
    { name: 'List 6', wordsPath: '/dictionaries/List6.xlsx', sentencesPath: null },
    { name: 'List 7', wordsPath: '/dictionaries/List7.xlsx', sentencesPath: null },
    { name: 'List 8', wordsPath: '/dictionaries/List8.xlsx', sentencesPath: null },
];

export const BuiltInDictionaries: React.FC<BuiltInDictionariesProps> = ({ onSelect }) => {
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (dict: typeof dictionaries[0]) => {
    setIsDownloading(dict.name);
    setError(null);
    try {
      // Fetch the main words file
      const wordsResponse = await fetch(dict.wordsPath);
      if (!wordsResponse.ok) throw new Error(`Could not load ${dict.wordsPath}. Status: ${wordsResponse.status}`);
      const wordsBlob = await wordsResponse.blob();
      const wordsFile = new File([wordsBlob], dict.wordsPath.split('/').pop()!, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      // Fetch the optional sentences file
      let sentencesFile: File | undefined = undefined;
      if (dict.sentencesPath) {
        const sentencesResponse = await fetch(dict.sentencesPath);
        if (sentencesResponse.ok) {
            const sentencesBlob = await sentencesResponse.blob();
            sentencesFile = new File([sentencesBlob], dict.sentencesPath.split('/').pop()!, { type: 'application/json' });
        } else {
            console.warn(`Could not load optional sentences file: ${dict.sentencesPath}`);
        }
      }
      
      onSelect(dict.name, wordsFile, sentencesFile);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsDownloading(null);
    }
  };

  return (
    <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-400">Select a pre-packaged dictionary:</h3>
        <ul className="max-h-64 overflow-y-auto space-y-2 pr-2">
            {dictionaries.map(dict => (
                <li key={dict.name}>
                    <button
                        onClick={() => handleSelect(dict)}
                        disabled={!!isDownloading}
                        className="w-full flex items-center gap-3 p-3 text-left text-sm text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-md transition-colors disabled:opacity-50"
                    >
                         {isDownloading === dict.name ? (
                            <Loader2 className="animate-spin h-5 w-5 flex-shrink-0" />
                        ) : (
                            <BookMarked className="h-5 w-5 flex-shrink-0" />
                        )}
                        <span className="flex-grow">{dict.name}</span>
                    </button>
                </li>
            ))}
        </ul>
        {error && <p className="mt-2 text-xs text-red-400 text-center">{error}</p>}
    </div>
  );
};
