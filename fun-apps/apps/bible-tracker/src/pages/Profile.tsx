import React, { useEffect, useMemo, useState } from "react";
import { User } from "firebase/auth";
import { books } from "../data/bible";
import { EventDoc, UserDoc } from "../types";

const pad3 = (value: number) => value.toString().padStart(3, "0");

type ProfileProps = {
  user: User;
  userDoc: UserDoc;
  events: EventDoc[];
  onUpdateName: (name: string) => Promise<void>;
  onLogout: () => void;
};

const getBookReads = (events: EventDoc[]) => {
  const map: Record<string, number> = {};
  events.forEach((event) => {
    map[event.chapterId] = (map[event.chapterId] ?? 0) + 1;
  });
  return map;
};

export default function Profile({ user, userDoc, events, onUpdateName, onLogout }: ProfileProps) {
  const [name, setName] = useState(userDoc.displayName);
  const [saving, setSaving] = useState(false);
  const [showBible, setShowBible] = useState(false);

  const readsByChapter = useMemo(() => getBookReads(events), [events]);

  const readsByBook = useMemo(() => {
    const map: Record<string, number> = {};
    books.forEach((book) => {
      let count = 0;
      for (let i = 1; i <= book.chapterCount; i += 1) {
        const chapterId = `${book.abbr}-${pad3(i)}`;
        count += readsByChapter[chapterId] ?? 0;
      }
      map[book.abbr] = count;
    });
    return map;
  }, [readsByChapter]);

  const maxBookReads = useMemo(() => {
    return Math.max(1, ...Object.values(readsByBook));
  }, [readsByBook]);

  const oldTestament = books.slice(0, 39);
  const newTestament = books.slice(39);

  useEffect(() => {
    setName(userDoc.displayName);
  }, [userDoc.displayName]);

  const handleSave = async () => {
    setSaving(true);
    await onUpdateName(name);
    setSaving(false);
  };

  return (
    <div className="panel">
      <h2>Profile</h2>
      <div className="field">
        <label>Display name</label>
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="field">
        <label>Plan type</label>
        <div className="pill">{userDoc.planType}</div>
      </div>
      <div className="profile-actions">
        <button className="primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
        <button className="secondary" onClick={onLogout}>
          Log out
        </button>
        <button className="secondary" onClick={() => setShowBible(true)}>
          Show My Bible
        </button>
      </div>
      <p className="muted">Signed in as {user.email}</p>

      {showBible ? (
        <div className="modal-backdrop" onClick={() => setShowBible(false)}>
          <div className="modal modal--bible" onClick={(event) => event.stopPropagation()}>
            <div className="modal__header">
              <h3>My Bible Heatmap</h3>
              <button className="secondary" onClick={() => setShowBible(false)}>
                Close
              </button>
            </div>
            <p className="muted">Darker red means more reads within a book.</p>
            <div className="bible-spread">
              <div className="bible-page">
                {oldTestament.map((book) => {
                  const reads = readsByBook[book.abbr] ?? 0;
                  const intensity = Math.min(1, reads / maxBookReads);
                  return (
                    <div
                      key={book.abbr}
                      className="bible-book-block"
                      style={{ flex: book.chapterCount }}
                      title={`${book.name}: ${reads} read${reads === 1 ? "" : "s"}`}
                    >
                      <span>{book.name}</span>
                      <span className="bible-book-bar">
                        <span className="bible-book-fill" style={{ transform: `scaleX(${intensity})` }} />
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="bible-spine" />
              <div className="bible-page">
                {newTestament.map((book) => {
                  const reads = readsByBook[book.abbr] ?? 0;
                  const intensity = Math.min(1, reads / maxBookReads);
                  return (
                    <div
                      key={book.abbr}
                      className="bible-book-block"
                      style={{ flex: book.chapterCount }}
                      title={`${book.name}: ${reads} read${reads === 1 ? "" : "s"}`}
                    >
                      <span>{book.name}</span>
                      <span className="bible-book-bar">
                        <span className="bible-book-fill" style={{ transform: `scaleX(${intensity})` }} />
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
