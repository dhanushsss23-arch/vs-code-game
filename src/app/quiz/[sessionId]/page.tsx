import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { QuizPlayer } from "@/components/quiz-player";

type Props = { params: Promise<{ sessionId: string }> };

export default async function QuizPage({ params }: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.roles.includes("STUDENT")) redirect("/teacher");
  const { sessionId } = await params;
  return <QuizPlayer sessionId={sessionId} locale={user.preferredLocale} />;
}
