# utils/audio_file_factory.py
import os, random
from io import BytesIO
import numpy as np
import soundfile as sf
import librosa
from scipy.signal import lfilter

# ====== USER-CONTROLLABLE EQ PARAMETERS (server reads them here) ======
GAIN_DB_DEFAULT = 20.0    # boost (dB)
Q_DEFAULT       = 1.5     # peaking EQ Q
# =====================================================================

def _design_peaking_biquad(fs: float, f0: float, q: float, gain_db: float):
    """
    RBJ Audio EQ Cookbook - peaking EQ (bell).
    Returns (b, a) for lfilter.
    """
    A  = 10 ** (gain_db / 40.0)
    w0 = 2.0 * np.pi * (f0 / fs)
    alpha = np.sin(w0) / (2.0 * q)
    cosw0 = np.cos(w0)

    b0 = 1 + alpha * A
    b1 = -2 * cosw0
    b2 = 1 - alpha * A
    a0 = 1 + alpha / A
    a1 = -2 * cosw0
    a2 = 1 - alpha / A

    b = np.array([b0, b1, b2], dtype=np.float64) / a0
    a = np.array([1.0, a1 / a0, a2 / a0], dtype=np.float64)
    return b, a

def _load_audio_any(path: str):
    """
    Load WAV/MP3 without ffmpeg usage in our code.
    librosa uses soundfile (libsndfile) when possible, otherwise audioread.
    Returns (y [np.float32, shape (n, ch)], sr, ch).
    """
    y, sr = librosa.load(path, sr=None, mono=False)  # preserve native sr
    # librosa returns (n,) for mono or (ch, n) for multi
    if y.ndim == 1:
        y = y[np.newaxis, :]  # (1, n)
    # transpose to (n, ch)
    y = y.T.astype(np.float32, copy=False)
    return y, sr, y.shape[1]

def _apply_peaking_eq(y: np.ndarray, sr: int, f0: float, q: float, gain_db: float):
    """
    Apply peaking EQ to each channel independently.
    y shape: (n, ch) float32 in [-1, 1]
    """
    b, a = _design_peaking_biquad(sr, f0, q, gain_db)
    # lfilter expects shape (n,), so process per channel
    if y.ndim == 1:
        return lfilter(b, a, y)
    out = np.empty_like(y)
    for c in range(y.shape[1]):
        out[:, c] = lfilter(b, a, y[:, c])
    # Avoid clipping: soft limit if needed
    peak = np.max(np.abs(out))
    if peak > 1.0:
        out = out / peak * 0.999
    return out

# --- replace _write_wav_bytes ---
def _write_wav_bytes(y: np.ndarray, sr: int) -> bytes:
    bio = BytesIO()
    # When writing to BytesIO you MUST specify format
    sf.write(bio, y, sr, format="WAV", subtype="FLOAT")
    return bio.getvalue()

# --- make bounce_eq accept optional f0 ---
def bounce_eq(path: str, f0_hz: float | None = None):
    y, sr, ch = _load_audio_any(path)
    if f0_hz is None:
        f0_hz = random.uniform(FREQ_MIN_HZ, FREQ_MAX_HZ)

    y_eq = _apply_peaking_eq(y, sr, f0=f0_hz, q=Q_DEFAULT, gain_db=GAIN_DB_DEFAULT)
    wav_bytes = _write_wav_bytes(y_eq, sr)

    base = os.path.basename(path); stem, _ = os.path.splitext(base)
    meta = {
        "filename": f"{stem}__eq.wav",
        "mime": "audio/wav",
        "eq_params": {
            "type": "peaking",
            "gain_db": GAIN_DB_DEFAULT,
            "Q": Q_DEFAULT,
            "f0_hz": round(float(f0_hz), 2),
            "sr": sr,
            "channels": ch,
        },
    }
    return wav_bytes, meta
