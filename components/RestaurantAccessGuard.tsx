"use client";

import { useEffect } from "react";

const CHECK_INTERVAL =
  30_000;

export default function RestaurantAccessGuard() {
  useEffect(() => {
    let destroyed = false;

    async function checkAccess() {
      try {
        const response =
          await fetch(
            "/api/restaurant/status",
            {
              method: "GET",

              cache: "no-store",

              credentials:
                "same-origin",
            }
          );

        if (destroyed) {
          return;
        }

        if (
          response.status ===
          403
        ) {
          const data =
            await response
              .json()
              .catch(() => null);

          if (
            data?.restricted
          ) {
            window.location.replace(
              "/restricted"
            );

            return;
          }
        }

        if (
          response.status ===
          401
        ) {
          window.location.replace(
            "/login"
          );
        }
      } catch {
        /*
         * Une coupure réseau temporaire
         * ne doit pas déconnecter
         * immédiatement le caissier.
         *
         * Le prochain contrôle
         * réessaiera automatiquement.
         */
      }
    }

    function handleFocus() {
      void checkAccess();
    }

    function handleVisibilityChange() {
      if (
        document.visibilityState ===
        "visible"
      ) {
        void checkAccess();
      }
    }

    /*
     * Premier contrôle dès que
     * l'espace protégé est chargé.
     */
    void checkAccess();

    /*
     * Puis contrôle régulier.
     */
    const interval =
      window.setInterval(
        () => {
          void checkAccess();
        },
        CHECK_INTERVAL
      );

    /*
     * Contrôle immédiat lorsque
     * l'utilisateur revient sur MAIDA.
     */
    window.addEventListener(
      "focus",
      handleFocus
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      destroyed = true;

      window.clearInterval(
        interval
      );

      window.removeEventListener(
        "focus",
        handleFocus
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, []);

  return null;
}