import React, { useState, useRef, useEffect } from "react";

const API_URL = "http://127.0.0.1:5000/chat";        // Flask chat backend
const TRANSCRIBE_URL = "http://127.0.0.1:5000/transcribe"; // Flask STT backend

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
  const messagesEndRef = useRef(null);

  const [voices, setVoices] = useState([]);
  const [isListening, setIsListening] = useState(false); // now = recording state
  const [language, setLanguage] = useState("ne-NP"); // UI mode: Nepali or English

  // NEW: MediaRecorder instead of SpeechRecognition
  const mediaRecorderRef = useRef(null);
  const textareaRef = useRef(null);
  const MAX_INPUT_HEIGHT = 160; // px - allow textarea to grow for several lines

  // 1️⃣ Load speech voices (for TTS)
  useEffect(() => {
    function loadVoices() {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
    }

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // 2️⃣ Auto-scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const toggleWidget = () => setIsOpen((prev) => !prev);

  // Detect Nepali vs English for choosing TTS voice
  const isNepaliText = (text) => /[\u0900-\u097F]/.test(text);

  // 3️⃣ Text-to-Speech (same logic as before)
  const speakText = (text) => {
    if (!window.speechSynthesis || !voices.length) return;

    const msg = new SpeechSynthesisUtterance(text);
    const nepali = isNepaliText(text);

    let selectedVoice = null;

    if (nepali) {
      // try Nepali, else Hindi
      selectedVoice = voices.find((v) =>
        v.lang.toLowerCase().includes("ne")
      );
      if (!selectedVoice) {
        selectedVoice = voices.find((v) =>
          v.lang.toLowerCase().includes("hi")
        );
      }
      msg.lang = "ne-NP";
    } else {
      selectedVoice = voices.find((v) =>
        v.lang.toLowerCase().includes("en")
      );
      msg.lang = "en-US";
    }

    if (selectedVoice) msg.voice = selectedVoice;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(msg);
  };

  // 4️⃣ Send message to backend (/chat)
  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setMessages((prev) => [...prev, { sender: "user", text: trimmed }]);
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

      setMessages((prev) => [...prev, { sender: "bot", text: reply }]);
      speakText(reply);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
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

  // Auto-resize helpers for the textarea
  const resizeTextarea = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    try {
      ta.style.height = "auto";
      const newHeight = Math.min(ta.scrollHeight, MAX_INPUT_HEIGHT);
      ta.style.height = newHeight + "px";
    } catch (e) {
      // ignore resize errors
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    // resize immediately while typing
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, MAX_INPUT_HEIGHT) + "px";
    }
  };

  useEffect(() => {
    // When `input` changes (including when STT appends text), ensure the textarea is resized
    resizeTextarea();
  }, [input, isOpen]);

  // 5️⃣ Voice Input: record audio and send to /transcribe
  const startRecording = async () => {
    try {
      // If there's any existing text, clear it when starting a new recording
      if (input && input.trim()) {
        setInput("");
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mediaRecorder = new MediaRecorder(stream);
      const chunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm" });

        const formData = new FormData();
        formData.append("file", blob, "audio.webm");
        formData.append("language", language.startsWith("ne") ? "ne" : "en");

        try {
          const res = await fetch(TRANSCRIBE_URL, {
            method: "POST",
            body: formData,
          });

          const data = await res.json();
          console.log("Transcription response:", data);

          if (data.text) {
            // append transcribed text into input
            setInput((prev) => (prev ? prev + " " + data.text : data.text));
          } else {
            console.error("No text in transcription response", data);
          }
        } catch (err) {
          console.error("Transcription error", err);
        }

        // stop mic tracks
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsListening(true); // now: recording
    } catch (err) {
      console.error("Error accessing microphone", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsListening(false);
    }
  };

  // 6️⃣ Toggle UI language (affects placeholder + STT language for backend)
  const toggleLanguage = () => {
    setLanguage((prev) => (prev === "ne-NP" ? "en-US" : "ne-NP"));
  };

  return (
    <>
      {/* Floating Button */}
      <button className="chat-float-btn" onClick={toggleWidget}>
        {isOpen ? "✕" : "💬"}
      </button>

      {/* Chat Panel */}
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
              🔊
            </button>
            <button className="icon-btn" onClick={toggleWidget}>
              ✕
            </button>
          </div>
        </div>

        {/* Messages */}
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
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="chat-input-area">
          <button
            className="language-btn"
            onClick={toggleLanguage}
            title={`Switch to ${
              language === "ne-NP" ? "English" : "Nepali"
            }`}
          >
            {language === "ne-NP" ? "नेपाली" : "EN"}
          </button>
          <textarea
            ref={textareaRef}
            rows={1}
            className="chat-input"
            placeholder={
              language === "ne-NP"
                ? "Nepal मा प्रश्न सोध्नुस..."
                : "Ask about crops, soil, fertilizer, pests…"
            }
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
          />
          <button
            className={`voice-btn ${isListening ? "listening" : ""}`}
            onClick={isListening ? stopRecording : startRecording}
            title={isListening ? "Stop recording" : "Start voice input"}
          >
            {isListening ? "🎙️" : "🎤"}
          </button>
          <button
            className="send-btn"
            onClick={sendMessage}
            disabled={isLoading}
          >
            ➤
          </button>
        </div>
      </div>
    </>
  );
}
