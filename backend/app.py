from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import re
from dotenv import load_dotenv
from openai import OpenAI

# Load .env file
load_dotenv()

# ---------------- INIT ----------------
app = Flask(__name__)
CORS(app)

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

if not GITHUB_TOKEN:
    raise Exception("❌ ERROR: GITHUB_TOKEN is missing. Add it to your .env file.")

client = OpenAI(
    base_url="https://models.github.ai/inference",
    api_key=GITHUB_TOKEN,
)

MODEL = "openai/gpt-4o-mini"


# ---------------- CLEAN TEXT ----------------
def clean_text(text):
    if not text:
        return ""
    text = re.sub(r"[*•\-\_]+", "", text)       # remove bullets, markdown
    text = re.sub(r"^\s*\d+\.\s*", "", text)    # numbered lists
    text = re.sub(r"\s{2,}", " ", text)         # double spaces
    text = re.sub(r"\n{2,}", "\n", text)        # extra newlines
    return text.strip()


# ---------------- CHAT ENDPOINT ----------------
@app.route("/chat", methods=["POST"])
def chat():
    user_message = request.json.get("message")

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
                        ""
                    ),
                },
                {
                    "role": "user",
                    "content": user_message,
                }
            ],
            max_tokens=600,
            temperature=0.6,
        )

        raw_reply = response.choices[0].message.content
        clean_reply = clean_text(raw_reply)

        return jsonify({"reply": clean_reply})

    except Exception as e:
        print("ERROR:", e)
        return jsonify({
            "reply": "माफ गर्नुहोस्, अहिले प्राविधिक समस्याका कारण उत्तर दिन सकिन। कृपया फेरि प्रयास गर्नुहोस्।"
        })


# ---------------- HOME ----------------
@app.route("/", methods=["GET"])
def home():
    return "🌾 Agriculture Chatbot API (GitHub Models / GPT-5) is running!"


if __name__ == "__main__":
    app.run(debug=True)
