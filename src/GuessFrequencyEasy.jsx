const { useEffect, useRef, useState } = React;

function GuessNumberGame() {
  // -------------------------
  // Config
  // -------------------------
  const ranges = [
    { label: "20 – 120", min: 20, max: 120 },
    { label: "121 – 500", min: 121, max: 500 },
    { label: "501 – 800", min: 501, max: 800 }, // (note: label says 501–800)
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

  // -------------------------
  // Audio refs
  // -------------------------
  const audioRef = useRef(null);
  const ctxRef = useRef(null);
  const sourceRef = useRef(null);
  const filterRef = useRef(null);
  const wetGainRef = useRef(null); // EQ path
  const dryGainRef = useRef(null); // bypass path

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

  // Smooth parameter ramp to avoid clicks/pops
  const rampTo = (param, value, time = 0.05) => {
    if (!ctxRef.current) return;
    const now = ctxRef.current.currentTime;
    try {
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      param.linearRampToValueAtTime(value, now + time);
    } catch {
      // some browsers throw if param has no automation; fail silently
      param.value = value;
    }
  };

  const updateEq = (number) => {
    if (!filterRef.current) return;

    // Map 0–10000 → 20–20000 Hz
    const minFreq = 20;
    const maxFreq = 20000;
    const scaled = (number / 10000) * (maxFreq - minFreq) + minFreq;

    rampTo(filterRef.current.frequency, scaled, 0.03);
    rampTo(filterRef.current.gain, EQ_GAIN_DB, 0.03);
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

    // Prep filter params for the new target
    updateEq(num);

    // Keep routing stable; wet/dry mix determines EQ on/off
    if (!eqEnabled && filterRef.current) {
      // ensure no boost is applied audibly (wet muted)
      rampTo(filterRef.current.gain, EQ_GAIN_DB, 0.03); // filter can keep its gain
      if (wetGainRef.current && dryGainRef.current) {
        rampTo(wetGainRef.current.gain, 0, 0.05);
        rampTo(dryGainRef.current.gain, 1, 0.05);
      }
    }
  };

  const handleGuess = (range) => {
    setAttempts((a) => a + 1);
    if (target >= range.min && target <= range.max) {
      setHint(`🎉 Correct! The frequency was ${target}`);
    } else {
      const relation = target < range.min ? "lower" : "higher";
      setHint(`❌ Wrong. The frequency is ${relation}`);
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

    // Create graph
    ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    sourceRef.current = ctxRef.current.createMediaElementSource(audioRef.current);
    filterRef.current = ctxRef.current.createBiquadFilter();
    wetGainRef.current = ctxRef.current.createGain();
    dryGainRef.current = ctxRef.current.createGain();

    // Filter setup
    filterRef.current.type = "peaking";
    filterRef.current.frequency.value = 1000;
    filterRef.current.Q.value = 1.5;
    filterRef.current.gain.value = 0;

    // Wire: source -> dry -> out
    sourceRef.current.connect(dryGainRef.current);
    dryGainRef.current.connect(ctxRef.current.destination);

    // Wire: source -> filter -> wet -> out
    sourceRef.current.connect(filterRef.current);
    filterRef.current.connect(wetGainRef.current);
    wetGainRef.current.connect(ctxRef.current.destination);

    // Start with EQ bypassed (dry=1, wet=0)
    dryGainRef.current.gain.value = 1;
    wetGainRef.current.gain.value = 0;

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
    if (!ctxRef.current || !wetGainRef.current || !dryGainRef.current) return;

    if (eqEnabled) {
      // EQ off: crossfade to dry
      rampTo(wetGainRef.current.gain, 0, 0.08);
      rampTo(dryGainRef.current.gain, 1, 0.08);
      setEqEnabled(false);
    } else {
      // EQ on: update filter for current target, then crossfade to wet
      updateEq(target);
      rampTo(wetGainRef.current.gain, 1, 0.08);
      rampTo(dryGainRef.current.gain, 0, 0.08);
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
    <div
      className={`h-screen w-screen flex items-center justify-center text-neutral-100 p-8 transition-colors duration-500 ${
        eqEnabled ? "bg-purple-950" : "bg-neutral-950"
      }`}
    >
      <audio ref={audioRef} loop>
        {audioSrc && <source src={audioSrc} />}
      </audio>

      <div className="w-full max-w-5xl rounded-2xl bg-neutral-900 p-10 shadow-2xl border border-neutral-800 flex flex-col items-center text-center">
        <h1 className="text-4xl font-bold mb-6">Guess the Range</h1>
        <p className="text-lg opacity-80 mb-10">
          A random frequency is boosted between <b>0</b> and <b>10000</b>. Which range is it in?
        </p>

        {/* Frequency guess buttons */}
        <div className="flex justify-between gap-4 mb-6 w-full">
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

        {/* Hint */}
        <div className="h-10 mb-6 text-xl font-medium">
          {hint && <span>{hint}</span>}
        </div>

        {/* EQ toggle button below the guess buttons */}
        <div className="mb-10">
          <button
            onClick={toggleEq}
            className="rounded-xl px-6 py-3 text-lg font-medium bg-purple-600 hover:bg-purple-500 active:scale-95 transition"
          >
            {eqEnabled ? "Disable EQ" : "Enable EQ"}
          </button>
        </div>

        {/* Attempts + New Game + Music controls */}
        <div className="flex items-center justify-center gap-8 text-lg opacity-90">
          <span>Attempts: {attempts}</span>
          <button onClick={startGame} className="underline underline-offset-4 hover:opacity-100">
            New game
          </button>
          <button onClick={toggleMusic} className="underline underline-offset-4 hover:opacity-100">
            {isPlaying ? "Pause music" : "Play music"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Mount
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<GuessNumberGame />);
