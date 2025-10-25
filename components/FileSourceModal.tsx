import React, { useState } from 'react';
import { Modal } from './Modal';
import { FileUpload } from './FileUpload';
import { BuiltInDictionaries } from './BuiltInDictionaries';
import { Library, Upload } from 'lucide-react';

interface FileSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFilesSelect: (name: string, wordsFile: File, sentencesFile?: File) => void;
  isLoading: boolean;
}

type Tab = 'built-in' | 'computer';

export const FileSourceModal: React.FC<FileSourceModalProps> = ({ isOpen, onClose, onFilesSelect, isLoading }) => {
  const [activeTab, setActiveTab] = useState<Tab>('built-in');

  const handleLocalFileSelect = (file: File) => {
    // Use filename as the dictionary name, removing the extension
    const dictionaryName = file.name.endsWith('.xlsx') ? file.name.slice(0, -5) : file.name;
    onFilesSelect(dictionaryName, file);
  };

  const handleBuiltInSelect = (name: string, wordsFile: File, sentencesFile?: File) => {
    onFilesSelect(name, wordsFile, sentencesFile);
  };

  // FIX: Changed props type to React.PropsWithChildren to correctly handle the children prop and resolve TypeScript error.
  const TabButton = ({ tab, children }: React.PropsWithChildren<{ tab: Tab }>) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex-1 flex items-center justify-center gap-2 p-3 text-sm font-medium border-b-2 transition-colors ${
        activeTab === tab
          ? 'border-indigo-500 text-white'
          : 'border-transparent text-slate-400 hover:text-white hover:border-slate-500'
      }`}
    >
      {children}
    </button>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select File Source">
      <div className="flex border-b border-slate-700">
        <TabButton tab="built-in"><Library size={16} /> Built-in</TabButton>
        <TabButton tab="computer"><Upload size={16} /> From Computer</TabButton>
      </div>
      <div className="pt-6">
        {activeTab === 'built-in' && (
          <BuiltInDictionaries onSelect={handleBuiltInSelect} />
        )}
        {activeTab === 'computer' && (
          <FileUpload onFileUpload={handleLocalFileSelect} isLoading={isLoading} />
        )}
      </div>
    </Modal>
  );
};