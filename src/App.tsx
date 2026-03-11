/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { Play, RotateCcw, CheckCircle2, XCircle, Map as MapIcon, Instagram, Send } from 'lucide-react';

const geoUrl = "https://unpkg.com/world-atlas@2.0.2/countries-110m.json";

interface CountryData {
  id: string;
  name: string;
  populationStr: string;
  population: number;
}

const TOP_20_COUNTRIES: CountryData[] = [
  { id: "356", name: "Hindiston", populationStr: "1.47 milliard", population: 1472905953 },
  { id: "156", name: "Xitoy", populationStr: "1.41 milliard", population: 1413862232 },
  { id: "840", name: "AQSh", populationStr: "348 million", population: 348564930 },
  { id: "360", name: "Indoneziya", populationStr: "287 million", population: 287281410 },
  { id: "586", name: "Pokiston", populationStr: "257 million", population: 257997424 },
  { id: "566", name: "Nigeriya", populationStr: "240 million", population: 240951575 },
  { id: "076", name: "Braziliya", populationStr: "213 million", population: 213379022 },
  { id: "050", name: "Bangladesh", populationStr: "177 million", population: 177176520 },
  { id: "643", name: "Rossiya", populationStr: "143 million", population: 143428988 },
  { id: "231", name: "Efiopiya", populationStr: "137 million", population: 137891736 },
  { id: "484", name: "Meksika", populationStr: "132 million", population: 132705760 },
  { id: "392", name: "Yaponiya", populationStr: "122 million", population: 122654714 },
  { id: "818", name: "Misr", populationStr: "119 million", population: 119651206 },
  { id: "608", name: "Filippin", populationStr: "117 million", population: 117446079 },
  { id: "180", name: "Kongo DR", populationStr: "115 million", population: 115368143 },
  { id: "704", name: "Vyetnam", populationStr: "102 million", population: 102024601 },
  { id: "364", name: "Eron", populationStr: "93 million", population: 93012140 },
  { id: "792", name: "Turkiya", populationStr: "87 million", population: 87832587 },
  { id: "276", name: "Germaniya", populationStr: "83 million", population: 83745532 },
  { id: "834", name: "Tanzaniya", populationStr: "71 million", population: 71957585 },
];

const playSound = (type: 'success' | 'error' | 'finish') => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.1); // C6
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } else if (type === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'finish') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
      osc.frequency.setValueAtTime(554.37, ctx.currentTime + 0.15); // C#5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.3); // E5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.45); // A5
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
      osc.start();
      osc.stop(ctx.currentTime + 1);
    }
  } catch (e) {
    console.error("Audio playback failed", e);
  }
};

type GameStatus = 'start' | 'playing' | 'finished';
type CountryStatus = 'correct' | 'incorrect' | 'hint' | 'default';

