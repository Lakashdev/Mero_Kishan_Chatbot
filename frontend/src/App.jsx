import React from "react";
import ChatWidget from "./ChatWidget";
import "./chatWidget.css";

export default function App() {
  return (
    <div className="app-root">
      {/* Your normal website content */}
      <header className="app-header">
        <h1>Mero Kisan – Agriculture Assistant</h1>
        <p>Ask questions about crops, soil, fertilizer, pests, and more.</p>
      </header>

      {/* Floating Chat Widget */}
      <ChatWidget />
    </div>
  );
}
