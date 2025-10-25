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

export interface WordProgress {
  srsStage: number;
  nextReviewDate: string; // ISO 8601 date string
}
