import os, random
from backend.utils.equalization import apply_peq
from flask import Flask, Response, stream_with_context, request
from flask_cors import CORS
import subprocess

app = Flask(__name__)
CORS(app)

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
<audio id="player" controls autoplay src="/stream?version=orig"></audio>
<button onclick="toggle()">Toggle</button>
<script>
let toggled = false;
function toggle() {
  const player = document.getElementById("player");
  toggled = !toggled;
  // add cache-buster so browser reloads the stream
  player.src = toggled ? "/stream?version=edited&rand=" + Math.random()
                       : "/stream?version=orig&rand=" + Math.random();
  player.load();
  player.play();
}
</script>
"""

@app.get("/stream")
def stream():
    version = request.args.get("version", "orig")
    chosen = AUDIO_FILES[0]

    def generate(path, edited=False):
        if not edited:
            # Just stream the file as-is
            with open(path, "rb") as f:
                while chunk := f.read(8192):
                    yield chunk
        else:
            # Edited version: apply obvious highpass filter
            with open(path, "rb") as f:
                while chunk := apply_peq(f.read(8192),f0=500,Q=1,gain_db=15):
                    yield chunk

    edited = (version == "edited")
    resp = Response(stream_with_context(generate(chosen, edited=edited)), mimetype="audio/wav")
    resp.headers["Cache-Control"] = "no-store"
    resp.headers["Accept-Ranges"] = "bytes"
    return resp

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
