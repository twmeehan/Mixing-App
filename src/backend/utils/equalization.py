import io
import numpy as np
from scipy.io import wavfile
from scipy.signal import iirpeak, lfilter

def apply_peq(wav_bytes, f0=2000, Q=10, gain_db=15):
    # Load WAV from bytes
    buf = io.BytesIO(wav_bytes)
    sr, data = wavfile.read(buf)

    # Convert to float for DSP
    data = data.astype(np.float64)

    # Design parametric EQ
    b, a = iirpeak(f0 / (sr/2), Q)
    gain = 10**(gain_db / 20.0)
    b = b * gain

    # Apply filter
    y = lfilter(b, a, data)

    # Clip back to int16 for WAV
    y = np.clip(y, -32768, 32767).astype(np.int16)

    # Save back to WAV bytes
    out_buf = io.BytesIO()
    wavfile.write(out_buf, sr, y)
    return out_buf.getvalue()