"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type QuestionRecord = {
  id: string;
  status: string;
  difficulty: string;
  points: number;
  topic: { name: string; subject: { name: string } };
  translations: { locale: string; prompt: string }[];
};
type Props = { initialQuestions: QuestionRecord[] };

export function AdminConsole({ initialQuestions }: Props) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const refreshQuestions = useCallback(async () => {
    const response = await fetch("/api/teacher/questions");
    const data = await response.json() as { questions?: QuestionRecord[]; error?: string };
    if (!response.ok) throw new Error(data.error ?? "Unable to refresh questions.");
    setQuestions(data.questions ?? []);
  }, []);

  useEffect(() => {
    void refreshQuestions().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Unable to load questions."));
  }, [refreshQuestions]);

  async function submitJson(event: FormEvent<HTMLFormElement>, endpoint: string, successMessage: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = Object.fromEntries(data.entries());
    setError("");
    setMessage("");
    setPending(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Request failed.");
      setMessage(successMessage);
      form.reset();
      if (endpoint.startsWith("/api/admin/questions/")) await refreshQuestions();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed.");
    } finally {
      setPending(false);
    }
  }

  async function publishQuestion(questionId: string) {
    setError("");
    setMessage("");
    setPending(true);
    try {
      const response = await fetch(`/api/admin/questions/${questionId}/publish`, { method: "POST" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to publish this question.");
      setMessage("Question published.");
      await refreshQuestions();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to publish this question.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="console-layout">
      <section className="console-panel">
        <div className="section-heading"><div><p className="eyebrow">CURRICULUM</p><h2>Add a learning topic</h2></div></div>
        <form className="admin-form" onSubmit={(event) => void submitJson(event, "/api/admin/topics", "Topic added to the catalog.")}>
          <label>Subject name<input name="subjectName" required minLength={2} maxLength={80} placeholder="e.g. Mathematics" /></label>
          <label>Topic name<input name="topicName" required minLength={2} maxLength={100} placeholder="e.g. Fractions" /></label>
          <label>Description<input name="description" maxLength={500} placeholder="Optional topic description" /></label>
          <button className="button" disabled={pending}>Add topic<span aria-hidden="true">→</span></button>
        </form>
      </section>
      <section className="console-panel">
        <div className="section-heading"><div><p className="eyebrow">ACCESS</p><h2>Grant teacher access</h2></div></div>
        <form className="admin-form" onSubmit={(event) => void submitJson(event, "/api/admin/teachers", "Teacher role granted.")}>
          <label>Existing account email<input name="email" type="email" required maxLength={254} placeholder="teacher@example.com" /></label>
          <p className="field-hint">The person must register first. This action is recorded in the audit log.</p>
          <button className="button" disabled={pending}>Grant teacher access<span aria-hidden="true">→</span></button>
        </form>
      </section>
      <section className="console-panel admin-question-panel">
        <div className="section-heading"><div><p className="eyebrow">CONTENT REVIEW</p><h2>Questions awaiting review</h2></div></div>
        {questions.filter((question) => question.status === "REVIEW").length === 0 ? <div className="empty-panel"><p>No questions are waiting for review.</p></div> : (
          <div className="question-list">
            {questions.filter((question) => question.status === "REVIEW").map((question) => <article className="question-row" key={question.id}>
              <div><p>{question.translations.find((item) => item.locale === "EN")?.prompt}</p><small>{question.topic.subject} · {question.topic.name} · {question.difficulty.toLowerCase()}</small></div>
              <button className="button button-small" disabled={pending} onClick={() => void publishQuestion(question.id)} type="button">Publish</button>
            </article>)}
          </div>
        )}
      </section>
      {(error || message) && <div className={error ? "form-error" : "form-success"} role={error ? "alert" : "status"}>{error || message}</div>}
    </div>
  );
}
