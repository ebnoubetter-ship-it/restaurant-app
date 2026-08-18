import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export type RestaurantContext = {
  restaurantId: string;
  restaurantName: string;
};

const COOKIE_NAME = "restaurant_context";

const CONTEXT_DURATION_SECONDS =
  60 * 60 * 24 * 30;

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET!
);

export async function createRestaurantContext(
  restaurant: RestaurantContext
) {
  const token = await new SignJWT({
    restaurantId:
      restaurant.restaurantId,

    restaurantName:
      restaurant.restaurantName,

    type: "restaurant_context",
  })
    .setProtectedHeader({
      alg: "HS256",
    })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);

  const cookieStore =
    await cookies();

  cookieStore.set(
    COOKIE_NAME,
    token,
    {
      httpOnly: true,

      secure:
        process.env.NODE_ENV ===
        "production",

      sameSite: "lax",

      path: "/",

      maxAge:
        CONTEXT_DURATION_SECONDS,
    }
  );
}

export async function getRestaurantContext(): Promise<RestaurantContext | null> {
  try {
    const cookieStore =
      await cookies();

    const token =
      cookieStore.get(
        COOKIE_NAME
      )?.value;

    if (!token) {
      return null;
    }

    const { payload } =
      await jwtVerify(
        token,
        secret
      );

    if (
      payload.type !==
        "restaurant_context" ||
      typeof payload.restaurantId !==
        "string" ||
      typeof payload.restaurantName !==
        "string"
    ) {
      return null;
    }

    return {
      restaurantId:
        payload.restaurantId,

      restaurantName:
        payload.restaurantName,
    };
  } catch {
    return null;
  }
}

export async function deleteRestaurantContext() {
  const cookieStore =
    await cookies();

  cookieStore.delete(
    COOKIE_NAME
  );
}