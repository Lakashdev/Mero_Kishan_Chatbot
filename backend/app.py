import os
import re
import tempfile

from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from openai import OpenAI

from transformers import pipeline
import torch

# ---------------- ENV SETUP ----------------
load_dotenv()

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

if not GITHUB_TOKEN:
    raise Exception("❌ ERROR: GITHUB_TOKEN is missing. Add it to your .env file.")

# ---------------- FLASK INIT ----------------
app = Flask(__name__)
CORS(app)

# ---------------- OPENAI CLIENT ----------------
client = OpenAI(
    base_url="https://models.github.ai/inference",
    api_key=GITHUB_TOKEN,
)

MODEL = "openai/gpt-4o-mini"

# ---------------- ASR PIPELINE (LOCAL NEPALI MODEL) ----------------
# Path to your locally downloaded HF model folder
ASR_MODEL_PATH = os.path.join(
    os.path.dirname(__file__),
    "nepali_asr_model",  # 👈 folder next to app.py
)

if not os.path.isdir(ASR_MODEL_PATH):
    raise Exception(f"❌ ASR model folder not found at: {ASR_MODEL_PATH}")

# device: 0 = first GPU, -1 = CPU
asr_device = 0 if torch.cuda.is_available() else -1
print(f"🚀 Loading Nepali ASR model on: {'cuda' if asr_device == 0 else 'cpu'}")
print(f"📁 Using ASR model from: {ASR_MODEL_PATH}")

asr_pipe = pipeline(
    task="automatic-speech-recognition",
    model=ASR_MODEL_PATH,
    device=asr_device,
    chunk_length_s=30,  # reasonable for short questions
)


# ---------------- UTIL: CLEAN TEXT ----------------
def clean_text(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"[*•\-\_]+", "", text)       # remove bullets, markdown
    text = re.sub(r"^\s*\d+\.\s*", "", text)    # numbered lists at start of lines
    text = re.sub(r"\s{2,}", " ", text)         # double+ spaces
    text = re.sub(r"\n{2,}", "\n", text)        # extra newlines
    return text.strip()


# ---------------- CHAT ENDPOINT ----------------
@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}
    user_message = data.get("message")

    if not user_message:
        return jsonify({"error": "Message is required"}), 400

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a Nepali agriculture expert. "
                        "Give clear, simple answers. "
                        "Use plain text only. "
                        "Do NOT use bullets, *, -, markdown or formatting. "
                        "Explain in a helpful way suitable for farmers."
                        "Give answers in Nepali language like you are talking to a farmer and as Native Nepali Speaker."
                        "Annswer in Nepali language only."

                    ),
                },
                {
                    "role": "user",
                    "content": user_message,
                },
            ],
            max_tokens=600,
            temperature=0.6,
        )

        raw_reply = response.choices[0].message.content
        clean_reply = clean_text(raw_reply)

        return jsonify({"reply": clean_reply})

    except Exception as e:
        print("ERROR in /chat:", e)
        return jsonify({
            "reply": "माफ गर्नुहोस्, अहिले प्राविधिक समस्याका कारण उत्तर दिन सकिन। कृपया फेरि प्रयास गर्नुहोस्।"
        })


# ---------------- TRANSCRIBE ENDPOINT ----------------
@app.route("/transcribe", methods=["POST"])
def transcribe():
    """
    Expects:
      - file: audio blob (webm) from browser MediaRecorder

    Returns:
      { "text": "..." }  # Nepali text from ASR model
    """
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    audio_file = request.files["file"]

    try:
        # Save incoming audio to a temp file
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
            tmp_path = tmp.name
            audio_file.save(tmp_path)

        print("🎙 Transcribing (Nepali ASR) file:", tmp_path)

        # Call the Nepali ASR pipeline
        result = asr_pipe(tmp_path)  # {"text": "...", "chunks": [...]}
        text = (result.get("text") or "").strip()

        print("📝 Transcription result:", text)

        if not text:
            return jsonify({"error": "Empty transcription"}), 500

        return jsonify({"text": text})

    except Exception as e:
        print("Transcription error:", e)
        return jsonify({"error": "Transcription failed"}), 500


# ---------------- HOME ----------------
@app.route("/", methods=["GET"])
def home():
    return "🌾 Mero Kisan API (GitHub Models + Local Nepali ASR) is running!"


if __name__ == "__main__":
    app.run(debug=False)
