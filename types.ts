export interface Word {
  ru: string;
  en: string;
}

export interface WordSet {
  name: string;
  words: Word[];
  originalSetIndex: number; // To keep colors consistent for related sets
}

export interface LoadedDictionary {
  name: string;
  sets: WordSet[];
}
