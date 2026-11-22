"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type QuizState = {
  session: { id: string; status: string; score: number };
  totalQuestions: number;
  answeredQuestions: number;
  question: null | {
    id: string;
    points: number;
    prompt: string;
    hint: string | null;
    options: { id: string; text: string }[];
  };
};
type Feedback = { isCorrect: boolean; explanation: string | null; awardedXp: number; earnedCoins: number; completed: boolean };
type Props = { sessionId: string; locale: "EN" | "TA" };
const labels = {
  EN: {
    loading: "Loading your challenge...", unavailable: "This quiz could not be loaded.",
    tryAgain: "Try again", back: "Back to learning", question: "Question",
    submit: "Lock in answer", saving: "Checking...", correct: "That's right!", incorrect: "Not quite. Keep going!",
    continue: "Next question", done: "Adventure complete!", score: "Points earned",
    xp: "XP earned", coins: "Coins earned", dashboard: "Return to dashboard",
  },
  TA: {
    loading: "சவால் ஏற்றப்படுகிறது...", unavailable: "இந்த வினாடி வினாவை ஏற்ற முடியவில்லை.",
    tryAgain: "மீண்டும் முயற்சி", back: "கற்றலுக்குத் திரும்பு", question: "கேள்வி",
    submit: "பதிலை உறுதிசெய்", saving: "சரிபார்க்கிறது...", correct: "சரியான பதில்!", incorrect: "இன்னும் முயற்சி செய்!",
    continue: "அடுத்த கேள்வி", done: "சவால் முடிந்தது!", score: "பெற்ற புள்ளிகள்",
    xp: "பெற்ற XP", coins: "பெற்ற நாணயங்கள்", dashboard: "முகப்புக்குத் திரும்பு",
  },
};

export function QuizPlayer({ sessionId, locale }: Props) {
  const text = labels[locale];
  const [state, setState] = useState<QuizState | null>(null);
  const [selected, setSelected] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/quizzes/${sessionId}`);
      const result = await response.json() as QuizState & { error?: string };
      if (!response.ok) throw new Error(result.error ?? text.unavailable);
      setState(result);
      setSelected("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.unavailable);
    } finally {
      setLoading(false);
    }
  }, [sessionId, text.unavailable]);

  useEffect(() => { void load(); }, [load]);

  async function answer() {
    if (!state?.question || !selected || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/quizzes/${sessionId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionInstanceId: state.question.id, selectedOptionId: selected }),
      });
      const result = await response.json() as Feedback & { error?: string };
      if (!response.ok) throw new Error(result.error ?? text.unavailable);
      setFeedback(result);
      if (result.completed) {
        await load();
      } else {
        window.setTimeout(() => {
          setFeedback(null);
          void load();
        }, 1200);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.unavailable);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !state) {
    return <main className="quiz-page"><div className="quiz-skeleton"><span /><span /><span /><span /></div><p>{text.loading}</p></main>;
  }
  if (error && !state) {
    return <main className="quiz-page"><section className="quiz-message"><h1>{text.unavailable}</h1><p role="alert">{error}</p><button className="button" onClick={() => void load()}>{text.tryAgain}</button></section></main>;
  }
  if (!state) return null;

  const complete = state.session.status === "COMPLETED" || !state.question;
  const progress = state.totalQuestions ? (state.answeredQuestions / state.totalQuestions) * 100 : 0;
  return (
    <main className="quiz-page">
      <header className="quiz-top">
        <Link className="brand" href="/">eduverse<span>.</span></Link>
        <Link className="text-link" href="/student">{text.back}</Link>
      </header>
      <section className="quiz-card">
        <div className="quiz-progress-copy"><span>{text.question} {Math.min(state.answeredQuestions + 1, state.totalQuestions)} / {state.totalQuestions}</span><b>{state.session.score} XP</b></div>
        <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
        {complete ? (
          <div className="quiz-complete">
            <div className="complete-icon">✦</div><p className="eyebrow">{text.done}</p>
            <h1>{state.session.score}</h1><p>{text.score}</p>
            <Link className="button" href="/student">{text.dashboard}<span aria-hidden="true">→</span></Link>
          </div>
        ) : (
          <>
            <p className="eyebrow">EDUVERSE · {text.question} {state.answeredQuestions + 1}</p>
            <h1 className="quiz-prompt">{state.question?.prompt}</h1>
            <div className="answer-options" role="group" aria-label="Answer options">
              {state.question?.options.map((option, index) => (
                <button
                  className={`answer-option${selected === option.id ? " selected" : ""}`}
                  key={option.id}
                  onClick={() => setSelected(option.id)}
                  disabled={submitting || !!feedback}
                  type="button"
                >
                  <span>{String.fromCharCode(65 + index)}</span>{option.text}
                </button>
              ))}
            </div>
            {feedback && (
              <div className={`answer-feedback${feedback.isCorrect ? " is-correct" : " is-incorrect"}`} role="status">
                <b>{feedback.isCorrect ? text.correct : text.incorrect}</b>
                {feedback.explanation && <p>{feedback.explanation}</p>}
                {feedback.isCorrect && <small>+{feedback.awardedXp} XP · +{feedback.earnedCoins} coins</small>}
                {!feedback.completed && <span className="feedback-next">{text.continue} →</span>}
              </div>
            )}
            {error && <p className="form-error" role="alert">{error}</p>}
            {!feedback && (
              <button className="button quiz-submit" onClick={() => void answer()} disabled={!selected || submitting}>
                {submitting ? text.saving : text.submit}<span aria-hidden="true">→</span>
              </button>
            )}
          </>
        )}
      </section>
    </main>
  );
}
