import React from 'react';
import type { WordSet } from '../types';

interface SetSelectorProps {
  sets: WordSet[];
  selectedSetIndex: number | null;
  onSelectSet: (index: number) => void;
}

// Predefined color classes for the buttons to make them visually distinct
const colorClasses = [
  { bg: 'bg-sky-700', hoverBg: 'hover:bg-sky-600', ring: 'focus:ring-sky-500' },
  { bg: 'bg-teal-700', hoverBg: 'hover:bg-teal-600', ring: 'focus:ring-teal-500' },
  { bg: 'bg-rose-700', hoverBg: 'hover:bg-rose-600', ring: 'focus:ring-rose-500' },
  { bg: 'bg-amber-700', hoverBg: 'hover:bg-amber-600', ring: 'focus:ring-amber-500' },
  { bg: 'bg-violet-700', hoverBg: 'hover:bg-violet-600', ring: 'focus:ring-violet-500' },
];


export const SetSelector: React.FC<SetSelectorProps> = ({ sets, selectedSetIndex, onSelectSet }) => {
  if (sets.length <= 1) {
    return null; // Don't show selector if there's only one set
  }

  return (
    <div className="flex flex-wrap justify-center gap-3 mb-8">
      {sets.map((set, index) => {
        const isSelected = selectedSetIndex === index;
        // Use the originalSetIndex for coloring, ensuring related sets have the same color
        const color = colorClasses[set.originalSetIndex % colorClasses.length];

        const baseClasses = 'px-4 py-2 text-sm font-semibold text-white rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900';
        
        const selectedClasses = 'bg-indigo-600 shadow-lg focus:ring-indigo-500';
        const unselectedClasses = `${color.bg} ${color.hoverBg} ${color.ring}`;

        return (
          <button
            key={set.name}
            onClick={() => onSelectSet(index)}
            className={`${baseClasses} ${isSelected ? selectedClasses : unselectedClasses}`}
          >
            {set.name}
          </button>
        );
      })}
    </div>
  );
};
