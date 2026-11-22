"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Topic = { id: string; name: string };
type Subject = { id: string; name: string; topics: Topic[] };
type QuestionRecord = {
  id: string;
  status: string;
  difficulty: string;
  points: number;
  topic: { name: string; subject: { name: string } };
  translations: { locale: string; prompt: string }[];
};
type Props = { isAdmin: boolean };

export function TeacherConsole({ isAdmin }: Props) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  const refresh = useCallback(async () => {
    setError("");
    try {
      const [catalogResponse, questionResponse] = await Promise.all([
        fetch("/api/teacher/catalog"),
        fetch("/api/teacher/questions"),
      ]);
      const catalog = await catalogResponse.json() as { subjects?: Subject[]; error?: string };
      const questionData = await questionResponse.json() as { questions?: QuestionRecord[]; error?: string };
      if (!catalogResponse.ok) throw new Error(catalog.error ?? "Unable to load subjects.");
      if (!questionResponse.ok) throw new Error(questionData.error ?? "Unable to load questions.");
      setSubjects(catalog.subjects ?? []);
      setQuestions(questionData.questions ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load teacher content.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function createQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setPending(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    const options = [0, 1, 2, 3].map((index) => ({
      isCorrect: data.get("correctOption") === String(index),
      translations: [
        { locale: "EN", text: data.get(`option${index}En`) },
        { locale: "TA", text: data.get(`option${index}Ta`) },
      ],
    }));
    try {
      const response = await fetch("/api/teacher/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId: data.get("topicId"),
          difficulty: data.get("difficulty"),
          points: Number(data.get("points")),
          translations: [
            { locale: "EN", prompt: data.get("promptEn"), explanation: data.get("explanationEn"), hint: data.get("hintEn") },
            { locale: "TA", prompt: data.get("promptTa"), explanation: data.get("explanationTa"), hint: data.get("hintTa") },
          ],
          options,
        }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to save this question.");
      setMessage(isAdmin ? "Question published." : "Question submitted for administrator review.");
      form.reset();
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save this question.");
    } finally {
      setPending(false);
    }
  }

  const topics = subjects.flatMap((subject) => subject.topics.map((topic) => ({ ...topic, subject: subject.name })));

  return (
    <div className="console-layout">
      <section className="console-panel">
        <div className="section-heading"><div><p className="eyebrow">CONTENT STUDIO</p><h2>Create a question</h2></div></div>
        {topics.length === 0 ? (
          <div className="empty-panel"><h3>No learning topics yet</h3><p>An administrator needs to add subjects and topics before questions can be created.</p>{isAdmin && <Link className="text-link" href="/admin">Open admin tools →</Link>}</div>
        ) : (
          <form className="content-form" onSubmit={createQuestion}>
            <div className="form-grid">
              <label>Topic<select name="topicId" required defaultValue=""><option value="" disabled>Select a topic</option>{topics.map((topic) => <option value={topic.id} key={topic.id}>{topic.subject} · {topic.name}</option>)}</select></label>
              <label>Difficulty<select name="difficulty"><option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option></select></label>
              <label>XP points<input name="points" type="number" min="1" max="100" defaultValue="10" required /></label>
            </div>
            <div className="translation-grid">
              <fieldset><legend>English</legend><label>Question<textarea name="promptEn" required minLength={3} maxLength={2000} /></label><label>Explanation<textarea name="explanationEn" required maxLength={2000} /></label><label>Optional hint<input name="hintEn" maxLength={500} /></label></fieldset>
              <fieldset><legend>தமிழ் · Tamil</legend><label>Question<textarea name="promptTa" required minLength={3} maxLength={2000} /></label><label>Explanation<textarea name="explanationTa" required maxLength={2000} /></label><label>Optional hint<input name="hintTa" maxLength={500} /></label></fieldset>
            </div>
            <fieldset className="answer-editor"><legend>Answer options · select the correct answer</legend>
              {[0, 1, 2, 3].map((index) => <div className="option-editor" key={index}>
                <label className="correct-picker"><input type="radio" name="correctOption" value={index} required={index === 0} defaultChecked={index === 0} aria-label={`Mark option ${index + 1} correct`} />{String.fromCharCode(65 + index)}</label>
                <label><span className="sr-only">Option {index + 1} in English</span><input name={`option${index}En`} required placeholder={`Option ${index + 1} · English`} maxLength={500} /></label>
                <label><span className="sr-only">Option {index + 1} in Tamil</span><input name={`option${index}Ta`} required placeholder={`Option ${index + 1} · தமிழ்`} maxLength={500} /></label>
              </div>)}
            </fieldset>
            {error && <p className="form-error" role="alert">{error}</p>}
            {message && <p className="form-success" role="status">{message}</p>}
            <button className="button" disabled={pending}>{pending ? "Saving..." : isAdmin ? "Create and publish" : "Submit for review"}<span aria-hidden="true">→</span></button>
          </form>
        )}
      </section>
      <section className="console-panel">
        <div className="section-heading"><div><p className="eyebrow">QUESTION BANK</p><h2>Your questions</h2></div></div>
        {loading ? <div className="list-skeleton"><span /><span /><span /></div> : questions.length === 0 ? <div className="empty-panel"><p>No questions have been added yet.</p></div> : (
          <div className="question-list">{questions.map((question) => <article className="question-row" key={question.id}>
            <div><span className={`status-pill status-${question.status.toLowerCase()}`}>{question.status}</span><p>{question.translations.find((item) => item.locale === "EN")?.prompt}</p><small>{question.topic.subject} · {question.topic.name} · {question.difficulty.toLowerCase()}</small></div>
            <strong>{question.points} XP</strong>
          </article>)}</div>
        )}
      </section>
    </div>
  );
}
