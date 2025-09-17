const { useEffect, useRef, useState } = React;

function GuessNumberGame() {
  const API_BASE = "http://localhost:5000";

  const ranges = [
    { label: "20 – 120", min: 20, max: 120 },
    { label: "121 – 500", min: 121, max: 500 },
    { label: "501 – 800", min: 501, max: 800 },
    { label: "801 – 4000", min: 801, max: 4000 },
    { label: "4001+", min: 4001, max: 8000 },
  ];

  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [eqEnabled, setEqEnabled] = useState(true);
  const [attempts, setAttempts] = useState(0);
  const [hint, setHint] = useState("");

  const once = (el, ev) =>
    new Promise((res) => el.addEventListener(ev, res, { once: true }));

  // Build URLs for different endpoints
  const buildStreamSrc = ({ eq, randomize }) => {
    const p = new URLSearchParams({
      eq: eq ? "on" : "off",
      randomize: randomize ? "1" : "0",
      v: Date.now().toString(), // cache-bust
    });
    return `${API_BASE}/stream?${p.toString()}`;
  };
  const buildToggleSrc = () => `${API_BASE}/toggle-eq`;

  // New round: /stream randomizes target
  const startGame = async () => {
    try {
      setAttempts(0);
      setHint("");
      if (!audioRef.current) return;

      const wasPlaying = !audioRef.current.paused && !audioRef.current.ended;

      audioRef.current.src = buildStreamSrc({ eq: eqEnabled, randomize: true });
      await once(audioRef.current, "loadedmetadata");
      audioRef.current.currentTime = 0;

      if (wasPlaying || !isPlaying) {
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch {
      setHint("Could not start audio.");
    }
  };

  // Toggle EQ without restarting: hit /toggle-eq and keep position
  const toggleEq = async () => {
    if (!audioRef.current) return;

    const next = !eqEnabled;
    setEqEnabled(next);

    const wasPlaying = !audioRef.current.paused && !audioRef.current.ended;
    const t = audioRef.current.currentTime;

    // Server flips EQ state and returns audio bytes
    audioRef.current.src = buildToggleSrc();
    await once(audioRef.current, "loadedmetadata");
    audioRef.current.currentTime = t;
    if (wasPlaying) {
      try { await audioRef.current.play(); } catch {}
    }
  };

  // Guess via server
  const handleGuess = async (range) => {
    setAttempts((a) => a + 1);
    try {
      const q = new URLSearchParams({ min: range.min, max: range.max }).toString();
      const r = await fetch(`${API_BASE}/guess?${q}`);
      if (!r.ok) throw new Error();
      const data = await r.json();
      if (data.correct) setHint("🎉 Correct!");
      else setHint(`❌ Wrong. The frequency is ${data.relation}`);
    } catch {
      setHint("Guess endpoint unavailable.");
    }
  };

  const toggleMusic = async () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try { await audioRef.current.play(); setIsPlaying(true); } catch {}
    }
  };

  useEffect(() => { startGame(); }, []);

  return (
    <div
      className={`h-screen w-screen flex items-center justify-center text-neutral-100 p-8 transition-colors duration-500 ${
        eqEnabled ? "bg-purple-950" : "bg-neutral-950"
      }`}
    >
      {/* We programmatically set .src, so no <source> child */}
      <audio ref={audioRef} loop crossOrigin="anonymous" />

      <div className="w-full max-w-5xl rounded-2xl bg-neutral-900 p-10 shadow-2xl border border-neutral-800 flex flex-col items-center text-center">
        <h1 className="text-4xl font-bold mb-6">Guess the Range</h1>
        <p className="text-lg opacity-80 mb-10">
          Server picks a hidden frequency and EQs the stream. Can you find the range?
        </p>

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

        <div className="h-10 mb-6 text-xl font-medium">{hint && <span>{hint}</span>}</div>

        <div className="flex items-center justify-center gap-6 text-lg opacity-90 mb-6">
          <button
            onClick={toggleEq}
            className="rounded-xl px-6 py-3 font-medium bg-purple-600 hover:bg-purple-500 active:scale-95 transition"
          >
            {eqEnabled ? "Disable EQ (hot-swap)" : "Enable EQ (hot-swap)"}
          </button>
          <button
            onClick={startGame}
            className="rounded-xl px-6 py-3 font-medium bg-neutral-800 hover:bg-neutral-700 active:scale-95 transition"
          >
            New game
          </button>
          <button
            onClick={toggleMusic}
            className="underline underline-offset-4 hover:opacity-100"
          >
            {isPlaying ? "Pause music" : "Play music"}
          </button>
          <span>Attempts: {attempts}</span>
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<GuessNumberGame />);
