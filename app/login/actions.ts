"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { recipients } from "@/lib/db/schema";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/auth/session";

export async function login(_prevState: { error?: string } | undefined, formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || email.trim() === "") {
    return { error: "Enter your email." };
  }
  if (typeof password !== "string" || password.length === 0) {
    return { error: "Enter your password." };
  }

  const [recipient] = await db
    .select()
    .from(recipients)
    .where(eq(recipients.email, email.trim().toLowerCase()))
    .limit(1);

  if (!recipient || !recipient.passwordHash) {
    return { error: "No account with that email." };
  }

  const valid = await bcrypt.compare(password, recipient.passwordHash);
  if (!valid) {
    return { error: "Wrong password." };
  }

  const token = await createSessionToken({ recipientId: recipient.id, email: recipient.email! });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  redirect("/dashboard");
}
