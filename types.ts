// Fix: Define and export the `Word` interface, and remove the incorrect circular import.
export interface Word {
  ru: string;
  en: string;
}

export interface WordSet {
  name: string;
  words: Word[];
  originalSetIndex: number;
}
