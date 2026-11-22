"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = { topicId: string; locale: "EN" | "TA" };
const labels = {
  EN: { start: "Start a quiz", difficulty: "Choose difficulty", easy: "Easy", medium: "Medium", hard: "Hard", loading: "Preparing...", error: "Could not start this quiz." },
  TA: { start: "வினாடி வினாவைத் தொடங்கு", difficulty: "கடினத்தன்மையைத் தேர்ந்தெடுக்கவும்", easy: "எளிது", medium: "நடுத்தரம்", hard: "கடினம்", loading: "தயாராகிறது...", error: "வினாடி வினாவைத் தொடங்க முடியவில்லை." },
};

export function QuizStart({ topicId, locale }: Props) {
  const router = useRouter();
  const text = labels[locale];
  const [difficulty, setDifficulty] = useState<"EASY" | "MEDIUM" | "HARD">("EASY");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, difficulty }),
      });
      const result = await response.json() as { sessionId?: string; error?: string };
      if (!response.ok || !result.sessionId) {
        setError(result.error ?? text.error);
        return;
      }
      router.push(`/quiz/${result.sessionId}`);
    } catch {
      setError(text.error);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="quiz-start">
      <label className="difficulty-label">
        <span>{text.difficulty}</span>
        <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as typeof difficulty)}>
          <option value="EASY">{text.easy}</option>
          <option value="MEDIUM">{text.medium}</option>
          <option value="HARD">{text.hard}</option>
        </select>
      </label>
      <button className="button button-small" disabled={pending} onClick={start} type="button">
        {pending ? text.loading : text.start}<span aria-hidden="true">→</span>
      </button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