export default function App() {
  const [gameStatus, setGameStatus] = useState<GameStatus>('start');
  const [remainingCountries, setRemainingCountries] = useState<CountryData[]>([]);
  const [targetCountry, setTargetCountry] = useState<CountryData | null>(null);
  const [score, setScore] = useState(0);
  const [permanentStatuses, setPermanentStatuses] = useState<Record<string, 'green' | 'red'>>({});
  const [temporaryError, setTemporaryError] = useState<string | null>(null);
  const [isFlashingHint, setIsFlashingHint] = useState(false);
  const [currentAttempts, setCurrentAttempts] = useState(0);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);
  const [isWaitingForNext, setIsWaitingForNext] = useState(false);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startGame = () => {
    const shuffled = [...TOP_20_COUNTRIES].sort(() => Math.random() - 0.5);
    setRemainingCountries(shuffled);
    setTargetCountry(shuffled[0]);
    setScore(0);
    setPermanentStatuses({});
    setTemporaryError(null);
    setIsFlashingHint(false);
    setCurrentAttempts(0);
    setGameStatus('playing');
    setFeedback(null);
    setIsWaitingForNext(false);
  };

  const handleNext = () => {
    const nextRemaining = remainingCountries.slice(1);
    if (nextRemaining.length === 0) {
      playSound('finish');
      setGameStatus('finished');
      setFeedback(null);
    } else {
      setRemainingCountries(nextRemaining);
      setTargetCountry(nextRemaining[0]);
      setCurrentAttempts(0);
      setFeedback(null);
      setIsWaitingForNext(false);
      setTemporaryError(null);
      setIsFlashingHint(false);
    }
  };

  const handleCountryClick = (geo: any) => {
    if (gameStatus !== 'playing' || !targetCountry || isWaitingForNext) return;

    const clickedId = geo.id;
    
    // If already correctly guessed, ignore
    if (permanentStatuses[clickedId]) return;

    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
    }

    if (clickedId === targetCountry.id) {
      // Correct guess
      playSound('success');
      
      if (currentAttempts === 0) {
        setScore(prev => prev + 1);
        setPermanentStatuses(prev => ({ ...prev, [clickedId]: 'green' }));
        setFeedback({ type: 'success', message: `To'g'ri! ${targetCountry.name} aholisi ${targetCountry.populationStr}.` });
      } else {
        setPermanentStatuses(prev => ({ ...prev, [clickedId]: 'red' }));
        setFeedback({ type: 'success', message: `Topdingiz! ${targetCountry.name} aholisi ${targetCountry.populationStr}.` });
      }

      setIsFlashingHint(false);
      setIsWaitingForNext(true);

    } else {
      // Incorrect guess
      playSound('error');
      const newAttempts = currentAttempts + 1;
      setCurrentAttempts(newAttempts);
      
      setTemporaryError(clickedId);
      setTimeout(() => {
        setTemporaryError(null);
      }, 1500);
      
      const clickedCountryName = geo.properties?.name || 'Noma\'lum davlat';
      
      if (newAttempts >= 3) {
        // Show hint after 3 failed attempts
        setIsFlashingHint(true);
        setFeedback({ type: 'error', message: `Bu ${clickedCountryName}. Miltillayotgan davlatni qidiring!` });
      } else {
        setFeedback({ type: 'error', message: `Noto'g'ri. Bu ${clickedCountryName}. Yana urinib ko'ring!` });
      }

      feedbackTimeoutRef.current = setTimeout(() => {
        setFeedback(null);
      }, 3000);
    }
  };

  const getFillColor = (geo: any) => {
    if (permanentStatuses[geo.id] === 'green') return '#22c55e'; // green-500
    if (permanentStatuses[geo.id] === 'red') return '#ef4444'; // red-500
    if (temporaryError === geo.id) return '#ef4444'; // red-500
    
    // Highlight top 20 countries slightly differently to show they are part of the game
    const isTop20 = TOP_20_COUNTRIES.some(c => c.id === geo.id);
    return isTop20 ? '#3f3f46' : '#27272a'; // zinc-700 : zinc-800
  };

  const getGeoClassName = (geo: any) => {
    if (isFlashingHint && targetCountry?.id === geo.id) {
      return "flashing-yellow outline-none";
    }
    return "outline-none transition-colors duration-300";
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 p-4 shadow-md z-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <MapIcon className="w-6 h-6 text-emerald-500" />
            <h1 className="text-xl font-bold tracking-tight">Aholi geografiyasi viktorinasi</h1>
          </div>
          
          {gameStatus === 'playing' && targetCountry && (
            <div className="flex items-center gap-6 bg-zinc-800 px-6 py-2 rounded-full border border-zinc-700">
              <div className="text-center">
                <p className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Shuncha aholisi bor davlatni toping</p>
                <p className="text-xl font-bold text-emerald-400">{targetCountry.populationStr}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 text-sm font-medium">
            {gameStatus !== 'start' && (
              <div className="flex items-center gap-4 bg-zinc-800 px-4 py-2 rounded-lg border border-zinc-700">
                <div className="flex flex-col items-center">
                  <span className="text-zinc-400 text-xs uppercase">Natija</span>
                  <span className="text-lg text-emerald-400">{score}/{TOP_20_COUNTRIES.length}</span>
                </div>
                <div className="w-px h-8 bg-zinc-700"></div>
                <div className="flex flex-col items-center">
                  <span className="text-zinc-400 text-xs uppercase">Jarayon</span>
                  <span className="text-lg text-zinc-200">{TOP_20_COUNTRIES.length - remainingCountries.length}/{TOP_20_COUNTRIES.length}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative flex flex-col">
        {/* Feedback Toast */}
        {feedback && gameStatus === 'playing' && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 animate-in fade-in slide-in-from-top-4 flex flex-col items-center gap-3">
            <div className={`flex items-center gap-2 px-6 py-3 rounded-full shadow-lg border font-medium ${
              feedback.type === 'success' ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200' :
              feedback.type === 'error' ? 'bg-red-950/80 border-red-500/50 text-red-200' :
              'bg-zinc-800 border-zinc-700 text-zinc-200'
            }`}>
              {feedback.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
              {feedback.type === 'error' && <XCircle className="w-5 h-5 text-red-500" />}
              {feedback.message}
            </div>
            {isWaitingForNext && (
              <button
                onClick={handleNext}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-6 rounded-full shadow-lg transition-colors flex items-center gap-2"
              >
                Keyingi Davlat
                <Play className="w-4 h-4 fill-current" />
              </button>
            )}
          </div>
        )}

        {/* Map Container */}
        <div className="flex-1 w-full bg-[#0a0a0c] overflow-hidden relative cursor-crosshair">
          <ComposableMap 
            projection="geoMercator" 
            projectionConfig={{ scale: 140 }}
            className="w-full h-full outline-none"
          >
            <ZoomableGroup center={[0, 20]} zoom={1} maxZoom={8}>
              <Geographies geography={geoUrl}>
                {({ geographies }) =>
                  geographies.map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onClick={() => handleCountryClick(geo)}
                      fill={getFillColor(geo)}
                      stroke="#18181b"
                      strokeWidth={0.5}
                      className={getGeoClassName(geo)}
                      style={{
                        default: { outline: "none" },
                        hover: { 
                          fill: gameStatus === 'playing' && !permanentStatuses[geo.id] && temporaryError !== geo.id && !(isFlashingHint && targetCountry?.id === geo.id) ? '#52525b' : getFillColor(geo),
                          outline: "none",
                          cursor: gameStatus === 'playing' ? 'pointer' : 'default'
                        },
                        pressed: { outline: "none" },
                      }}
                    />
                  ))
                }
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>
        </div>

        {/* Overlays */}
        {gameStatus === 'start' && (
          <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center z-30">
            <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center">
              <MapIcon className="w-16 h-16 text-emerald-500 mx-auto mb-6" />
              <h2 className="text-3xl font-bold mb-4">AHOLI VIKTORINASI</h2>
              <p className="text-zinc-400 mb-8 leading-relaxed">
                Dunyoning eng ko'p aholisiga ega 20 ta davlati bo'yicha bilimingizni sinab ko'ring. 
                Biz aholi sonini beramiz, siz esa xaritadan o'sha davlatni topishingiz kerak!
              </p>
              <button 
                onClick={startGame}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 px-8 rounded-xl transition-colors flex items-center justify-center gap-2 text-lg"
              >
                <Play className="w-5 h-5 fill-current" />
                O'yinni boshlash
              </button>
            </div>
          </div>
        )}

        {gameStatus === 'finished' && (
          <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center z-30">
            <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center">
              <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <h2 className="text-3xl font-bold mb-2">Viktorina yakunlandi!</h2>
              <p className="text-zinc-400 mb-6">Sizning natijangiz:</p>
              
              <div className="bg-zinc-950 rounded-xl p-6 mb-8 border border-zinc-800">
                <div className="text-5xl font-black text-emerald-400 mb-2">
                  {Math.round((score / TOP_20_COUNTRIES.length) * 100)}%
                </div>
                <div className="text-zinc-400 font-medium">
                  Birinchi urinishda {TOP_20_COUNTRIES.length} tadan {score} ta to'g'ri
                </div>
              </div>

              <button 
                onClick={startGame}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 px-8 rounded-xl transition-colors flex items-center justify-center gap-2 text-lg"
              >
                <RotateCcw className="w-5 h-5" />
                Qaytadan O'ynash
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-zinc-900 border-t border-zinc-800 p-4 text-center text-zinc-500 text-sm z-10">
        <p className="font-medium text-zinc-400">Muallif: Rahmatjon Bekimmatov</p>
        <div className="flex justify-center gap-6 mt-3">
          <a href="https://instagram.com/bekimmatovv" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-emerald-400 transition-colors">
            <Instagram className="w-4 h-4" />
            <span>@bekimmatovv</span>
          </a>
          <a href="https://t.me/Geografiya_Rahmatjon" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-emerald-400 transition-colors">
            <Send className="w-4 h-4" />
            <span>@Geografiya_Rahmatjon</span>
          </a>
        </div>
      </footer>
    </div>
  );
}

