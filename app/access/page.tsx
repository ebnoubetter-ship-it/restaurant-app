"use client";

import { useEffect, useState } from "react";

export default function RestaurantAccessPage() {
  const [
    error,
    setError,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  useEffect(() => {
    async function verifyAccess() {
      /*
       * Exemple :
       *
       * /access#ABC123
       *
       * Le fragment #ABC123 n'est
       * jamais envoyé automatiquement
       * au serveur.
       */
      const token =
        window.location.hash
          .replace(/^#/, "")
          .trim();

      if (!token) {
        setError(
          "Lien d'accès invalide."
        );

        setLoading(false);

        return;
      }

      try {
        const response =
          await fetch(
            "/api/restaurant/access",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  token,
                }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          setError(
            data.error ||
              "Impossible de vérifier l'accès."
          );

          /*
           * On retire quand même
           * le token de l'adresse.
           */
          window.history.replaceState(
            null,
            "",
            "/access"
          );

          return;
        }

        /*
         * L'API a maintenant créé
         * restaurant_context.
         *
         * replace() retire également
         * la page contenant le token
         * de l'historique courant.
         */
        window.location.replace(
          "/login"
        );
      } catch {
        setError(
          "Impossible de vérifier l'accès."
        );

        window.history.replaceState(
          null,
          "",
          "/access"
        );
      } finally {
        setLoading(false);
      }
    }

    verifyAccess();
  }, []);

  return (
    <main className="min-h-screen bg-[#F5F2EB] px-6 py-12 text-[#1F2924]">
      <div className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center">
        <div className="w-full rounded-3xl bg-white p-8 shadow-sm">
          <div className="mb-8 text-center">
            <div className="text-3xl font-bold text-[#1E4D3A]">
              MAIDA
            </div>

            <p className="mt-2 text-sm text-[#737A75]">
              Votre restaurant. Plus simple.
            </p>
          </div>

          {loading ? (
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#E4E1DA] border-t-[#1E4D3A]" />

              <p className="mt-4 text-sm text-[#737A75]">
                Vérification de votre accès...
              </p>
            </div>
          ) : error ? (
            <div className="rounded-2xl bg-[#FFF4F1] p-5 text-center">
              <p className="font-medium text-[#B54A3A]">
                {error}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}