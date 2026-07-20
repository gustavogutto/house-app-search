"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <form
        action={formAction}
        className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-xl p-8 space-y-4"
      >
        <div>
          <h1 className="text-xl font-semibold text-white">Dublin Rental Alerts</h1>
          <p className="text-sm text-slate-400 mt-1">Log in with your email and password.</p>
        </div>
        <input
          type="email"
          name="email"
          autoFocus
          required
          placeholder="Email"
          className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <input
          type="password"
          name="password"
          required
          placeholder="Password"
          className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-2 transition"
        >
          {pending ? "Checking..." : "Log in"}
        </button>
      </form>
    </div>
  );
}
