"use client";

import { useEffect } from "react";

const CHECK_INTERVAL = 10_000;

export default function RestaurantAccessGuard() {
  useEffect(() => {
    let active = true;

    async function checkRestaurantAccess() {
      try {
        const response = await fetch(
          `/api/restaurant/status?t=${Date.now()}`,
          {
            method: "GET",
            cache: "no-store",
            credentials: "include",
            headers: {
              "Cache-Control": "no-cache",
            },
          }
        );

        if (!active) {
          return;
        }

        /*
         * Restaurant désactivé.
         *
         * On ne dépend même plus du contenu
         * JSON : un 403 suffit pour sortir
         * immédiatement de l'application.
         */
        if (response.status === 403) {
          window.location.replace(
            "/restricted"
          );

          return;
        }

        /*
         * Session absente ou invalide.
         */
        if (response.status === 401) {
          window.location.replace(
            "/login"
          );

          return;
        }
      } catch {
        /*
         * Une coupure Internet temporaire
         * ne doit pas déconnecter le caissier.
         *
         * Le contrôle suivant réessaiera.
         */
      }
    }

    /*
     * Contrôle immédiat au chargement.
     */
    void checkRestaurantAccess();

    /*
     * Contrôle régulier.
     */
    const interval =
      window.setInterval(
        () => {
          void checkRestaurantAccess();
        },
        CHECK_INTERVAL
      );

    /*
     * Contrôle immédiat lorsque l'utilisateur
     * revient dans l'application.
     */
    const handleFocus = () => {
      void checkRestaurantAccess();
    };

    const handleVisibilityChange =
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          void checkRestaurantAccess();
        }
      };

    const handlePageShow = () => {
      void checkRestaurantAccess();
    };

    window.addEventListener(
      "focus",
      handleFocus
    );

    window.addEventListener(
      "pageshow",
      handlePageShow
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      active = false;

      window.clearInterval(
        interval
      );

      window.removeEventListener(
        "focus",
        handleFocus
      );

      window.removeEventListener(
        "pageshow",
        handlePageShow
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, []);

  return null;
}