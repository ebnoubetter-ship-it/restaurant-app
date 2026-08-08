"use client";

import { useState } from "react";

type Step = "name" | "create-pin" | "login-pin";

export default function LoginPage() {
  const [name, setName] = useState("");
  const [step, setStep] = useState<Step>("name");

  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const redirectByRole = (role: string) => {
    if (role === "admin") {
      window.location.href = "/admin";
    } else if (role === "cashier") {
      window.location.href = "/cashier";
    } else if (role === "stock_manager") {
      window.location.href = "/stock";
    }
  };

  const handleContinue = async () => {
    if (!name.trim()) {
      setMessage("Entrez votre nom.");
      return;
    }

    setLoading(true);
    setMessage("");

    const response = await fetch("/api/auth/lookup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: name.trim(),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "Utilisateur introuvable.");
      setLoading(false);
      return;
    }

    setName(data.name);

    if (data.pinDefined) {
      setStep("login-pin");
    } else {
      setStep("create-pin");
    }

    setLoading(false);
  };

  const handleCreatePin = async () => {
    if (!/^\d{4}$/.test(pin)) {
      setMessage("Le PIN doit contenir 4 chiffres.");
      return;
    }

    if (pin !== confirmPin) {
      setMessage("Les deux PIN ne correspondent pas.");
      return;
    }

    setLoading(true);
    setMessage("");

    const response = await fetch("/api/auth/set-pin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        pin,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "Impossible de créer le PIN.");
      setLoading(false);
      return;
    }

    redirectByRole(data.role);
  };

  const handleLogin = async () => {
    if (!/^\d{4}$/.test(pin)) {
      setMessage("Entrez votre PIN à 4 chiffres.");
      return;
    }

    setLoading(true);
    setMessage("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        pin,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error || "Connexion impossible.");
      setLoading(false);
      return;
    }

    redirectByRole(data.role);
  };

  const goBack = () => {
    setStep("name");
    setPin("");
    setConfirmPin("");
    setMessage("");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm">
        {step === "name" && (
          <>
            <h1 className="mb-2 text-2xl font-bold">
              Connexion
            </h1>

            <p className="mb-6 text-sm text-slate-500">
              Entrez votre nom pour continuer.
            </p>

            <input
              type="text"
              placeholder="Votre nom"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleContinue();
              }}
              className="mb-4 w-full rounded-xl border px-4 py-3 outline-none focus:border-sky-500"
            />

            <button
              onClick={handleContinue}
              disabled={loading}
              className="w-full rounded-xl bg-sky-500 py-3 font-medium text-white disabled:opacity-50"
            >
              {loading ? "Chargement..." : "Continuer"}
            </button>
          </>
        )}

        {step === "create-pin" && (
          <>
            <h1 className="mb-2 text-2xl font-bold">
              Créer votre PIN
            </h1>

            <p className="mb-6 text-sm text-slate-500">
              Bonjour {name}. Choisissez un code PIN à 4 chiffres.
            </p>

            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="PIN"
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, ""))
              }
              className="mb-3 w-full rounded-xl border px-4 py-3 text-center text-xl tracking-[0.4em] outline-none focus:border-sky-500"
            />

            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="Confirmer le PIN"
              value={confirmPin}
              onChange={(e) =>
                setConfirmPin(e.target.value.replace(/\D/g, ""))
              }
              className="mb-4 w-full rounded-xl border px-4 py-3 text-center text-xl tracking-[0.4em] outline-none focus:border-sky-500"
            />

            <button
              onClick={handleCreatePin}
              disabled={loading}
              className="w-full rounded-xl bg-sky-500 py-3 font-medium text-white disabled:opacity-50"
            >
              {loading ? "Création..." : "Créer mon PIN"}
            </button>

            <button
              onClick={goBack}
              className="mt-3 w-full py-2 text-sm text-slate-500"
            >
              Retour
            </button>
          </>
        )}

        {step === "login-pin" && (
          <>
            <h1 className="mb-2 text-2xl font-bold">
              Bienvenue {name}
            </h1>

            <p className="mb-6 text-sm text-slate-500">
              Entrez votre code PIN.
            </p>

            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="PIN"
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, ""))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLogin();
              }}
              className="mb-4 w-full rounded-xl border px-4 py-3 text-center text-xl tracking-[0.4em] outline-none focus:border-sky-500"
            />

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full rounded-xl bg-sky-500 py-3 font-medium text-white disabled:opacity-50"
            >
              {loading ? "Connexion..." : "Se connecter"}
            </button>

            <button
              onClick={goBack}
              className="mt-3 w-full py-2 text-sm text-slate-500"
            >
              Changer d'utilisateur
            </button>
          </>
        )}

        {message && (
          <p className="mt-4 text-center text-sm text-red-500">
            {message}
          </p>
        )}
      </div>
    </main>
  );
}