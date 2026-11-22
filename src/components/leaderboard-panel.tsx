"use client";

import { useCallback, useEffect, useState } from "react";

type Period = "ALL_TIME" | "WEEKLY" | "DAILY";
type Entry = { studentId: string; displayName: string; score: number; rank: number; isCurrentStudent: boolean };
type Props = { locale: "EN" | "TA" };
const text = {
  EN: { title: "Leaderboard", all: "All time", week: "This week", day: "Today", loading: "Loading rankings...", empty: "Scores will appear when students complete quizzes.", xp: "XP", points: "points", error: "Could not load rankings." },
  TA: { title: "தரவரிசை", all: "மொத்தம்", week: "இந்த வாரம்", day: "இன்று", loading: "தரவரிசை ஏற்றப்படுகிறது...", empty: "மாணவர்கள் வினாடி வினாக்களை முடிக்கும்போது மதிப்பெண்கள் தோன்றும்.", xp: "XP", points: "புள்ளிகள்", error: "தரவரிசையை ஏற்ற முடியவில்லை." },
};

export function LeaderboardPanel({ locale }: Props) {
  const labels = text[locale];
  const [period, setPeriod] = useState<Period>("WEEKLY");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/leaderboard?period=${period}`);
      const result = await response.json() as { entries?: Entry[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? labels.error);
      setEntries(result.entries ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : labels.error);
    } finally {
      setLoading(false);
    }
  }, [labels.error, period]);

  useEffect(() => { void load(); }, [load]);

  return (
    <section className="recent-section">
      <div className="section-heading leaderboard-heading"><div><p className="eyebrow">{labels.title}</p><h2>{locale === "TA" ? "கற்றலால் முன்னேறு" : "Climb through learning"}</h2></div>
        <div className="leaderboard-tabs" role="group" aria-label={labels.title}>
          {(["ALL_TIME", "WEEKLY", "DAILY"] as const).map((value) => <button className={period === value ? "active" : ""} key={value} onClick={() => setPeriod(value)} type="button">{value === "ALL_TIME" ? labels.all : value === "WEEKLY" ? labels.week : labels.day}</button>)}
        </div>
      </div>
      {loading ? <div className="list-skeleton"><span /><span /><span /></div> : error ? <p className="form-error" role="alert">{error}</p> : entries.length === 0 ? <div className="empty-panel recent-empty"><p>{labels.empty}</p></div> : (
        <div className="leaderboard-list">{entries.map((entry) => <article className={`leaderboard-row${entry.isCurrentStudent ? " current" : ""}`} key={entry.studentId}>
          <strong className="leaderboard-rank">{String(entry.rank).padStart(2, "0")}</strong><span className="leaderboard-name">{entry.displayName}{entry.isCurrentStudent && <small>{locale === "TA" ? "நீங்கள்" : "You"}</small>}</span><b>{entry.score} <small>{period === "ALL_TIME" ? labels.xp : labels.points}</small></b>
        </article>)}</div>
      )}
    </section>
  );
}
