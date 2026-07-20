import Link from "next/link";

export function NavBar({ active }: { active: "dashboard" | "settings" }) {
  return (
    <header className="border-b border-slate-800 bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-white font-semibold">Dublin Rental Alerts</span>
          <nav className="flex gap-1">
            <Link
              href="/dashboard"
              className={`px-3 py-1.5 rounded-md text-sm ${
                active === "dashboard" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Listings
            </Link>
            <Link
              href="/settings"
              className={`px-3 py-1.5 rounded-md text-sm ${
                active === "settings" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Settings
            </Link>
          </nav>
        </div>
        <form action="/api/auth/logout" method="POST">
          <button type="submit" className="text-sm text-slate-400 hover:text-white">
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
