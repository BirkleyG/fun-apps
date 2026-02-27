import React, { useMemo } from "react";
import { EventDoc, ProgressDoc } from "../types";

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

const dayKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const dateFromKey = (key: string) => {
  const [year, month, day] = key.split("-").map(Number);
  return startOfDay(new Date(year, month - 1, day));
};

type AnalyticsProps = {
  plan: string[];
  progressMap: Record<string, ProgressDoc>;
  events: EventDoc[];
};

export default function Analytics({ plan, progressMap, events }: AnalyticsProps) {
  const completedCount = useMemo(() => {
    return plan.filter((chapterId) => progressMap[chapterId]?.completed).length;
  }, [plan, progressMap]);

  const { currentStreak, longestStreak, avgLast7, etaLabel } = useMemo(() => {
    const now = new Date();
    const start7 = startOfDay(addDays(now, -6));
    const start14 = startOfDay(addDays(now, -13));

    const eventsLast7 = events.filter((event) => event.at.toDate() >= start7);
    const eventsLast14 = events.filter((event) => event.at.toDate() >= start14);

    const avg7 = eventsLast7.length / 7;
    const avg14 = eventsLast14.length / 14;
    const pace = avg14 > 0 ? avg14 : avg7 > 0 ? avg7 : 1;

    const daysWithReads = new Set(events.map((event) => dayKey(event.at.toDate())));

    let current = 0;
    for (let offset = 0; ; offset += 1) {
      const key = dayKey(addDays(now, -offset));
      if (daysWithReads.has(key)) {
        current += 1;
      } else {
        break;
      }
    }

    const sortedDays = Array.from(daysWithReads)
      .map((key) => dateFromKey(key))
      .sort((a, b) => a.getTime() - b.getTime());

    let longest = 0;
    let run = 0;
    let previous: Date | null = null;
    for (const day of sortedDays) {
      if (!previous) {
        run = 1;
      } else {
        const diff = (day.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24);
        run = diff === 1 ? run + 1 : 1;
      }
      if (run > longest) longest = run;
      previous = day;
    }

    let eta = "N/A";
    const remaining = plan.length - completedCount;
    if (remaining <= 0) {
      eta = "Completed";
    } else {
      const daysNeeded = Math.ceil(remaining / pace);
      eta = addDays(now, daysNeeded).toLocaleDateString();
    }

    return {
      currentStreak: current,
      longestStreak: longest,
      avgLast7: avg7.toFixed(1),
      etaLabel: eta
    };
  }, [events, plan.length, completedCount]);

  return (
    <div className="panel">
      <h2>Analytics</h2>
      <div className="stats">
        <div className="stat">
          <div className="stat__label">Completed</div>
          <div className="stat__value">
            {completedCount} / {plan.length}
          </div>
        </div>
        <div className="stat">
          <div className="stat__label">Current streak</div>
          <div className="stat__value">{currentStreak} days</div>
        </div>
        <div className="stat">
          <div className="stat__label">Longest streak</div>
          <div className="stat__value">{longestStreak} days</div>
        </div>
        <div className="stat">
          <div className="stat__label">Reads per day (7d)</div>
          <div className="stat__value">{avgLast7}</div>
        </div>
        <div className="stat">
          <div className="stat__label">ETA finish</div>
          <div className="stat__value">{etaLabel}</div>
        </div>
      </div>
    </div>
  );
}
