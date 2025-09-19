import os
import io
import random
import math

from flask import Flask, Response, stream_with_context, request
from flask_cors import CORS

import numpy as np
import soundfile as sf
from scipy.signal import lfilter

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SOUNDS_DIR = os.path.join(BASE_DIR, "sounds")

AUDIO_FILES = [
    os.path.join(SOUNDS_DIR, "serverloop1.wav"),
    os.path.join(SOUNDS_DIR, "serverloop2.wav"),
    os.path.join(SOUNDS_DIR, "serverloop3.wav"),
]


def apply_peaking_eq(signal: np.ndarray, sr: int, center_hz: float,
                     gain_db: float, q: float) -> np.ndarray:
    """
    RBJ peaking EQ. signal: float32/float64, shape (N,) or (N,C).
    Returns same dtype (float32 if input was float32, else float64).
    """
    one_d = False
    if signal.ndim == 1:
        signal = signal[:, None]
        one_d = True

    A = 10 ** (gain_db / 40.0)
    w0 = 2.0 * math.pi * center_hz / sr
    alpha = math.sin(w0) / (2.0 * q)
    cosw0 = math.cos(w0)

    # RBJ peaking EQ biquad
    b0 = 1 + alpha * A
    b1 = -2 * cosw0
    b2 = 1 - alpha * A
    a0 = 1 + alpha / A
    a1 = -2 * cosw0
    a2 = 1 - alpha / A

    # Normalize
    b = np.array([b0 / a0, b1 / a0, b2 / a0], dtype=np.float64)
    a = np.array([1.0,       a1 / a0, a2 / a0], dtype=np.float64)

    out = np.empty_like(signal, dtype=np.float64)
    for ch in range(signal.shape[1]):
        out[:, ch] = lfilter(b, a, signal[:, ch].astype(np.float64))

    # Preserve original float32 if provided
    if signal.dtype == np.float32:
        out = out.astype(np.float32)

    if one_d:
        out = out[:, 0]
    return out

def pick_center_freq(sr: int, low_hz: float = 80.0, high_hz: float | None = 8000.0) -> float:
    nyq = sr * 0.5
    hi = min(high_hz if high_hz else nyq * 0.9, nyq * 0.9)
    lo = max(20.0, low_hz)
    if hi <= lo:
        hi = max(lo + 50.0, nyq * 0.6)
    return float(np.random.uniform(lo, hi))

def normalize_peak(x: np.ndarray, target_peak: float = 0.95) -> np.ndarray:
    """Scale to target peak to reduce clipping from boosts."""
    peak = float(np.max(np.abs(x))) or 1.0
    g = target_peak / peak
    return (x * g).astype(x.dtype, copy=False)

def render_wav_bytes(data: np.ndarray, sr: int, subtype: str = "PCM_16") -> bytes:
    """Write numpy audio (N,) or (N,C) to WAV bytes with soundfile."""
    # If single-channel 2D, fold to 1D for smaller header
    if data.ndim == 2 and data.shape[1] == 1:
        data = data[:, 0]
    buf = io.BytesIO()
    sf.write(buf, data, sr, format="WAV", subtype=subtype)
    buf.seek(0)
    return buf.read()

# ---------- App Routes ----------
@app.get("/")
def index():
    return """
<!doctype html>
<title>Audio Stream</title>
<p>This endpoint now returns multipart/mixed with two WAVs in one response.</p>
<p>Use JS fetch() to parse both parts. Example sketch:</p>
<pre>
fetch('/stream').then(async r => {
  const ct = r.headers.get('Content-Type'); // multipart/mixed; boundary=...
  // Parse the multipart stream (reader + boundary parsing) to extract
  // two Blob parts: 'orig.wav' and 'eq.wav' and then assign to two &lt;audio&gt; tags.
});
</pre>
"""

@app.get("/stream")
def stream():
    """
    Returns two WAV files in a single multipart/mixed response:
      - Part 1: original
      - Part 2: EQ-boosted (+20 dB, Q=1.5) at a random frequency
    """
    version = request.args.get("version", "both")  # kept for compatibility
    chosen = AUDIO_FILES[0]  # you can randomize if you like

    # Load original audio
    # always_2d=True -> shape (N, C); dtype float64 by default.
    # We’ll keep it float32 to keep file sizes small when writing PCM_16.
    data, sr = sf.read(chosen, always_2d=True)
    data = data.astype(np.float32)

    # Pick a random center frequency in a sensible musical range
    # Avoid very low/high extremes; clamp to Nyquist
    nyquist = sr / 2.0
    low_hz = 80.0
    high_hz = min(8000.0, nyquist * 0.9)
    center_hz = random.uniform(low_hz, high_hz)

    gain_db = 20.0
    q = 1.5

    # Process EQ
    eq_data = apply_peaking_eq(data, sr, center_hz, gain_db, q)

    # Render both WAVs to memory
    orig_wav = render_wav_bytes(data, sr, subtype="PCM_16")
    eq_wav = render_wav_bytes(eq_data, sr, subtype="PCM_16")

    boundary = "MULTIPARTBOUNDARY1234567890"
    mime = f"multipart/mixed; boundary={boundary}"

    def generate_multipart():
        # --- Part 1: Original
        yield (f"--{boundary}\r\n"
               "Content-Type: audio/wav\r\n"
               'Content-Disposition: inline; name="original"; filename="original.wav"\r\n'
               f"Content-Length: {len(orig_wav)}\r\n\r\n").encode("utf-8")
        # stream original bytes in chunks
        start = 0
        chunk = 8192
        while start < len(orig_wav):
            end = min(start + chunk, len(orig_wav))
            yield orig_wav[start:end]
            start = end
        yield b"\r\n"

        # --- Part 2: EQ'ed
        hdr = (f"--{boundary}\r\n"
               "Content-Type: audio/wav\r\n"
               'Content-Disposition: inline; name="eq_boosted"; filename="eq_boosted.wav"\r\n'
               f"X-Parametric-EQ: center_hz={center_hz:.2f}; gain_db={gain_db}; Q={q}\r\n"
               f"Content-Length: {len(eq_wav)}\r\n\r\n").encode("utf-8")
        yield hdr
        start = 0
        while start < len(eq_wav):
            end = min(start + chunk, len(eq_wav))
            yield eq_wav[start:end]
            start = end
        yield b"\r\n"

        # End boundary
        yield (f"--{boundary}--\r\n").encode("utf-8")

    resp = Response(stream_with_context(generate_multipart()), mimetype=mime)
    resp.headers["Cache-Control"] = "no-store"
    # byte-range seeking does not make sense for multipart container; omit Accept-Ranges
    return resp

if __name__ == "__main__":
    # If SciPy/soundfile aren’t installed:
    #   pip install numpy scipy soundfile
    app.run(host="127.0.0.1", port=5000, debug=True)
