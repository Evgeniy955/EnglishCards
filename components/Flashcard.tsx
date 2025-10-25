import React, { useState, useRef } from 'react';
import { Volume2 } from 'lucide-react';
import type { Word } from '../types';

// --- Audio Helper Functions ---

// Decodes a base64 string into a Uint8Array.
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Decodes raw PCM audio data into an AudioBuffer for playback.
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


interface FlashcardProps {
  word: Word | null;
  isFlipped: boolean;
  onFlip: () => void;
  exampleSentence?: string;
}

export const Flashcard: React.FC<FlashcardProps> = ({ word, isFlipped, onFlip, exampleSentence }) => {
  const [isSpeakingWord, setIsSpeakingWord] = useState(false);
  const [isSpeakingSentence, setIsSpeakingSentence] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Fallback to browser's native speech synthesis
  const speakNatively = (text: string, setLoading: (loading: boolean) => void, isSentence: boolean) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = isSentence ? 0.9 : 1.0; // 10% slower for sentences
      utterance.onend = () => setLoading(false);
      utterance.onerror = () => setLoading(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setLoading(false); // No speech capabilities
    }
  };
  
  // General purpose speech function
  const speak = async (text: string, setLoading: (loading: boolean) => void, isSentence: boolean) => {
    if (!text) return;

    setLoading(true);

    const hasApiKey = typeof process !== 'undefined' && process.env?.API_KEY;

    if (hasApiKey) {
      try {
        const { GoogleGenAI, Modality } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text }] }],
          // Fix: The 'speakingRate' property is not supported in the SpeechConfig and was removed to fix a type error.
          // The rate is adjusted in the native speech synthesis fallback.
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
            }
          },
        });
        
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

        if (base64Audio) {
          if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
          }
          const audioContext = audioContextRef.current;
          const audioBuffer = await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);
          
          const source = audioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContext.destination);
          source.onended = () => setLoading(false);
          source.start();
        } else {
          throw new Error("No audio data received from API.");
        }
      } catch (error) {
        console.warn("High-quality TTS failed, falling back to native voice.", error);
        speakNatively(text, setLoading, isSentence);
      }
    } else {
      speakNatively(text, setLoading, isSentence);
    }
  };

  const handleSpeakWord = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!word || isSpeakingWord || isSpeakingSentence) return;
    speak(word.en, setIsSpeakingWord, false);
  };

  const handleSpeakSentence = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!exampleSentence || isSpeakingWord || isSpeakingSentence) return;
    speak(exampleSentence, setIsSpeakingSentence, true);
  };

  return (
    <div className="w-full max-w-md h-64 sm:h-72 perspective cursor-pointer" onClick={onFlip}>
      <div className={`relative w-full h-full preserve-3d transition-transform duration-500 ${isFlipped ? 'rotate-y-180' : ''}`}>
        {/* Front Side */}
        <div className="absolute w-full h-full backface-hidden flex items-center justify-center p-6 bg-slate-800 rounded-2xl shadow-lg border border-slate-700">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-slate-100 break-words break-all">{word?.ru}</h2>
        </div>
        {/* Back Side */}
        <div className="absolute w-full h-full backface-hidden rotate-y-180 flex flex-col items-center justify-center p-6 bg-indigo-700 rounded-2xl shadow-lg">
          <div className="flex items-center justify-center gap-3">
            <h2 className="text-3xl sm:text-4xl font-bold text-center text-white break-words break-all">{word?.en}</h2>
            <button 
              onClick={handleSpeakWord} 
              disabled={isSpeakingWord || isSpeakingSentence}
              className="p-2 rounded-full text-indigo-200 hover:bg-indigo-600 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-50 disabled:cursor-wait"
              aria-label="Pronounce word"
            >
              <Volume2 size={28} className={isSpeakingWord ? 'animate-spin' : ''} />
            </button>
          </div>
          {exampleSentence && (
             <div className="mt-4 text-center">
              <p className="text-sm sm:text-base text-indigo-200 break-words italic inline">
                "{exampleSentence}"
              </p>
              <button
                onClick={handleSpeakSentence}
                disabled={isSpeakingWord || isSpeakingSentence}
                className="ml-2 p-1 rounded-full text-indigo-200 hover:bg-indigo-600 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-50 disabled:cursor-wait inline-flex align-middle"
                aria-label="Pronounce sentence"
              >
                <Volume2 size={20} className={isSpeakingSentence ? 'animate-spin' : ''} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};