import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  setDoc,
  Timestamp,
  where
} from "firebase/firestore";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { auth, db, provider } from "./firebase";
import { books, plans, PlanType } from "./data/bible";

type UserDoc = {
  uid: string;
  displayName: string;
  planType: PlanType;
  createdAt: Timestamp;
};

type ProgressDoc = {
  completed?: boolean;
  completedAt?: Timestamp;
  reads?: number;
  lastReadAt?: Timestamp;
};

type EventDoc = {
  type: "read";
  chapterId: string;
  source: "plan" | "extra";
  at: Timestamp;
};

const dayKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const addDays = (date: Date, delta: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + delta);
  return d;
};

const pad3 = (value: number) => value.toString().padStart(3, "0");

const AuthScreen = () => {
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setError(null);
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError("Sign-in failed. Please try again.");
    }
  };

  return (
    <div className="centered">
      <div className="card auth">
        <h1>Bible Tracker</h1>
        <p>Sign in with Google to continue.</p>
        <button className="primary" onClick={handleSignIn}>
          Sign in with Google
        </button>
        {error ? <p className="error">{error}</p> : null}
      </div>
    </div>
  );
};

const Onboarding = ({ user, onComplete }: { user: User; onComplete: (doc: UserDoc) => void }) => {
  const [planType, setPlanType] = useState<PlanType>("asWritten");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const docRef = doc(db, "users", user.uid);
    const userDoc: UserDoc = {
      uid: user.uid,
      displayName: user.displayName ?? "",
      planType,
      createdAt: Timestamp.now()
    };
    await setDoc(docRef, userDoc);
    onComplete(userDoc);
  };

  return (
    <div className="centered">
      <div className="card">
        <h2>Choose your plan</h2>
        <div className="radio-group">
          <label>
            <input
              type="radio"
              name="plan"
              checked={planType === "asWritten"}
              onChange={() => setPlanType("asWritten")}
            />
            Canonical order
          </label>
          <label>
            <input
              type="radio"
              name="plan"
              checked={planType === "chronological"}
              onChange={() => setPlanType("chronological")}
            />
            Chronological (placeholder)
          </label>
        </div>
        <button className="primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Continue"}
        </button>
      </div>
    </div>
  );
};

const AnalyticsView = ({
  totalChapters,
  completedCount,
  events
}: {
  totalChapters: number;
  completedCount: number;
  events: EventDoc[];
}) => {
  const now = new Date();
  const start7 = startOfDay(addDays(now, -6));
  const start14 = startOfDay(addDays(now, -13));

  const eventsLast7 = events.filter((event) => event.at.toDate() >= start7).length;
  const eventsLast14 = events.filter((event) => event.at.toDate() >= start14).length;

  const avgLast7 = (eventsLast7 / 7).toFixed(1);

  const daysWithReads = new Set(events.map((event) => dayKey(event.at.toDate())));
  let streak = 0;
  for (let offset = 0; ; offset += 1) {
    const key = dayKey(addDays(now, -offset));
    if (daysWithReads.has(key)) {
      streak += 1;
    } else {
      break;
    }
  }

  let etaLabel = "N/A";
  if (completedCount >= totalChapters) {
    etaLabel = "Completed";
  } else if (eventsLast14 > 0) {
    const pace = eventsLast14 / 14;
    const remaining = totalChapters - completedCount;
    const daysNeeded = Math.ceil(remaining / pace);
    const etaDate = addDays(now, daysNeeded);
    etaLabel = etaDate.toLocaleDateString();
  }

  return (
    <div className="panel">
      <h2>Analytics</h2>
      <div className="stats">
        <div className="stat">
          <div className="stat__label">Completed</div>
          <div className="stat__value">
            {completedCount} / {totalChapters}
          </div>
        </div>
        <div className="stat">
          <div className="stat__label">Chapters per day (7d)</div>
          <div className="stat__value">{avgLast7}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Current streak</div>
          <div className="stat__value">{streak} days</div>
        </div>
        <div className="stat">
          <div className="stat__label">ETA finish</div>
          <div className="stat__value">{etaLabel}</div>
        </div>
      </div>
    </div>
  );
};

