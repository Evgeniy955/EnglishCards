
import React, { useCallback } from 'react';
import { UploadCloud } from 'lucide-react';

interface FileUploadProps {
  onFileUpload: (file: File) => void;
  isLoading: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, isLoading }) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  const onDragOver = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
  }, []);

  const onDrop = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file && file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      onFileUpload(file);
    }
  }, [onFileUpload]);

  return (
    <div className="w-full max-w-lg mx-auto text-center">
      <h2 className="text-3xl font-bold mb-2 text-slate-100">Welcome to Word Trainer</h2>
      <p className="text-slate-400 mb-8">Upload your .xlsx file to begin.</p>
      <label
        htmlFor="file-upload"
        onDragOver={onDragOver}
        onDrop={onDrop}
        className="relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-slate-800 border-slate-600 hover:bg-slate-700 transition-colors"
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <UploadCloud className="w-10 h-10 mb-3 text-slate-500" />
          <p className="mb-2 text-sm text-slate-400"><span className="font-semibold">Click to upload</span> or drag and drop</p>
          <p className="text-xs text-slate-500">Excel file (.xlsx)</p>
        </div>
        <input id="file-upload" type="file" className="hidden" onChange={handleFileChange} accept=".xlsx" disabled={isLoading} />
      </label>
      {isLoading && <p className="mt-4 text-indigo-400 animate-pulse">Processing file...</p>}
    </div>
  );
};
