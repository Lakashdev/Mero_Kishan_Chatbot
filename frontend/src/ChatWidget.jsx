import React, { useState, useRef, useEffect } from "react";

const API_URL = "http://127.0.0.1:5000/chat"; // Flask backend

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

  // 1️⃣ Load speech voices properly
  useEffect(() => {
    function loadVoices() {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
    }

    loadVoices();

    // Chrome loads voices asynchronously
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // 2️⃣ Auto-scroll
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const toggleWidget = () => setIsOpen((prev) => !prev);

  // Detect Nepali vs English
  const isNepaliText = (text) => /[\u0900-\u097F]/.test(text);

  // 3️⃣ Text-to-Speech (Improved)
  const speakText = (text) => {
    if (!window.speechSynthesis || !voices.length) return;

    const msg = new SpeechSynthesisUtterance(text);
    const nepali = isNepaliText(text);

    let selectedVoice = null;

    if (nepali) {
      // Try Nepali (rare on Chrome)
      selectedVoice = voices.find((v) =>
        v.lang.toLowerCase().includes("ne")
      );

      // Try Hindi as fallback (best for Nepali)
      if (!selectedVoice) {
        selectedVoice = voices.find((v) =>
          v.lang.toLowerCase().includes("hi")
        );
      }

      msg.lang = "ne-NP";
    } else {
      // English
      selectedVoice = voices.find((v) =>
        v.lang.toLowerCase().includes("en")
      );
      msg.lang = "en-US";
    }

    if (selectedVoice) msg.voice = selectedVoice;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(msg);
  };

  // 4️⃣ Send message to backend
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
        data.reply ||
        "Sorry, I could not understand. Please try again.";

      setMessages((prev) => [...prev, { sender: "bot", text: reply }]);
      speakText(reply);
    } catch (err) {
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
            <button className="icon-btn" title="Read aloud" onClick={repeatLastBotMessage}>
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
          <textarea
            rows={1}
            className="chat-input"
            placeholder="Ask about crops, soil, fertilizer, pests…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="send-btn" onClick={sendMessage} disabled={isLoading}>
            ➤
          </button>
        </div>
      </div>
    </>
  );
}
