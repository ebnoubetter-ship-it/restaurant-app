"use client";

import { useState } from "react";

type Step =
  | "name"
  | "create-pin"
  | "login-pin";

export default function LoginPage() {
  const [name, setName] =
    useState("");

  const [step, setStep] =
    useState<Step>("name");

  const [pin, setPin] =
    useState("");

  const [
    confirmPin,
    setConfirmPin,
  ] = useState("");

  const [message, setMessage] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const redirectByRole = (
    role: string
  ) => {
    if (role === "admin") {
      window.location.href =
        "/admin";
      return;
    }

    if (role === "cashier") {
      window.location.href =
        "/cashier";
      return;
    }

    if (
      role === "stock_manager"
    ) {
      window.location.href =
        "/stock";
      return;
    }

    setMessage(
      "Aucun espace n'est associé à ce compte."
    );

    setLoading(false);
  };

  const cleanPinValue = (
    value: string
  ) =>
    value
      .replace(/\D/g, "")
      .slice(0, 4);

  const handleContinue =
    async () => {
      const cleanName =
        name.trim();

      if (!cleanName) {
        setMessage(
          "Entrez votre nom pour continuer."
        );
        return;
      }

      setLoading(true);
      setMessage("");

      try {
        const response =
          await fetch(
            "/api/auth/lookup",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                name: cleanName,
              }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          setMessage(
            data.error ||
              "Utilisateur introuvable."
          );
          return;
        }

        setName(data.name);

        if (data.pinDefined) {
          setStep(
            "login-pin"
          );
        } else {
          setStep(
            "create-pin"
          );
        }
      } catch {
        setMessage(
          "Impossible de contacter le serveur. Réessayez."
        );
      } finally {
        setLoading(false);
      }
    };

  const handleCreatePin =
    async () => {
      if (
        !/^\d{4}$/.test(pin)
      ) {
        setMessage(
          "Votre PIN doit contenir exactement 4 chiffres."
        );
        return;
      }

      if (
        pin !== confirmPin
      ) {
        setMessage(
          "Les deux PIN ne correspondent pas."
        );

        setConfirmPin("");
        return;
      }

      setLoading(true);
      setMessage("");

      try {
        const response =
          await fetch(
            "/api/auth/set-pin",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                name,
                pin,
              }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          setMessage(
            data.error ||
              "Impossible de créer le PIN."
          );

          setPin("");
          setConfirmPin("");
          return;
        }

        redirectByRole(
          data.role
        );
      } catch {
        setMessage(
          "Impossible de contacter le serveur. Réessayez."
        );
      } finally {
        setLoading(false);
      }
    };

  const handleLogin =
    async () => {
      if (
        !/^\d{4}$/.test(pin)
      ) {
        setMessage(
          "Entrez votre PIN à 4 chiffres."
        );
        return;
      }

      setLoading(true);
      setMessage("");

      try {
        const response =
          await fetch(
            "/api/auth/login",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                name,
                pin,
              }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          setMessage(
            data.error ||
              "PIN incorrect."
          );

          /*
           * Le mauvais PIN disparaît
           * immédiatement pour permettre
           * une nouvelle saisie.
           */
          setPin("");
          return;
        }

        redirectByRole(
          data.role
        );
      } catch {
        setMessage(
          "Impossible de contacter le serveur. Réessayez."
        );
      } finally {
        /*
         * IMPORTANT :
         * même si le PIN est incorrect,
         * le bouton quitte l'état
         * "Connexion..."
         */
        setLoading(false);
      }
    };

  const goBack = () => {
    if (loading) {
      return;
    }

    setStep("name");
    setPin("");
    setConfirmPin("");
    setMessage("");
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F5F2EB] px-4 py-8">
      {/* Ambiance MAIDA */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-[#DDE8DF] blur-3xl" />

      <div className="pointer-events-none absolute -bottom-36 -right-28 h-96 w-96 rounded-full bg-[#E9E1D4] blur-3xl" />

      <div className="relative w-full max-w-md">
        {/* MARQUE */}
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1E4D3A] shadow-lg shadow-[#1E4D3A]/15">
            <span className="text-xl font-black text-white">
              M
            </span>
          </div>

          <h1 className="mt-4 text-3xl font-black tracking-[-0.04em] text-[#1F2924]">
            MAIDA
          </h1>

          <p className="mt-1 text-sm text-[#6E756F]">
            Votre restaurant.
            Plus simple.
          </p>
        </div>

        {/* CARTE */}
        <div className="rounded-[28px] border border-white/80 bg-white p-6 shadow-[0_20px_60px_-25px_rgba(31,41,36,0.25)] sm:p-8">
          {step === "name" && (
            <>
              <div className="mb-7">
                <p className="text-sm font-semibold text-[#2E6A50]">
                  Connexion
                </p>

                <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#1F2924]">
                  Bonjour
                </h2>

                <p className="mt-2 text-sm leading-6 text-[#737A75]">
                  Entrez votre nom
                  pour accéder à votre
                  espace.
                </p>
              </div>

              <label
                htmlFor="name"
                className="mb-2 block text-sm font-semibold text-[#343D38]"
              >
                Nom
              </label>

              <input
                id="name"
                type="text"
                value={name}
                disabled={loading}
                autoFocus
                autoComplete="name"
                placeholder="Ex. Mohamed"
                onChange={(event) => {
                  setName(
                    event.target.value
                  );

                  if (message) {
                    setMessage("");
                  }
                }}
                onKeyDown={(event) => {
                  if (
                    event.key ===
                      "Enter" &&
                    !loading
                  ) {
                    handleContinue();
                  }
                }}
                className="h-14 w-full rounded-2xl border border-[#E1E5E2] bg-[#F8F9F7] px-4 text-base text-[#1F2924] outline-none transition placeholder:text-[#A2A8A4] focus:border-[#2E6A50] focus:bg-white focus:ring-4 focus:ring-[#DDE8DF] disabled:opacity-60"
              />

              <button
                type="button"
                onClick={
                  handleContinue
                }
                disabled={loading}
                className="mt-5 flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#1E4D3A] px-5 font-semibold text-white transition hover:bg-[#173D2F] active:scale-[0.99] disabled:cursor-wait disabled:opacity-65"
              >
                {loading && (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                )}

                {loading
                  ? "Vérification..."
                  : "Continuer"}
              </button>
            </>
          )}

          {step ===
            "login-pin" && (
            <>
              <div className="mb-7">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={loading}
                  className="mb-5 text-sm font-medium text-[#8A918C] transition hover:text-[#1E4D3A] disabled:opacity-50"
                >
                  ← Changer
                  d&apos;utilisateur
                </button>

                <p className="text-sm font-semibold text-[#2E6A50]">
                  {name}
                </p>

                <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#1F2924]">
                  Entrez votre PIN
                </h2>

                <p className="mt-2 text-sm leading-6 text-[#737A75]">
                  Utilisez votre code
                  personnel à 4
                  chiffres.
                </p>
              </div>

              <label
                htmlFor="pin"
                className="mb-2 block text-sm font-semibold text-[#343D38]"
              >
                Code PIN
              </label>

              <input
                id="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                autoFocus
                disabled={loading}
                value={pin}
                onChange={(event) => {
                  setPin(
                    cleanPinValue(
                      event.target
                        .value
                    )
                  );

                  if (message) {
                    setMessage("");
                  }
                }}
                onKeyDown={(event) => {
                  if (
                    event.key ===
                      "Enter" &&
                    !loading
                  ) {
                    handleLogin();
                  }
                }}
                placeholder="••••"
                className="h-16 w-full rounded-2xl border border-[#E1E5E2] bg-[#F8F9F7] px-4 text-center text-3xl font-bold tracking-[0.45em] text-[#1F2924] outline-none transition placeholder:text-[#C5CAC7] focus:border-[#2E6A50] focus:bg-white focus:ring-4 focus:ring-[#DDE8DF] disabled:opacity-60"
              />

              <button
                type="button"
                onClick={
                  handleLogin
                }
                disabled={loading}
                className="mt-5 flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#1E4D3A] px-5 font-semibold text-white transition hover:bg-[#173D2F] active:scale-[0.99] disabled:cursor-wait disabled:opacity-65"
              >
                {loading && (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                )}

                {loading
                  ? "Connexion..."
                  : "Se connecter"}
              </button>
            </>
          )}

          {step ===
            "create-pin" && (
            <>
              <div className="mb-7">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={loading}
                  className="mb-5 text-sm font-medium text-[#8A918C] transition hover:text-[#1E4D3A] disabled:opacity-50"
                >
                  ← Retour
                </button>

                <p className="text-sm font-semibold text-[#2E6A50]">
                  Première connexion
                </p>

                <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#1F2924]">
                  Créez votre PIN
                </h2>

                <p className="mt-2 text-sm leading-6 text-[#737A75]">
                  Bonjour{" "}
                  <span className="font-semibold text-[#343D38]">
                    {name}
                  </span>
                  . Choisissez un
                  code personnel à 4
                  chiffres.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="new-pin"
                    className="mb-2 block text-sm font-semibold text-[#343D38]"
                  >
                    Nouveau PIN
                  </label>

                  <input
                    id="new-pin"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    autoFocus
                    disabled={loading}
                    value={pin}
                    onChange={(
                      event
                    ) => {
                      setPin(
                        cleanPinValue(
                          event.target
                            .value
                        )
                      );

                      if (message) {
                        setMessage("");
                      }
                    }}
                    placeholder="••••"
                    className="h-16 w-full rounded-2xl border border-[#E1E5E2] bg-[#F8F9F7] px-4 text-center text-3xl font-bold tracking-[0.45em] text-[#1F2924] outline-none transition placeholder:text-[#C5CAC7] focus:border-[#2E6A50] focus:bg-white focus:ring-4 focus:ring-[#DDE8DF] disabled:opacity-60"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirm-pin"
                    className="mb-2 block text-sm font-semibold text-[#343D38]"
                  >
                    Confirmer le PIN
                  </label>

                  <input
                    id="confirm-pin"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    disabled={loading}
                    value={confirmPin}
                    onChange={(
                      event
                    ) => {
                      setConfirmPin(
                        cleanPinValue(
                          event.target
                            .value
                        )
                      );

                      if (message) {
                        setMessage("");
                      }
                    }}
                    onKeyDown={(
                      event
                    ) => {
                      if (
                        event.key ===
                          "Enter" &&
                        !loading
                      ) {
                        handleCreatePin();
                      }
                    }}
                    placeholder="••••"
                    className="h-16 w-full rounded-2xl border border-[#E1E5E2] bg-[#F8F9F7] px-4 text-center text-3xl font-bold tracking-[0.45em] text-[#1F2924] outline-none transition placeholder:text-[#C5CAC7] focus:border-[#2E6A50] focus:bg-white focus:ring-4 focus:ring-[#DDE8DF] disabled:opacity-60"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={
                  handleCreatePin
                }
                disabled={loading}
                className="mt-5 flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#1E4D3A] px-5 font-semibold text-white transition hover:bg-[#173D2F] active:scale-[0.99] disabled:cursor-wait disabled:opacity-65"
              >
                {loading && (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                )}

                {loading
                  ? "Création..."
                  : "Créer mon PIN"}
              </button>

              <div className="mt-4 rounded-xl bg-[#F5F7F4] px-4 py-3">
                <p className="text-xs leading-5 text-[#737A75]">
                  Ce PIN sera utilisé
                  pour vos prochaines
                  connexions. Ne le
                  partagez pas.
                </p>
              </div>
            </>
          )}

          {message && (
            <div
              aria-live="polite"
              className="mt-5 rounded-2xl border border-[#F2D4CE] bg-[#FFF4F1] px-4 py-3"
            >
              <p className="text-sm font-medium text-[#B54A3A]">
                {message}
              </p>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-[#9A9F9B]">
          MAIDA · Gestion de
          restaurant
        </p>
      </div>
    </main>
  );
}