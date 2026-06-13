"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "pickup-note";

export function PickupNote() {
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const [visible, setVisible] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) ?? "";
    setText(saved);
    setVisible(true);
  }, []);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  function save(value: string) {
    setText(value);
    localStorage.setItem(STORAGE_KEY, value);
  }

  function handleBlur() {
    setEditing(false);
    if (!text.trim()) save("");
  }

  if (!visible) return null;

  return (
    <div className={`pickup-note${text ? " pickup-note--filled" : ""}`}>
      {editing ? (
        <textarea
          ref={textareaRef}
          className="pickup-note-textarea"
          value={text}
          onChange={(e) => save(e.target.value)}
          onBlur={handleBlur}
          placeholder="Where did I leave off…"
          rows={4}
        />
      ) : (
        <button
          className="pickup-note-display"
          onClick={() => setEditing(true)}
          title="Click to edit pickup note"
        >
          {text ? (
            <span className="pickup-note-text">{text}</span>
          ) : (
            <span className="pickup-note-empty">📍 Pick up here</span>
          )}
        </button>
      )}
      {text && !editing && (
        <button
          className="pickup-note-clear"
          onClick={() => save("")}
          title="Clear note"
        >
          ✕
        </button>
      )}
    </div>
  );
}
