import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export type UserRole =
  | "admin"
  | "cashier"
  | "stock_manager";

export type SessionUser = {
  id: string;
  name: string;
  role: UserRole;
};

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET!
);

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({
    id: user.id,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret);

  const cookieStore = await cookies();

  cookieStore.set("restaurant_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("restaurant_session")?.value;

    if (!token) return null;

    const { payload } = await jwtVerify(token, secret);

    return {
      id: payload.id as string,
      name: payload.name as string,
      role: payload.role as UserRole,
    };
  } catch {
    return null;
  }
}

export async function deleteSession() {
  const cookieStore = await cookies();

  cookieStore.delete("restaurant_session");
}