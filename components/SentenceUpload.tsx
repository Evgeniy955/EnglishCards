import React, { useCallback, useState } from 'react';
import { BookText, UploadCloud } from 'lucide-react';
import * as XLSX from 'xlsx';

interface SentenceUploadProps {
  onSentencesLoaded: (map: Map<string, string>) => void;
  onClearSentences: () => void;
  hasSentences: boolean;
}

export const SentenceUpload: React.FC<SentenceUploadProps> = ({ onSentencesLoaded, onClearSentences, hasSentences }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      parseFile(file);
    }
    // Reset the input value to allow uploading the same file again
    event.target.value = '';
  };

  const parseFile = (file: File) => {
    setIsLoading(true);
    setError(null);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const sentenceMap = new Map<string, string>();
        if (file.name.endsWith('.json')) {
          const text = e.target?.result as string;
          const jsonObj = JSON.parse(text);
          if (typeof jsonObj !== 'object' || jsonObj === null) {
            throw new Error('Invalid JSON format. Expected an object.');
          }
          for (const key in jsonObj) {
            if (typeof jsonObj[key] === 'string') {
              // Store keys in lowercase for case-insensitive matching
              sentenceMap.set(key.trim().toLowerCase(), jsonObj[key]);
            }
          }
        } else if (file.name.endsWith('.xlsx')) {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData: (string | null)[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          jsonData.forEach(row => {
            if (row && row[0] && row[1]) {
              const enWord = String(row[0]).trim().toLowerCase();
              const sentence = String(row[1]).trim();
              if (enWord && sentence) {
                sentenceMap.set(enWord, sentence);
              }
            }
          });
        } else {
            throw new Error('Unsupported file type. Please use .json or .xlsx');
        }

        if(sentenceMap.size === 0) {
            throw new Error('No sentences found in the file.');
        }

        onSentencesLoaded(sentenceMap);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse sentences file.');
      } finally {
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
        setError('Failed to read the file.');
        setIsLoading(false);
    };

    if (file.name.endsWith('.json')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  return (
    <div className="w-full">
      {hasSentences ? (
        <div className="flex items-center justify-between">
          <span className="text-emerald-400 flex items-center gap-2">
            <BookText size={16} /> Sentences loaded
          </span>
          <div className="flex items-center gap-4">
            <label htmlFor="sentence-upload" className="text-sm text-slate-400 hover:text-white transition-colors cursor-pointer">
              {isLoading ? 'Loading...' : 'Update'}
            </label>
            <button onClick={onClearSentences} className="text-sm text-slate-400 hover:text-white transition-colors">
              Clear
            </button>
          </div>
        </div>
      ) : (
        <label htmlFor="sentence-upload" className="w-full flex justify-center items-center gap-2 py-2 text-slate-400 hover:text-white transition-colors cursor-pointer">
          <UploadCloud size={16}/> {isLoading ? 'Loading...' : 'Upload Sentences (Optional)'}
        </label>
      )}
      <input id="sentence-upload" type="file" className="hidden" onChange={handleFileChange} accept=".xlsx,.json" disabled={isLoading} />
      {error && <p className="mt-2 text-xs text-red-400 text-center">{error}</p>}
    </div>
  );
};