const ChaptersView = ({
  plan,
  progressMap,
  onReadChapter,
  onAddExtra
}: {
  plan: string[];
  progressMap: Record<string, ProgressDoc>;
  onReadChapter: (chapterId: string) => void;
  onAddExtra: (chapterId: string) => void;
}) => {
  const [showModal, setShowModal] = useState(false);
  const [bookIndex, setBookIndex] = useState(0);
  const [chapterNumber, setChapterNumber] = useState(1);

  useEffect(() => {
    const maxChapters = books[bookIndex].chapterCount;
    if (chapterNumber > maxChapters) {
      setChapterNumber(1);
    }
  }, [bookIndex, chapterNumber]);

  const handleAddExtra = () => {
    const book = books[bookIndex];
    const chapterId = `${book.abbr}-${pad3(chapterNumber)}`;
    onAddExtra(chapterId);
    setShowModal(false);
  };

  return (
    <div className="panel">
      <div className="panel__header">
        <h2>Chapters</h2>
        <button className="secondary" onClick={() => setShowModal(true)}>
          Add Extra Chapter
        </button>
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
              onClick={() => onReadChapter(chapterId)}
            >
              <span>{chapterId}</span>
              <span className="chapter__status">{completed ? "Completed" : "Tap to complete"}</span>
            </button>
          );
        })}
      </div>

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
};

const ProfileView = ({
  user,
  userDoc,
  onUpdateName
}: {
  user: User;
  userDoc: UserDoc;
  onUpdateName: (name: string) => void;
}) => {
  const [name, setName] = useState(userDoc.displayName);
  const [saving, setSaving] = useState(false);

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
        <button className="secondary" onClick={() => signOut(auth)}>
          Log out
        </button>
      </div>
      <p className="muted">Signed in as {user.email}</p>
    </div>
  );
};

