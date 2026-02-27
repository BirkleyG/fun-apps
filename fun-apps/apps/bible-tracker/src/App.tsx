import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  setDoc,
  Timestamp,
  writeBatch
} from "firebase/firestore";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { auth, db, provider } from "./firebase";
import { getChapterLabel, plans, PlanType } from "./data/bible";
import { EventDoc, ProgressDoc, UserDoc } from "./types";
import Chapters from "./pages/Chapters";
import Analytics from "./pages/Analytics";
import Profile from "./pages/Profile";

const BATCH_LIMIT = 450;

type ResumeInfo = {
  firstUnreadId: string | null;
  lastCompletedId: string | null;
};

const computeResumeInfo = (plan: string[], progressMap: Record<string, ProgressDoc>): ResumeInfo => {
  const firstUnreadId = plan.find((chapterId) => !progressMap[chapterId]?.completed) ?? null;
  let lastCompletedByOrder: string | null = null;
  let lastCompletedByTime: { id: string; time: number } | null = null;

  for (const chapterId of plan) {
    const progress = progressMap[chapterId];
    if (!progress?.completed) continue;
    lastCompletedByOrder = chapterId;
    if (progress.completedAt) {
      const time = progress.completedAt.toMillis();
      if (!lastCompletedByTime || time >= lastCompletedByTime.time) {
        lastCompletedByTime = { id: chapterId, time };
      }
    }
  }

  return {
    firstUnreadId,
    lastCompletedId: lastCompletedByTime?.id ?? lastCompletedByOrder
  };
};

const seedResumeProgress = async (uid: string, plan: string[], resumeIndex: number) => {
  if (resumeIndex <= 0) return;
  const chaptersToSeed = plan.slice(0, resumeIndex);
  for (let i = 0; i < chaptersToSeed.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    const chunk = chaptersToSeed.slice(i, i + BATCH_LIMIT);
    for (const chapterId of chunk) {
      const docRef = doc(db, "users", uid, "progress", chapterId);
      batch.set(
        docRef,
        {
          completed: true,
          completedAt: null,
          lastReadAt: null,
          reads: 0,
          lastPlanEventId: null
        },
        { merge: true }
      );
    }
    await batch.commit();
  }
};

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
  const [startMode, setStartMode] = useState<"begin" | "resume" | null>(null);
  const [resumeIndex, setResumeIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  const plan = useMemo(() => plans[planType], [planType]);

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

    if (startMode === "resume" && resumeIndex > 0) {
      await seedResumeProgress(user.uid, plan, resumeIndex);
    }

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
            Chronological order
          </label>
        </div>

        <h3>Start at the Beginning or Resume a Plan</h3>
        <div className="choice-row">
          <button
            className={`choice ${startMode === "begin" ? "choice--active" : ""}`}
            onClick={() => setStartMode("begin")}
          >
            Start at the Beginning
          </button>
          <button
            className={`choice ${startMode === "resume" ? "choice--active" : ""}`}
            onClick={() => setStartMode("resume")}
          >
            Resume a Plan
          </button>
        </div>

        {startMode === "resume" ? (
          <div className="field">
            <label>Choose your current chapter</label>
            <select value={resumeIndex} onChange={(event) => setResumeIndex(Number(event.target.value))}>
              {plan.map((chapterId, index) => (
                <option key={chapterId} value={index}>
                  {getChapterLabel(chapterId)}
                </option>
              ))}
            </select>
            <p className="muted">All chapters before this will be marked complete without logging events.</p>
          </div>
        ) : null}

        <button
          className="primary"
          onClick={handleSave}
          disabled={saving || startMode === null}
        >
          {saving ? "Saving..." : "Continue"}
        </button>
      </div>
    </div>
  );
};

