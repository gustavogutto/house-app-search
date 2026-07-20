import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";

export async function NavBar({ active }: { active: "dashboard" | "settings" }) {
  const user = await getCurrentUser();

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
        <div className="flex items-center gap-3">
          {user && <span className="text-sm text-slate-500 hidden sm:inline">{user.email}</span>}
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="text-sm text-slate-400 hover:text-white">
              Log out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
