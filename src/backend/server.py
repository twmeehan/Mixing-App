# server.py
import os, random
from flask import Flask, Response, stream_with_context
from flask_cors import CORS  # pip install flask-cors

app = Flask(__name__)
CORS(app)  # allows requests from your React dev server (localhost:3000/5173)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SOUNDS_DIR = os.path.join(BASE_DIR, "sounds")

AUDIO_FILES = [
    os.path.join(SOUNDS_DIR, "serverloop1.wav"),
    os.path.join(SOUNDS_DIR, "serverloop2.wav"),
    os.path.join(SOUNDS_DIR, "serverloop3.wav"),
]

@app.get("/")
def index():
    return """
<!doctype html>
<title>Audio Stream</title>
<audio controls autoplay src="/stream"></audio>
"""

@app.get("/stream")
def stream():
    chosen = random.choice(AUDIO_FILES)

    def generate(path):
      with open(path, "rb") as f:
        while chunk := f.read(8192):
          yield chunk

    resp = Response(stream_with_context(generate(chosen)), mimetype="audio/wav")
    # Helpful headers
    resp.headers["Cache-Control"] = "no-store"
    resp.headers["Accept-Ranges"] = "bytes"  # some players like seeing this
    return resp



if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