const MainApp = ({ user, userDoc, onUserDocUpdate }: { user: User; userDoc: UserDoc; onUserDocUpdate: (doc: UserDoc) => void }) => {
  const [tabIndex, setTabIndex] = useState(1);
  const [progressMap, setProgressMap] = useState<Record<string, ProgressDoc>>({});
  const [events, setEvents] = useState<EventDoc[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const touchStartX = useRef<number | null>(null);

  const plan = plans[userDoc.planType];

  useEffect(() => {
    const loadProgress = async () => {
      setLoadingProgress(true);
      const snapshot = await getDocs(collection(db, "users", user.uid, "progress"));
      const data: Record<string, ProgressDoc> = {};
      snapshot.forEach((docSnap) => {
        data[docSnap.id] = docSnap.data() as ProgressDoc;
      });
      setProgressMap(data);
      setLoadingProgress(false);
    };

    const loadEvents = async () => {
      setLoadingEvents(true);
      const thirtyDaysAgo = addDays(new Date(), -30);
      const eventsQuery = query(
        collection(db, "users", user.uid, "events"),
        where("at", ">=", Timestamp.fromDate(thirtyDaysAgo))
      );
      const snapshot = await getDocs(eventsQuery);
      const data: EventDoc[] = [];
      snapshot.forEach((docSnap) => {
        data.push(docSnap.data() as EventDoc);
      });
      setEvents(data);
      setLoadingEvents(false);
    };

    loadProgress();
    loadEvents();
  }, [user.uid]);

  const completedCount = useMemo(() => {
    return plan.filter((chapterId) => progressMap[chapterId]?.completed).length;
  }, [plan, progressMap]);

  const handleReadChapter = async (chapterId: string) => {
    const now = Timestamp.now();
    const docRef = doc(db, "users", user.uid, "progress", chapterId);
    await setDoc(
      docRef,
      {
        completed: true,
        completedAt: now,
        lastReadAt: now,
        reads: increment(1)
      },
      { merge: true }
    );
    await addDoc(collection(db, "users", user.uid, "events"), {
      type: "read",
      chapterId,
      source: "plan",
      at: now
    });

    setProgressMap((prev) => {
      const existing = prev[chapterId];
      return {
        ...prev,
        [chapterId]: {
          ...existing,
          completed: true,
          completedAt: now,
          lastReadAt: now,
          reads: (existing?.reads ?? 0) + 1
        }
      };
    });
    setEvents((prev) => [...prev, { type: "read", chapterId, source: "plan", at: now }]);

    const index = plan.indexOf(chapterId);
    for (let i = index + 1; i < plan.length; i += 1) {
      const nextId = plan[i];
      if (!progressMap[nextId]?.completed && nextId !== chapterId) {
        setTimeout(() => {
          const el = document.querySelector(`[data-chapter-id="${nextId}"]`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 0);
        break;
      }
    }
  };

  const handleAddExtra = async (chapterId: string) => {
    const now = Timestamp.now();
    const docRef = doc(db, "users", user.uid, "progress", chapterId);
    await setDoc(
      docRef,
      {
        lastReadAt: now,
        reads: increment(1)
      },
      { merge: true }
    );
    await addDoc(collection(db, "users", user.uid, "events"), {
      type: "read",
      chapterId,
      source: "extra",
      at: now
    });

    setProgressMap((prev) => {
      const existing = prev[chapterId];
      return {
        ...prev,
        [chapterId]: {
          ...existing,
          lastReadAt: now,
          reads: (existing?.reads ?? 0) + 1
        }
      };
    });
    setEvents((prev) => [...prev, { type: "read", chapterId, source: "extra", at: now }]);
  };

  const handleUpdateName = async (name: string) => {
    const docRef = doc(db, "users", user.uid);
    const updated = { ...userDoc, displayName: name };
    await setDoc(docRef, updated, { merge: true });
    onUserDocUpdate(updated);
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0].clientX;
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = event.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 60) {
      if (delta < 0) {
        setTabIndex((prev) => Math.min(prev + 1, 2));
      } else {
        setTabIndex((prev) => Math.max(prev - 1, 0));
      }
    }
    touchStartX.current = null;
  };

  const isLoading = loadingProgress || loadingEvents;

  return (
    <div className="app-shell" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <main className="content">
        {isLoading ? (
          <div className="centered">
            <p>Loading your data...</p>
          </div>
        ) : null}
        {!isLoading && tabIndex === 0 ? (
          <AnalyticsView totalChapters={plan.length} completedCount={completedCount} events={events} />
        ) : null}
        {!isLoading && tabIndex === 1 ? (
          <ChaptersView
            plan={plan}
            progressMap={progressMap}
            onReadChapter={handleReadChapter}
            onAddExtra={handleAddExtra}
          />
        ) : null}
        {!isLoading && tabIndex === 2 ? (
          <ProfileView user={user} userDoc={userDoc} onUpdateName={handleUpdateName} />
        ) : null}
      </main>

      <nav className="bottom-nav">
        <button className={tabIndex === 0 ? "active" : ""} onClick={() => setTabIndex(0)}>
          Analytics
        </button>
        <button className={tabIndex === 1 ? "active" : ""} onClick={() => setTabIndex(1)}>
          Chapters
        </button>
        <button className={tabIndex === 2 ? "active" : ""} onClick={() => setTabIndex(2)}>
          Profile
        </button>
      </nav>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setUserDoc(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      const docRef = doc(db, "users", currentUser.uid);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        setUserDoc(snapshot.data() as UserDoc);
      } else {
        setUserDoc(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="centered">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (!userDoc) {
    return <Onboarding user={user} onComplete={setUserDoc} />;
  }

  return <MainApp user={user} userDoc={userDoc} onUserDocUpdate={setUserDoc} />;
}
