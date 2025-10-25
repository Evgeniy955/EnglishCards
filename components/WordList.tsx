
import React from 'react';
import type { Word } from '../types';

interface WordListProps {
  words: Word[];
  isVisible: boolean;
}

export const WordList: React.FC<WordListProps> = ({ words, isVisible }) => {
  return (
    <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isVisible ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
      <div className="mt-8 p-4 bg-slate-800 rounded-lg max-h-80 overflow-y-auto">
        <h3 className="text-lg font-semibold mb-2 text-slate-300">All Words in Set</h3>
        <ul className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-slate-400">
          {words.map((word, index) => (
            <li key={index}>
              {word.en}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
