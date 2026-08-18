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

  /*
   * TEMPORAIREMENT OPTIONNEL.
   *
   * Les anciennes sessions et le login
   * actuel ne connaissent pas encore
   * restaurantId.
   *
   * Une fois le login multi-restaurant
   * terminé, ce champ deviendra obligatoire.
   */
  restaurantId?: string;
};

const SESSION_COOKIE_NAME =
  "restaurant_session";

const SESSION_DURATION_SECONDS =
  60 * 60 * 12;

const secret =
  new TextEncoder().encode(
    process.env.SESSION_SECRET!
  );

const allowedRoles: UserRole[] = [
  "admin",
  "cashier",
  "stock_manager",
];

export async function createSession(
  user: SessionUser
) {
  const payload: {
    id: string;
    name: string;
    role: UserRole;
    restaurantId?: string;
  } = {
    id: user.id,
    name: user.name,
    role: user.role,
  };

  /*
   * Pendant la transition, les anciennes
   * routes peuvent encore appeler
   * createSession sans restaurantId.
   */
  if (user.restaurantId) {
    payload.restaurantId =
      user.restaurantId;
  }

  const token =
    await new SignJWT(payload)
      .setProtectedHeader({
        alg: "HS256",
      })
      .setIssuedAt()
      .setExpirationTime("12h")
      .sign(secret);

  const cookieStore =
    await cookies();

  cookieStore.set(
    SESSION_COOKIE_NAME,
    token,
    {
      httpOnly: true,

      secure:
        process.env.NODE_ENV ===
        "production",

      sameSite: "lax",

      path: "/",

      maxAge:
        SESSION_DURATION_SECONDS,
    }
  );
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore =
      await cookies();

    const token =
      cookieStore.get(
        SESSION_COOKIE_NAME
      )?.value;

    if (!token) {
      return null;
    }

    const { payload } =
      await jwtVerify(
        token,
        secret
      );

    /*
     * Validation minimale du contenu
     * du JWT avant de le considérer
     * comme une session MAIDA valide.
     */
    if (
      typeof payload.id !==
        "string" ||
      typeof payload.name !==
        "string" ||
      typeof payload.role !==
        "string" ||
      !allowedRoles.includes(
        payload.role as UserRole
      )
    ) {
      return null;
    }

    const restaurantId =
      typeof payload.restaurantId ===
      "string"
        ? payload.restaurantId
        : undefined;

    return {
      id: payload.id,

      name: payload.name,

      role:
        payload.role as UserRole,

      restaurantId,
    };
  } catch {
    return null;
  }
}

export async function deleteSession() {
  const cookieStore =
    await cookies();

  cookieStore.delete(
    SESSION_COOKIE_NAME
  );
}