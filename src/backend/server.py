import os, glob, base64, mimetypes, random, threading
from flask import Flask, jsonify, request
from flask_cors import CORS

from utils.eq_file_factory import bounce_eq

app = Flask(__name__)
CORS(app)

# --------------------------------------------------------------------
# Server-side ranges (moved from client)
# Edit/extend here; labels are what the client will display.
# --------------------------------------------------------------------
RANGES = [
    {"label": "20 – 120",   "min": 20,   "max": 120},
    {"label": "121 – 500",  "min": 121,  "max": 500},
    {"label": "501 – 800",  "min": 501,  "max": 800},
    {"label": "801 – 4000", "min": 801,  "max": 4000},
    {"label": "4001+",      "min": 4001, "max": 8000},
]

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SOUNDS_DIR = os.path.join(BASE_DIR, "sounds")

AUDIO_FILES = sorted(
    glob.glob(os.path.join(SOUNDS_DIR, "*.wav")) +
    glob.glob(os.path.join(SOUNDS_DIR, "*.mp3"))
)

# --------------------------------------------------------------------
# Game state (simple single-session storage)
# --------------------------------------------------------------------
_state_lock = threading.Lock()
CURRENT_TARGET_HZ: float | None = None
CURRENT_RANGE_INDEX: int | None = None

def _set_target(freq_hz: float, range_idx: int):
    global CURRENT_TARGET_HZ, CURRENT_RANGE_INDEX
    with _state_lock:
        CURRENT_TARGET_HZ = float(freq_hz)
        CURRENT_RANGE_INDEX = int(range_idx)

def _get_target():
    with _state_lock:
        return CURRENT_TARGET_HZ, CURRENT_RANGE_INDEX

# --------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------
def _read_bytes(path: str) -> bytes:
    with open(path, "rb") as f:
        return f.read()

def _b64(b: bytes) -> str:
    import base64
    return base64.b64encode(b).decode("ascii")


# --------------------------------------------------------------------
# API
# --------------------------------------------------------------------
@app.get("/init")
def init():
    return jsonify({"ranges": RANGES})


@app.get("/audio-bundle")
def audio_bundle():
    """
    Picks a random source file, then:
      1) Picks a random RANGE first
      2) Picks a random frequency inside that interval
      3) Bounces EQ at that frequency (Q, gain set in the factory)
      4) Returns original file (as-is) + EQ version (as WAV)
      5) Returns the ranges list for the client to render
    """
    if not AUDIO_FILES:
        return jsonify({"error": "No audio files found"}), 404

    # choose a source file
    src_path = random.choice(AUDIO_FILES)
    orig_bytes = _read_bytes(src_path)
    mime, _ = mimetypes.guess_type(src_path)
    mime = mime or "application/octet-stream"

    # choose a range, then a frequency inside it
    range_idx = random.randrange(len(RANGES))
    r = RANGES[range_idx]
    # for the open-ended "4001+" we cap the upper bound for the game logic
    r_min = int(r["min"])
    r_max = int(r.get("max", 8000))  # default cap if missing
    target_hz = random.uniform(r_min, r_max)

    # store the target for /guess
    _set_target(target_hz, range_idx)

    # render EQ’d version at that target frequency (don’t leak f0 to client)
    eq_wav_bytes, eq_meta = bounce_eq(src_path, f0_hz=target_hz)

    # redact the exact frequency so the client can't trivially peek
    if "eq_params" in eq_meta:
        eq_meta = {k: v for k, v in eq_meta.items() if k != "eq_params"}

    payload = {
        "original": {
            "filename": os.path.basename(src_path),
            "mime": mime,
            "encoding": "base64",
            "data": _b64(orig_bytes),
        },
        "eq_version": {
            "filename": eq_meta["filename"],  # "<orig>__eq.wav"
            "mime": eq_meta["mime"],          # "audio/wav"
            "encoding": "base64",
            "data": _b64(eq_wav_bytes),
        },
        # Send server-side ranges so the client can render from source of truth
        "ranges": RANGES,
    }
    return jsonify(payload)


@app.get("/guess")
def handle_guess():
    """
    Query: ?min=<int>&max=<int>
    Returns:
      {
        "correct": bool,
        "relation": "higher" | "lower" | null,
        "frequency_hz": float  # exact picked frequency
      }
    """
    target_hz, _range_idx = _get_target()
    if target_hz is None:
      return jsonify({"error": "No active game; call /audio-bundle first."}), 404

    try:
        min_q = int((request.args.get("min") or "").strip())
        max_raw = (request.args.get("max") or "").strip()
        max_q = int(max_raw) if max_raw != "" else 10_000  # open-ended caps
    except Exception:
        return jsonify({"error": "Bad query. Use ?min=<int>&max=<int>"}), 400

    if min_q > max_q:
        min_q, max_q = max_q, min_q

    correct = (min_q <= target_hz <= max_q)
    relation = None if correct else ("lower" if target_hz < min_q else "higher")

    return jsonify({
        "correct": correct,
        "relation": relation,
        "frequency_hz": round(float(target_hz), 2)
    })



if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