const MainApp = ({ user, userDoc, onUserDocUpdate }: { user: User; userDoc: UserDoc; onUserDocUpdate: (doc: UserDoc) => void }) => {
  const [tabIndex, setTabIndex] = useState(1);
  const [pageKey, setPageKey] = useState(1);
  const [pageDirection, setPageDirection] = useState<"left" | "right">("left");
  const [progressMap, setProgressMap] = useState<Record<string, ProgressDoc>>({});
  const [events, setEvents] = useState<EventDoc[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [resumeInfo, setResumeInfo] = useState<ResumeInfo>({ firstUnreadId: null, lastCompletedId: null });
  const touchStartX = useRef<number | null>(null);

  const plan = useMemo(() => plans[userDoc.planType], [userDoc.planType]);

  useEffect(() => {
    const loadProgress = async () => {
      setLoadingProgress(true);
      const snapshot = await getDocs(collection(db, "users", user.uid, "progress"));
      const data: Record<string, ProgressDoc> = {};
      snapshot.forEach((docSnap) => {
        data[docSnap.id] = docSnap.data() as ProgressDoc;
      });
      setProgressMap(data);
      setResumeInfo(computeResumeInfo(plan, data));
      setLoadingProgress(false);
    };

    const loadEvents = async () => {
      setLoadingEvents(true);
      const snapshot = await getDocs(collection(db, "users", user.uid, "events"));
      const data: EventDoc[] = [];
      snapshot.forEach((docSnap) => {
        data.push({ id: docSnap.id, ...(docSnap.data() as Omit<EventDoc, "id">) });
      });
      setEvents(data);
      setLoadingEvents(false);
    };

    loadProgress();
    loadEvents();
  }, [user.uid, plan]);

  const updateResumeFromMap = (nextMap: Record<string, ProgressDoc>) => {
    setResumeInfo(computeResumeInfo(plan, nextMap));
  };

  const handleToggleChapter = async (chapterId: string) => {
    const existing = progressMap[chapterId];
    const now = Timestamp.now();

    if (!existing?.completed) {
      const tempEventId = `temp-${Date.now()}`;
      const optimisticProgress: ProgressDoc = {
        ...existing,
        completed: true,
        completedAt: now,
        lastReadAt: now,
        reads: (existing?.reads ?? 0) + 1,
        lastPlanEventId: tempEventId
      };
      const previousProgress = progressMap;
      const previousEvents = events;

      setEvents((prev) => [...prev, { id: tempEventId, type: "read", chapterId, source: "plan", at: now }]);
      setProgressMap((prev) => {
        const updated = { ...prev, [chapterId]: optimisticProgress };
        updateResumeFromMap(updated);
        return updated;
      });

      try {
        const eventRef = await addDoc(collection(db, "users", user.uid, "events"), {
          type: "read",
          chapterId,
          source: "plan",
          at: now
        });
        const docRef = doc(db, "users", user.uid, "progress", chapterId);
        await setDoc(
          docRef,
          {
            completed: true,
            completedAt: now,
            lastReadAt: now,
            reads: increment(1),
            lastPlanEventId: eventRef.id
          },
          { merge: true }
        );
        setEvents((prev) => prev.map((event) => (event.id === tempEventId ? { ...event, id: eventRef.id } : event)));
        setProgressMap((prev) => {
          const updated = {
            ...prev,
            [chapterId]: {
              ...prev[chapterId],
              lastPlanEventId: eventRef.id,
              completedAt: now,
              lastReadAt: now
            }
          };
          updateResumeFromMap(updated);
          return updated;
        });
      } catch (error) {
        setEvents(previousEvents);
        setProgressMap(previousProgress);
      }
      return;
    }

    const previousProgress = progressMap;
    const previousEvents = events;
    const nextReads = Math.max(0, (existing?.reads ?? 0) - (existing?.lastPlanEventId ? 1 : 0));

    setEvents((prev) => prev.filter((event) => event.id !== existing?.lastPlanEventId));
    setProgressMap((prev) => {
      const updated = {
        ...prev,
        [chapterId]: {
          ...existing,
          completed: false,
          completedAt: null,
          lastPlanEventId: null,
          reads: nextReads,
          lastReadAt: nextReads > 0 ? existing?.lastReadAt ?? null : null
        }
      };
      updateResumeFromMap(updated);
      return updated;
    });

    try {
      if (existing?.lastPlanEventId) {
        const eventDocRef = doc(db, "users", user.uid, "events", existing.lastPlanEventId);
        await deleteDoc(eventDocRef);
      }

      const docRef = doc(db, "users", user.uid, "progress", chapterId);
      const updates: ProgressDoc = {
        completed: false,
        completedAt: null,
        lastPlanEventId: null,
        lastReadAt: nextReads > 0 ? existing?.lastReadAt ?? null : null
      };

      if (existing?.lastPlanEventId) {
        await setDoc(
          docRef,
          {
            ...updates,
            reads: increment(-1)
          },
          { merge: true }
        );
      } else {
        await setDoc(docRef, updates, { merge: true });
      }
    } catch (error) {
      setEvents(previousEvents);
      setProgressMap(previousProgress);
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
    const eventRef = await addDoc(collection(db, "users", user.uid, "events"), {
      type: "read",
      chapterId,
      source: "extra",
      at: now
    });

    setProgressMap((prev) => {
      const existingProgress = prev[chapterId];
      return {
        ...prev,
        [chapterId]: {
          ...existingProgress,
          lastReadAt: now,
          reads: (existingProgress?.reads ?? 0) + 1
        }
      };
    });
    setEvents((prev) => [...prev, { id: eventRef.id, type: "read", chapterId, source: "extra", at: now }]);
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
        setTabIndex((prev) => {
          const next = Math.min(prev + 1, 2);
          setPageDirection("left");
          setPageKey((key) => key + 1);
          return next;
        });
      } else {
        setTabIndex((prev) => {
          const next = Math.max(prev - 1, 0);
          setPageDirection("right");
          setPageKey((key) => key + 1);
          return next;
        });
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
        {!isLoading ? (
          <div key={pageKey} className={`page page--${pageDirection}`}>
            {tabIndex === 0 ? (
              <Analytics plan={plan} progressMap={progressMap} events={events} />
            ) : null}
            {tabIndex === 1 ? (
              <Chapters
                plan={plan}
                progressMap={progressMap}
                onToggleChapter={handleToggleChapter}
                onAddExtra={handleAddExtra}
                resumeInfo={resumeInfo}
                autoScrollKey={`${user.uid}:${userDoc.planType}`}
              />
            ) : null}
            {tabIndex === 2 ? (
              <Profile
                user={user}
                userDoc={userDoc}
                events={events}
                onUpdateName={handleUpdateName}
                onLogout={() => signOut(auth)}
              />
            ) : null}
          </div>
        ) : null}
      </main>

      <nav className="bottom-nav">
        <button
          className={tabIndex === 0 ? "active" : ""}
          onClick={() => {
            setPageDirection(tabIndex > 0 ? "right" : "left");
            setPageKey((key) => key + 1);
            setTabIndex(0);
          }}
        >
          Analytics
        </button>
        <button
          className={tabIndex === 1 ? "active" : ""}
          onClick={() => {
            setPageDirection(tabIndex > 1 ? "right" : "left");
            setPageKey((key) => key + 1);
            setTabIndex(1);
          }}
        >
          Chapters
        </button>
        <button
          className={tabIndex === 2 ? "active" : ""}
          onClick={() => {
            setPageDirection(tabIndex > 2 ? "right" : "left");
            setPageKey((key) => key + 1);
            setTabIndex(2);
          }}
        >
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
