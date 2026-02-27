import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { books, getChapterLabel } from "../data/bible";
import { ProgressDoc } from "../types";

const pad3 = (value: number) => value.toString().padStart(3, "0");

type ResumeInfo = {
  firstUnreadId: string | null;
  lastCompletedId: string | null;
};

type ChaptersProps = {
  plan: string[];
  progressMap: Record<string, ProgressDoc>;
  onToggleChapter: (chapterId: string) => void;
  onAddExtra: (chapterId: string) => void;
  resumeInfo: ResumeInfo;
  autoScrollKey: string;
};

const scrollToChapter = (chapterId: string) => {
  const element = document.querySelector(`[data-chapter-id="${chapterId}"]`);
  if (element) {
    element.scrollIntoView({ behavior: "smooth", block: "center" });
  }
};

type ConfettiPiece = {
  id: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  delay: number;
  color: string;
  rotate: number;
  spin: number;
};

const confettiPalette = ["#f7d56b", "#ffd48a", "#d83c3c", "#f2efe2", "#7ad7ff"];

const createConfetti = (x: number, y: number) => {
  return Array.from({ length: 42 }).map((_, index) => {
    const dx = (Math.random() - 0.5) * 320;
    const dy = 260 + Math.random() * 360;
    return {
      id: `${Date.now()}-${index}`,
      x,
      y,
      dx,
      dy,
      delay: Math.random() * 0.12,
      color: confettiPalette[index % confettiPalette.length],
      rotate: Math.random() * 180,
      spin: 220 + Math.random() * 200
    };
  });
};

const playConfettiSound = () => {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    const ctx = new AudioContextClass();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(620, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(280, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.24);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.26);
    oscillator.onended = () => ctx.close();
  } catch {
    // Ignore sound errors (autoplay policies).
  }
};

export default function Chapters({ plan, progressMap, onToggleChapter, onAddExtra, resumeInfo, autoScrollKey }: ChaptersProps) {
  const [showModal, setShowModal] = useState(false);
  const [bookIndex, setBookIndex] = useState(0);
  const [chapterNumber, setChapterNumber] = useState(1);
  const [autoScrolled, setAutoScrolled] = useState(false);
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    const maxChapters = books[bookIndex].chapterCount;
    if (chapterNumber > maxChapters) {
      setChapterNumber(1);
    }
  }, [bookIndex, chapterNumber]);

  useEffect(() => {
    if (autoScrolled) return;
    if (localStorage.getItem(`autoScroll:${autoScrollKey}`) === "done") {
      setAutoScrolled(true);
      return;
    }
    if (resumeInfo.firstUnreadId) {
      scrollToChapter(resumeInfo.firstUnreadId);
      setAutoScrolled(true);
      localStorage.setItem(`autoScroll:${autoScrollKey}`, "done");
    }
  }, [autoScrolled, autoScrollKey, resumeInfo.firstUnreadId]);

  const handleAddExtra = () => {
    const book = books[bookIndex];
    const chapterId = `${book.abbr}-${pad3(chapterNumber)}`;
    onAddExtra(chapterId);
    setShowModal(false);
  };

  const totalCompleted = useMemo(() => {
    return plan.filter((chapterId) => progressMap[chapterId]?.completed).length;
  }, [plan, progressMap]);

  return (
    <div className="panel">
      <div className="panel__header panel__header--sticky">
        <div>
          <h2>Chapters</h2>
          <p className="muted">{totalCompleted} completed</p>
        </div>
        <div className="panel__actions">
          <button
            className="secondary"
            onClick={() => resumeInfo.lastCompletedId && scrollToChapter(resumeInfo.lastCompletedId)}
            disabled={!resumeInfo.lastCompletedId}
          >
            Resume
          </button>
          <button className="secondary" onClick={() => setShowModal(true)}>
            Add Extra
          </button>
        </div>
      </div>

      <div className="chapter-list">
        {plan.map((chapterId) => {
          const progress = progressMap[chapterId];
          const completed = Boolean(progress?.completed);
          return (
            <button
              key={chapterId}
              data-chapter-id={chapterId}
              className={`chapter ${completed ? "chapter--done" : ""}`}
              onClick={(event) => {
                if (!completed) {
                  const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                  const x = event.clientX || rect.left + rect.width / 2;
                  const y = event.clientY || rect.top + rect.height / 2;
                  setConfetti(createConfetti(x, y));
                  playConfettiSound();
                }
                onToggleChapter(chapterId);
              }}
            >
              <div>
                <div className="chapter__title">{getChapterLabel(chapterId)}</div>
                <div className="chapter__meta">
                  {completed ? "Completed" : "Tap to mark complete"}
                </div>
              </div>
              <div className="chapter__badge">{completed ? "✓" : ""}</div>
            </button>
          );
        })}
      </div>

      {confetti.length > 0 ? (
        createPortal(
          <div className="confetti" aria-hidden="true">
            {confetti.map((piece, index) => (
              <span
                key={piece.id}
                className="confetti__piece"
                style={{
                  left: piece.x,
                  top: piece.y,
                  backgroundColor: piece.color,
                  transform: `translate(-50%, -50%) rotate(${piece.rotate}deg)`,
                  animationDelay: `${piece.delay}s`,
                  ["--dx" as string]: `${piece.dx}px`,
                  ["--dy" as string]: `${piece.dy}px`,
                  ["--spin" as string]: `${piece.spin}deg`
                }}
                onAnimationEnd={() => {
                  if (index === confetti.length - 1) {
                    setConfetti([]);
                  }
                }}
              />
            ))}
          </div>,
          document.body
        )
      ) : null}

      {showModal ? (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>Add Extra Chapter</h3>
            <label className="field">
              Book
              <select
                value={bookIndex}
                onChange={(event) => setBookIndex(Number(event.target.value))}
              >
                {books.map((book, index) => (
                  <option key={book.abbr} value={index}>
                    {book.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Chapter
              <select
                value={chapterNumber}
                onChange={(event) => setChapterNumber(Number(event.target.value))}
              >
                {Array.from({ length: books[bookIndex].chapterCount }, (_, index) => index + 1).map(
                  (value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  )
                )}
              </select>
            </label>
            <div className="modal__actions">
              <button className="secondary" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="primary" onClick={handleAddExtra}>
                Log Reading
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
