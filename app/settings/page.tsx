import { db } from "@/lib/db";
import { filterCriteria, recipients } from "@/lib/db/schema";
import { NavBar } from "@/app/components/NavBar";
import { updateFilter, addFilter, deleteFilter, updateRecipient } from "./actions";
import { PushOptIn } from "./PushOptIn";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [filters, allRecipients] = await Promise.all([
    db.select().from(filterCriteria),
    db.select().from(recipients),
  ]);

  return (
    <div className="min-h-screen bg-slate-950">
      <NavBar active="settings" />
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
          <h2 className="text-white font-medium">Push notifications</h2>
          <p className="text-sm text-slate-400">
            Enable push on each device you want alerts to reach. On iPhone, you must first add this site to
            your Home Screen (Share → Add to Home Screen) — Safari only delivers push to installed PWAs.
          </p>
          <PushOptIn />
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-medium">Filter criteria</h2>
            <form action={addFilter}>
              <button type="submit" className="text-sm text-emerald-400 hover:underline">
                + Add filter
              </button>
            </form>
          </div>

          {filters.map((filter) => (
            <form
              key={filter.id}
              action={updateFilter}
              className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3"
            >
              <input type="hidden" name="id" value={filter.id} />
              <div className="flex items-center justify-between gap-2">
                <input
                  name="name"
                  defaultValue={filter.name}
                  className="bg-transparent text-white font-medium focus:outline-none border-b border-transparent focus:border-slate-700 flex-1"
                />
                <label className="flex items-center gap-1.5 text-sm text-slate-400 shrink-0">
                  <input type="checkbox" name="isActive" defaultChecked={filter.isActive} />
                  Active
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm text-slate-400">
                  Min price (€)
                  <input
                    type="number"
                    name="minPrice"
                    defaultValue={filter.minPrice ?? ""}
                    className="mt-1 w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-white"
                  />
                </label>
                <label className="text-sm text-slate-400">
                  Max price (€)
                  <input
                    type="number"
                    name="maxPrice"
                    defaultValue={filter.maxPrice ?? ""}
                    className="mt-1 w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-white"
                  />
                </label>
                <label className="text-sm text-slate-400">
                  Min bedrooms
                  <input
                    type="number"
                    name="minBedrooms"
                    defaultValue={filter.minBedrooms ?? ""}
                    className="mt-1 w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-white"
                  />
                </label>
                <label className="text-sm text-slate-400">
                  Max bedrooms
                  <input
                    type="number"
                    name="maxBedrooms"
                    defaultValue={filter.maxBedrooms ?? ""}
                    className="mt-1 w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-white"
                  />
                </label>
              </div>

              <label className="text-sm text-slate-400 block">
                Areas (comma-separated, matched against listing address — leave blank for anywhere)
                <input
                  name="areas"
                  defaultValue={(filter.areas ?? []).join(", ")}
                  placeholder="Ranelagh, Rathmines, Portobello"
                  className="mt-1 w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-white"
                />
              </label>

              <label className="text-sm text-slate-400 block">
                Property types (comma-separated, leave blank for any)
                <input
                  name="propertyTypes"
                  defaultValue={(filter.propertyTypes ?? []).join(", ")}
                  placeholder="Apartment, House"
                  className="mt-1 w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-white"
                />
              </label>

              <div className="flex justify-between items-center pt-1">
                <button
                  type="submit"
                  className="rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-3 py-1.5"
                >
                  Save
                </button>
                <button
                  formAction={deleteFilter}
                  className="text-sm text-red-400 hover:underline"
                >
                  Delete
                </button>
              </div>
            </form>
          ))}
        </section>

        <section className="space-y-4">
          <h2 className="text-white font-medium">Recipients</h2>
          {allRecipients.map((recipient) => (
            <form
              key={recipient.id}
              action={updateRecipient}
              className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3"
            >
              <input type="hidden" name="id" value={recipient.id} />
              <input
                name="name"
                defaultValue={recipient.name}
                className="bg-transparent text-white font-medium focus:outline-none border-b border-transparent focus:border-slate-700 w-full"
              />
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm text-slate-400">
                  Email
                  <input
                    type="email"
                    name="email"
                    defaultValue={recipient.email ?? ""}
                    className="mt-1 w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-white"
                  />
                </label>
                <label className="text-sm text-slate-400">
                  Phone (E.164, e.g. +353...)
                  <input
                    name="phone"
                    defaultValue={recipient.phone ?? ""}
                    className="mt-1 w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-white"
                  />
                </label>
              </div>
              <div className="flex gap-4 text-sm text-slate-400">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" name="notifyEmail" defaultChecked={recipient.notifyEmail} />
                  Email
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" name="notifySms" defaultChecked={recipient.notifySms} />
                  SMS
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" name="notifyPush" defaultChecked={recipient.notifyPush} />
                  Push
                </label>
              </div>
              <button
                type="submit"
                className="rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-3 py-1.5"
              >
                Save
              </button>
            </form>
          ))}
        </section>
      </main>
    </div>
  );
}
