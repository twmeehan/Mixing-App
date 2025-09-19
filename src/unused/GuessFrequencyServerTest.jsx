const { useEffect, useRef, useState } = React;

function GuessNumberGame() {
  const API_BASE = "http://localhost:5000";

  const audioRef = useRef(null);
  const origSrcRef = useRef(null);
  const eqSrcRef = useRef(null);

  const [ranges, setRanges] = useState([]);       // <- now from server
  const [isPlaying, setIsPlaying] = useState(false);
  const [eqEnabled, setEqEnabled] = useState(true);
  const [attempts, setAttempts] = useState(0);
  const [hint, setHint] = useState("");

  const makeUrlFromB64 = (b64, mime) => {
    const bin = atob(b64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mime || "application/octet-stream" }));
  };

  const revokeIfSet = (ref) => {
    if (ref.current) {
      try { URL.revokeObjectURL(ref.current); } catch {}
      ref.current = null;
    }
  };

  // ---- NEW: init to fetch ranges first ----
  const initGame = async () => {
    try {
      const r = await fetch(`${API_BASE}/init`);
      if (!r.ok) throw new Error("init fail");
      const data = await r.json();
      if (Array.isArray(data.ranges) && data.ranges.length) {
        setRanges(data.ranges);
      } else {
        throw new Error("no ranges");
      }
      // after ranges are loaded, pull the first audio bundle
      await startGame();
    } catch (e) {
      setHint("Failed to initialize game.");
    }
  };

  const startGame = async () => {
    revokeIfSet(origSrcRef);
    revokeIfSet(eqSrcRef);

    setHint("");
    setAttempts(0);

    try {
      const r = await fetch(`${API_BASE}/audio-bundle`);
      if (!r.ok) throw new Error("bundle fail");
      const data = await r.json();

      // If server also returns ranges here, keep client in sync (optional)
      if (Array.isArray(data.ranges) && data.ranges.length) setRanges(data.ranges);

      const origUrl = makeUrlFromB64(data.original.data, data.original.mime);
      const eqUrl   = makeUrlFromB64(data.eq_version.data, data.eq_version.mime);

      origSrcRef.current = origUrl;
      eqSrcRef.current = eqUrl;

      if (audioRef.current) {
        const wasPlaying = isPlaying;
        audioRef.current.src = eqEnabled ? eqSrcRef.current : origSrcRef.current;
        audioRef.current.currentTime = 0;
        audioRef.current.load();
        if (wasPlaying) {
          try { await audioRef.current.play(); setIsPlaying(true); } catch {}
        } else {
          setIsPlaying(false);
        }
      }
    } catch (e) {
      setHint("Failed to load audio bundle.");
    }
  };

  const toggleEq = async () => {
    if (!audioRef.current || !origSrcRef.current || !eqSrcRef.current) return;

    const wasPlaying = !audioRef.current.paused;
    const t = audioRef.current.currentTime || 0;

    const nextEnabled = !eqEnabled;
    setEqEnabled(nextEnabled);

    audioRef.current.src = nextEnabled ? eqSrcRef.current : origSrcRef.current;
    try { audioRef.current.currentTime = t; } catch {}
    audioRef.current.load();

    if (wasPlaying) {
      try { await audioRef.current.play(); setIsPlaying(true); } catch {}
    }
  };

  const handleGuess = async (range) => {
    setAttempts((a) => a + 1);
    try {
      // allow open-ended ranges by sending blank max if it's undefined/null
      const q = new URLSearchParams({
        min: String(range.min),
        max: range.max == null ? "" : String(range.max),
      }).toString();

      const r = await fetch(`${API_BASE}/guess?${q}`);
      if (!r.ok) throw new Error();
      const data = await r.json();

      const hz = Number(data.frequency_hz ?? NaN);
      const hzTxt = isNaN(hz) ? "" : ` (${hz.toFixed(2)} Hz)`;

      if (data.correct) {
        setHint(`🎉 Correct!${hzTxt}`);
      } else {
        setHint(`❌ Wrong. The frequency is ${data.relation}`);
      }
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
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch {}
    }
  };

  useEffect(() => {
    initGame(); // <-- start by fetching ranges
  }, []);

  return (
    <div
      className={`h-screen w-screen flex items-center justify-center text-neutral-100 p-8 transition-colors duration-500 ${
        eqEnabled ? "bg-purple-950" : "bg-neutral-950"
      }`}
    >
      <audio ref={audioRef} loop crossOrigin="anonymous" />

      <div className="w-full max-w-5xl rounded-2xl bg-neutral-900 p-10 shadow-2xl border border-neutral-800 flex flex-col items-center text-center">
        <h1 className="text-4xl font-bold mb-6">Guess the Range</h1>
        <p className="text-lg opacity-80 mb-10">
          Server picks a hidden frequency and EQs the stream. Can you find the range?
        </p>

        <div className="flex justify-between gap-4 mb-6 w-full">
          {ranges.length === 0 ? (
            <div className="w-full text-center opacity-70">Loading ranges…</div>
          ) : (
            ranges.map((r, i) => (
              <button
                key={i}
                onClick={() => handleGuess(r)}
                className="flex-1 rounded-xl px-6 py-6 text-lg font-medium bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition"
              >
                {r.label}
              </button>
            ))
          )}
        </div>

        <div className="h-10 mb-6 text-xl font-medium">{hint && <span>{hint}</span>}</div>

        <div className="flex items-center justify-center gap-6 text-lg opacity-90 mb-6">
          <button
            onClick={toggleEq}
            className="rounded-xl px-6 py-3 font-medium bg-purple-600 hover:bg-purple-500 active:scale-95 transition"
            disabled={!origSrcRef.current || !eqSrcRef.current}
          >
            {eqEnabled ? "Disable EQ" : "Enable EQ"}
          </button>
          <button
            onClick={startGame}
            className="rounded-xl px-6 py-3 font-medium bg-neutral-800 hover:bg-neutral-700 active:scale-95 transition"
            disabled={ranges.length === 0}
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
