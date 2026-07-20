"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/auth/session";

export async function login(_prevState: { error?: string } | undefined, formData: FormData) {
  const password = formData.get("password");
  const passwordHash = process.env.AUTH_PASSWORD_HASH;

  if (!passwordHash) {
    return { error: "Server is not configured (missing AUTH_PASSWORD_HASH)." };
  }

  if (typeof password !== "string" || password.length === 0) {
    return { error: "Enter the password." };
  }

  const valid = await bcrypt.compare(password, passwordHash);
  if (!valid) {
    return { error: "Wrong password." };
  }

  const token = await createSessionToken();
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
