const { useEffect, useRef, useState } = React;

function GuessNumberGame() {
  // -------------------------
  // Config
  // -------------------------
  const ranges = [
    { label: "20 – 120", min: 20, max: 120 },
    { label: "121 – 800", min: 121, max: 800 },
    { label: "801 – 4000", min: 801, max: 4000 },
    { label: "4001+", min: 4001, max: 10000 },
  ];

  const soundFiles = [
    "src/sounds/loop1.wav",
    "src/sounds/loop2.wav",
    "src/sounds/loop3.wav",
    "src/sounds/loop4.wav",
    "src/sounds/loop5.wav",
  ];

  // 🎚️ EQ gain in decibels — change this value to adjust boost
  const EQ_GAIN_DB = 20;

  // -------------------------
  // State
  // -------------------------
  const [target, setTarget] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [hint, setHint] = useState("");
  const [audioSrc, setAudioSrc] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [eqEnabled, setEqEnabled] = useState(false);

  const audioRef = useRef(null);
  const ctxRef = useRef(null);
  const sourceRef = useRef(null);
  const filterRef = useRef(null);

  // -------------------------
  // Helpers
  // -------------------------
  const randWithDeadzone = () => {
    const chosenRange = ranges[Math.floor(Math.random() * ranges.length)];
    const size = chosenRange.max - chosenRange.min;
    const buffer = Math.max(5, Math.floor(size * 0.05));
    const safeMin = chosenRange.min + buffer;
    const safeMax = chosenRange.max - buffer;
    return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
  };

  const updateEq = (number) => {
    if (!filterRef.current) return;

    // Map 0–10000 → 20–20000 Hz
    const minFreq = 20;
    const maxFreq = 20000;
    const scaled = Math.pow(number / 10000, 1) * (maxFreq - minFreq) + minFreq;

    filterRef.current.frequency.value = scaled;
    filterRef.current.gain.value = EQ_GAIN_DB; // use configurable gain
    filterRef.current.Q.value = 1.5;
  };

  // -------------------------
  // Game Logic
  // -------------------------
  const startGame = () => {
    const num = randWithDeadzone();
    setTarget(num);
    setAttempts(0);
    setHint("");

    const randomSound = soundFiles[Math.floor(Math.random() * soundFiles.length)];
    setAudioSrc(randomSound);

    if (audioRef.current) {
      audioRef.current.load();
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }

  
    updateEq(num);

  };

  const handleGuess = (range) => {
    setAttempts((a) => a + 1);
    if (target >= range.min && target <= range.max) {
      setHint(`🎉 Correct! The number ${target} is in ${range.label}.`);
    } else {
      const relation = target < range.min ? "lower" : "higher";
      setHint(`❌ Wrong. The number is ${relation} than ${range.label}.`);
    }
  };

  // -------------------------
  // Effects
  // -------------------------
  useEffect(() => {
    startGame();
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;

    ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    sourceRef.current = ctxRef.current.createMediaElementSource(audioRef.current);
    filterRef.current = ctxRef.current.createBiquadFilter();

    filterRef.current.type = "peaking";
    filterRef.current.frequency.value = 1000;
    filterRef.current.Q.value = 1.5;
    filterRef.current.gain.value = 0;

    sourceRef.current.connect(ctxRef.current.destination);

    // Unlock audio on first user click
    const unlock = () => {
      ctxRef.current.resume();
      if (audioRef.current && !isPlaying) {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
      document.removeEventListener("click", unlock);
    };
    document.addEventListener("click", unlock);

    return () => document.removeEventListener("click", unlock);
  }, []);

  // -------------------------
  // Toggles
  // -------------------------
  const toggleEq = () => {
    if (!ctxRef.current || !filterRef.current || !sourceRef.current) return;

    if (eqEnabled) {
      sourceRef.current.disconnect();
      sourceRef.current.connect(ctxRef.current.destination);
      setEqEnabled(false);
    } else {
      sourceRef.current.disconnect();
      sourceRef.current.connect(filterRef.current);
      filterRef.current.connect(ctxRef.current.destination);
      updateEq(target);
      setEqEnabled(true);
    }
  };

  const toggleMusic = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  // -------------------------
  // UI
  // -------------------------
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-neutral-950 text-neutral-100 p-8">
      <audio ref={audioRef} loop>
        {audioSrc && <source src={audioSrc} />}
      </audio>

      <div className="w-full max-w-5xl rounded-2xl bg-neutral-900 p-10 shadow-2xl border border-neutral-800 flex flex-col items-center text-center">
        <h1 className="text-4xl font-bold mb-6">Guess the Range</h1>
        <p className="text-lg opacity-80 mb-10">
          A random frequency is boosted between <b>0</b> and <b>10000</b>. Which range is it in?
        </p>

        <div className="flex justify-between gap-4 mb-10 w-full">
          {ranges.map((r, i) => (
            <button
              key={i}
              onClick={() => handleGuess(r)}
              className="flex-1 rounded-xl px-6 py-6 text-lg font-medium bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition"
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="h-10 mb-6 text-xl font-medium">
          {hint && <span>{hint}</span>}
        </div>

        <div className="flex items-center justify-center gap-8 text-lg opacity-90">
          <span>Attempts: {attempts}</span>
          <button onClick={startGame} className="underline underline-offset-4 hover:opacity-100">
            New game
          </button>
          <button onClick={toggleMusic} className="underline underline-offset-4 hover:opacity-100">
            {isPlaying ? "Pause music" : "Play music"}
          </button>
          <button onClick={toggleEq} className="underline underline-offset-4 hover:opacity-100">
            {eqEnabled ? "Disable EQ" : "Enable EQ"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Mount
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<GuessNumberGame />);
