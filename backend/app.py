import os
import re
import tempfile

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from dotenv import load_dotenv
from openai import OpenAI

# ---------------- ENV SETUP ----------------
load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise Exception("ERROR: OPENAI_API_KEY is missing.")

# ---------------- FLASK INIT ----------------
app = Flask(__name__)
CORS(app)

# ---------------- OPENAI CLIENT ----------------
client = OpenAI(api_key=OPENAI_API_KEY)

CHAT_MODEL = os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")
STT_MODEL  = os.getenv("OPENAI_STT_MODEL", "whisper-1")
TTS_MODEL  = os.getenv("OPENAI_TTS_MODEL", "gpt-4o-mini-tts")
TTS_VOICE = os.getenv("OPENAI_TTS_VOICE", "alloy")

# ---------------- TOON PARSER ----------------
def parse_toon(text: str) -> dict:
    """
    Very small TOON parser.
    Format:
      Q=message text;L=ne
    """
    data = {}
    parts = text.split(";")
    for p in parts:
        if "=" in p:
            k, v = p.split("=", 1)
            data[k.strip()] = v.strip()
    return data

# ---------------- UTIL: CLEAN TEXT ----------------
def clean_text(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"[*•\-\_]+", "", text)
    text = re.sub(r"^\s*\d+\.\s*", "", text)
    text = re.sub(r"\s{2,}", " ", text)
    text = re.sub(r"\n{2,}", "\n", text)
    return text.strip()

# ---------------- CHAT (TOON INPUT) ----------------
@app.route("/chat", methods=["POST"])
def chat():
    raw = request.data.decode("utf-8").strip()
    if not raw:
        return jsonify({"error": "Empty request"}), 400

    toon = parse_toon(raw)

    user_message = toon.get("Q") or raw

    if not user_message:
        return jsonify({"error": "Message missing"}), 400

    try:
        response = client.chat.completions.create(
            model=CHAT_MODEL,
messages = [
    {
        "role": "system",
        "content": (
            "You are a Nepali agriculture expert from Nepal. "
            "Always respond in pure Nepali language as spoken in Nepal. "
            "Do NOT use Hindi words, Hinglish, or Indian-style Nepali. "
            "Use natural Nepali vocabulary commonly used by farmers in Nepal. "
            "Keep the tone simple, respectful, and practical. "
            "Write in plain text only. "
            "Do NOT use bullets, symbols, markdown, or formatting. "
            "Explain things clearly like you are talking to a farmer in a village."
        ),
    },
    {"role": "user", "content": user_message},
],
            max_tokens=600,
            temperature=0.6,
        )

        reply = clean_text(response.choices[0].message.content or "")
        return jsonify({"reply": reply})

    except Exception as e:
        print("CHAT error:", e)
        return jsonify({
            "reply": "माफ गर्नुहोस्, अहिले प्राविधिक समस्याका कारण उत्तर दिन सकिन।"
        }), 500

# ---------------- SPEECH TO TEXT ----------------
@app.route("/transcribe", methods=["POST"])
def transcribe():
    if "file" not in request.files:
        return jsonify({"error": "No file"}), 400

    audio_file = request.files["file"]

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
            path = tmp.name
            audio_file.save(path)

        with open(path, "rb") as f:
            transcript = client.audio.transcriptions.create(
                file=f,
                model=STT_MODEL,
                language="ne",
            )

        text = (transcript.text or "").strip()
        if not text:
            return jsonify({"error": "Empty transcription"}), 500

        return jsonify({"text": text})

    except Exception as e:
        print("STT error:", e)
        return jsonify({"error": "Transcription failed"}), 500

# ---------------- TEXT TO SPEECH (TOON INPUT) ----------------
@app.route("/speak", methods=["POST", "OPTIONS"])
def speak():
    if request.method == "OPTIONS":
        return "", 200

    raw = request.data.decode("utf-8").strip()
    if not raw:
        return jsonify({"error": "Empty request"}), 400

    toon = parse_toon(raw)
    text = toon.get("Q") or raw

    if not text:
        return jsonify({"error": "Text missing"}), 400

    try:
        # Always enforce the same voice personality
        voice_profile = (
            "Speak in a calm, friendly native Nepali female voice. "
            "Use a neutral Nepali accent. "
            "Do not change accent, speed, or tone. "
            "Do not add emotions, or sound effects. "
            "Speak clearly like a helpful agriculture advisor."
        )

        # Combine profile + content
        tts_input = f"{voice_profile}\n\n{text}"

        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
            audio_path = tmp.name

        with client.audio.speech.with_streaming_response.create(
            model=TTS_MODEL,
            voice=TTS_VOICE,
            input=tts_input,
        ) as response:
            response.stream_to_file(audio_path)

        return send_file(audio_path, mimetype="audio/mpeg")

    except Exception as e:
        print("TTS error:", e)
        return jsonify({"error": "Text to speech failed"}), 500


# ---------------- HOME ----------------
@app.route("/", methods=["GET"])
def home():
    return "Mero Kisan API (TOON + OpenAI STT/TTS + GPT-4o Mini) is running"

if __name__ == "__main__":
    app.run(debug=False)
