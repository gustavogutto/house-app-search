"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { filterCriteria, recipients } from "@/lib/db/schema";

function parseListField(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string" || value.trim() === "") return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseOptionalInt(value: FormDataEntryValue | null): number | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? undefined : n;
}

export async function updateFilter(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string") return;

  await db
    .update(filterCriteria)
    .set({
      name: (formData.get("name") as string) || "Untitled filter",
      minPrice: parseOptionalInt(formData.get("minPrice")),
      maxPrice: parseOptionalInt(formData.get("maxPrice")),
      minBedrooms: parseOptionalInt(formData.get("minBedrooms")),
      maxBedrooms: parseOptionalInt(formData.get("maxBedrooms")),
      areas: parseListField(formData.get("areas")),
      propertyTypes: parseListField(formData.get("propertyTypes")),
      isActive: formData.get("isActive") === "on",
      updatedAt: new Date(),
    })
    .where(eq(filterCriteria.id, id));

  revalidatePath("/settings");
}

export async function addFilter() {
  await db.insert(filterCriteria).values({ name: "New filter" });
  revalidatePath("/settings");
}

export async function deleteFilter(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string") return;
  await db.delete(filterCriteria).where(eq(filterCriteria.id, id));
  revalidatePath("/settings");
}

export async function updateRecipient(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string") return;

  await db
    .update(recipients)
    .set({
      name: (formData.get("name") as string) || "Unnamed",
      email: (formData.get("email") as string) || null,
      notifyEmail: formData.get("notifyEmail") === "on",
      notifyPush: formData.get("notifyPush") === "on",
    })
    .where(eq(recipients.id, id));

  revalidatePath("/settings");
}
