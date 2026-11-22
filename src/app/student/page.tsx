import { redirect } from "next/navigation";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { getSessionUser } from "@/lib/auth/session";

export default async function StudentPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <main className="student-page">
      <header className="topbar">
        <Link className="brand" href="/">eduverse<span>.</span></Link>
        <LogoutButton />
      </header>
      <section className="student-welcome">
        <p className="eyebrow"><span className="eyebrow-dot" /> YOUR JOURNEY STARTS HERE</p>
        <h1>Hello, <span>{user.displayName}</span>.</h1>
        <p>Your account is ready. The learning worlds are coming in the next stage.</p>
        <div className="setup-note">
          <span aria-hidden="true">✦</span>
          <div><b>Account created and saved</b><small>Your profile and wallet are stored in EDUVERSE.</small></div>
        </div>
      </section>
    </main>
  );
}
