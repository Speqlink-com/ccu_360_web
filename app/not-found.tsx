import Link from "next/link";
export default function NotFound() {
  return (
    <main className="error-page">
      <p className="eyebrow">CCU360 · 404</p>
      <h1>We couldn’t find that page.</h1>
      <Link className="btn btn-primary" href="/dashboard">
        Return to workspace
      </Link>
    </main>
  );
}
