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
  restaurantId: string;
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
  /*
   * Une session employé MAIDA est
   * toujours rattachée à un restaurant.
   */
  if (!user.restaurantId) {
    throw new Error(
      "restaurantId requis pour créer une session MAIDA."
    );
  }

  const token =
    await new SignJWT({
      id: user.id,
      name: user.name,
      role: user.role,
      restaurantId:
        user.restaurantId,
    })
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
     * Une session n'est valide que si
     * toutes les informations nécessaires
     * sont présentes dans le JWT.
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
      ) ||
      typeof payload.restaurantId !==
        "string" ||
      !payload.restaurantId
    ) {
      return null;
    }

    return {
      id:
        payload.id,

      name:
        payload.name,

      role:
        payload.role as UserRole,

      restaurantId:
        payload.restaurantId,
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