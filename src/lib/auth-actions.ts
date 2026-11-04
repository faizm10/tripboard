"use server";

import { redirect } from "next/navigation";
import { getNeonAuth } from "@/lib/auth";
import { safeReturnTo } from "@/lib/invitations";
import { accountNameSchema, signInSchema, signUpSchema } from "@/lib/validators";

export type AuthFormState = {
  error?: string;
  ok?: boolean;
  returnTo?: string;
  values?: { name?: string; email?: string };
} | null;

function valuesFrom(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
  };
}

function unavailable(formData: FormData): AuthFormState {
  return {
    error: "Sign-in is unavailable right now. Try again in a moment.",
    returnTo: safeReturnTo(String(formData.get("returnTo") ?? "")),
    values: valuesFrom(formData),
  };
}

export async function signInWithEmail(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const values = valuesFrom(formData);
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details.", returnTo: safeReturnTo(String(formData.get("returnTo") ?? "")), values };
  }

  const auth = getNeonAuth();
  if (!auth) return unavailable(formData);
  const returnTo = safeReturnTo(String(formData.get("returnTo") ?? ""));

  const { error } = await auth.signIn.email({
    ...parsed.data,
    callbackURL: returnTo,
  });
  if (error) {
    return { error: error.message || "Those details did not match an account.", returnTo, values };
  }

  return { ok: true, returnTo };
}

export async function signUpWithEmail(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const values = valuesFrom(formData);
  const parsed = signUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details.", returnTo: safeReturnTo(String(formData.get("returnTo") ?? "")), values };
  }

  const auth = getNeonAuth();
  if (!auth) return unavailable(formData);
  const returnTo = safeReturnTo(String(formData.get("returnTo") ?? ""));

  const { name, email, password } = parsed.data;
  const { error } = await auth.signUp.email({
    name,
    email,
    password,
    callbackURL: returnTo,
  });
  if (error) {
    return { error: error.message || "The account could not be created.", returnTo, values };
  }

  return { ok: true, returnTo };
}

export type AccountFormState = { error: string; name?: string } | null;

export async function updateAccountName(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const parsed = accountNameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check your name.",
      name: String(formData.get("name") ?? ""),
    };
  }

  const auth = getNeonAuth();
  if (!auth) {
    return { error: "Your account cannot be updated right now.", name: parsed.data.name };
  }

  const { error } = await auth.updateUser({ name: parsed.data.name });
  if (error) {
    return { error: error.message || "Your name could not be saved.", name: parsed.data.name };
  }

  redirect("/account");
}

export async function signOut() {
  const auth = getNeonAuth();
  if (auth) await auth.signOut();
}
