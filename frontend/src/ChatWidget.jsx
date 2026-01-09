import React, { useState, useRef, useEffect } from "react";

const API_URL = "http://127.0.0.1:5000/chat";
const TRANSCRIBE_URL = "http://127.0.0.1:5000/transcribe";
const SPEAK_URL = "http://127.0.0.1:5000/speak";

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text: "Namaste! I am your agriculture assistant. How can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [language, setLanguage] = useState("ne-NP");

  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const textareaRef = useRef(null);
  const audioRef = useRef(null);

  const MAX_INPUT_HEIGHT = 160;

  // ---------------- AUTO SCROLL ----------------
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const toggleWidget = () => setIsOpen((p) => !p);

  // ---------------- TEXT TO SPEECH (BACKEND) ----------------
  const speakText = async (text) => {
    try {
      if (isSpeaking) {
        audioRef.current?.pause();
        setIsSpeaking(false);
        return;
      }

      setIsSpeaking(true);

      const res = await fetch(SPEAK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => setIsSpeaking(false);
      audio.onerror = () => setIsSpeaking(false);

      audio.play();
    } catch (err) {
      console.error("TTS error:", err);
      setIsSpeaking(false);
    }
  };

  // ---------------- SEND MESSAGE ----------------
  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setMessages((p) => [...p, { sender: "user", text: trimmed }]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      const data = await res.json();
      const reply =
        data.reply || "Sorry, I could not understand. Please try again.";

      setMessages((p) => [...p, { sender: "bot", text: reply }]);
      speakText(reply);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((p) => [
        ...p,
        { sender: "bot", text: "Network error. Try again." },
      ]);
    }

    setIsLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const repeatLastBotMessage = () => {
    const last = [...messages].reverse().find((m) => m.sender === "bot");
    if (last) speakText(last.text);
  };

  // ---------------- TEXTAREA AUTO RESIZE ----------------
  const handleInputChange = (e) => {
    setInput(e.target.value);
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, MAX_INPUT_HEIGHT) + "px";
  };

  // ---------------- VOICE INPUT ----------------
  const startRecording = async () => {
    try {
      setIsTranscribing(false);
      setInput("");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("file", blob, "audio.webm");

        try {
          const res = await fetch(TRANSCRIBE_URL, {
            method: "POST",
            body: formData,
          });

          const data = await res.json();
          if (data.text) {
            setInput(data.text);
          }
        } catch (err) {
          console.error("Transcription error", err);
        }

        setIsTranscribing(false);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsListening(true);
    } catch (err) {
      console.error("Mic access error", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      setIsTranscribing(true);
      mediaRecorderRef.current.stop();
      setIsListening(false);
    }
  };

  // ---------------- LANGUAGE TOGGLE ----------------
  const toggleLanguage = () => {
    setLanguage((p) => (p === "ne-NP" ? "en-US" : "ne-NP"));
  };

  // ---------------- UI ----------------
  return (
    <>
      <button className="chat-float-btn" onClick={toggleWidget}>
        {isOpen ? "✕" : "💬"}
      </button>

      <div className={`chat-panel ${isOpen ? "open" : ""}`}>
        <div className="chat-header">
          <div>
            <strong>Mero Kisan</strong>
            <div className="chat-subtitle">Agriculture AI assistant</div>
          </div>

          <div className="chat-header-actions">
            <button
              className="icon-btn"
              title="Read aloud"
              onClick={repeatLastBotMessage}
            >
              {isSpeaking ? "Stop" : "Speak"}
            </button>
            <button className="icon-btn" onClick={toggleWidget}>
              ✕
            </button>
          </div>
        </div>

        <div className="chat-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`chat-message ${msg.sender}`}>
              <div className="bubble">{msg.text}</div>
            </div>
          ))}

          {isLoading && (
            <div className="chat-message bot">
              <div className="bubble typing">Thinking…</div>
            </div>
          )}

          {isTranscribing && (
            <div className="chat-message bot">
              <div className="bubble typing">Processing voice…</div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          <button className="language-btn" onClick={toggleLanguage}>
            {language === "ne-NP" ? "नेपाली" : "EN"}
          </button>

          <textarea
            ref={textareaRef}
            rows={1}
            className="chat-input"
            placeholder={
              language === "ne-NP"
                ? "Nepali मा प्रश्न सोध्नुस..."
                : "Ask about crops, soil, fertilizer, pests…"
            }
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
          />

          <button
            className={`voice-btn ${isListening ? "listening" : ""}`}
            onClick={isListening ? stopRecording : startRecording}
          >
            {isListening ? "Stop" : "Voice"}
          </button>

          <button
            className="send-btn"
            onClick={sendMessage}
            disabled={isLoading}
          >
            Send
          </button>
        </div>
      </div>
    </>
  );
}
