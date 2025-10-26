import React from 'react';
import { Modal } from './Modal';
import type { Word, WordProgress } from '../types';

interface LearnedWordsModalProps {
  isOpen: boolean;
  onClose: () => void;
  learnedWords: (Word & { progress: WordProgress })[];
}

export const LearnedWordsModal: React.FC<LearnedWordsModalProps> = ({ isOpen, onClose, learnedWords }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Learned Words">
      <div className="text-slate-300 max-h-[70vh] flex flex-col">
        <div className="mb-4">
            <h3 className="text-lg font-semibold text-white">
                Total Learned: <span className="text-indigo-400">{learnedWords.length}</span>
            </h3>
        </div>

        {learnedWords.length > 0 ? (
            <div className="overflow-y-auto pr-2 flex-grow">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-300 uppercase bg-slate-700 sticky top-0">
                        <tr>
                            <th scope="col" className="px-4 py-2 rounded-l-lg">Russian / Ukrainian</th>
                            <th scope="col" className="px-4 py-2">English</th>
                            <th scope="col" className="px-4 py-2 text-center rounded-r-lg">Stage</th>
                        </tr>
                    </thead>
                    <tbody className="text-slate-400">
                        {learnedWords.map((word) => (
                        <tr key={word.en} className="border-b border-slate-700 hover:bg-slate-700/50">
                            <td className="px-4 py-2 font-medium text-slate-200 break-all">{word.ru}</td>
                            <td className="px-4 py-2 break-all">{word.en}</td>
                            <td className="px-4 py-2 text-center font-mono text-indigo-400">{word.progress.srsStage}</td>
                        </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        ) : (
            <p className="text-slate-400 text-center py-8">
                You haven't marked any words as "Know" yet. Keep studying!
            </p>
        )}
      </div>
    </Modal>
  );
};