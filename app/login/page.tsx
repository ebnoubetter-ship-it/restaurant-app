"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [name, setName] = useState("");
  const [step, setStep] = useState<"name" | "create-pin" | "login-pin">("name");
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [message, setMessage] = useState("");

  const handleContinue = async () => {
    if (!name.trim()) return;

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("name", name.trim())
      .single();

    if (error || !data) {
      setMessage("Utilisateur introuvable");
      return;
    }

    setUserId(data.id);
    setRole(data.role);

    if (!data.pin_defined) {
      setStep("create-pin");
      setMessage("");
      return;
    }

    setStep("login-pin");
    setMessage("");
  };

  const handleCreatePin = async () => {
    if (pin.length !== 4) {
      setMessage("Le PIN doit contenir 4 chiffres.");
      return;
    }

    if (pin !== confirmPin) {
      setMessage("Les deux codes PIN ne correspondent pas.");
      return;
    }

    const { error } = await supabase
      .from("users")
      .update({
        pin_hash: pin,
        pin_defined: true,
      })
      .eq("id", userId);

    if (error) {
      setMessage("Erreur lors de la création du PIN.");
      return;
    }

    setMessage("PIN créé avec succès.");
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm bg-white p-6 rounded-2xl shadow">
        {step === "name" && (
          <>
            <h1 className="text-2xl font-bold mb-6">Connexion</h1>

            <input
              type="text"
              placeholder="Votre nom"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded-xl px-4 py-3 mb-4"
            />

            <button
              onClick={handleContinue}
              className="w-full bg-sky-500 text-white rounded-xl py-3 font-medium"
            >
              Continuer
            </button>
          </>
        )}

        {step === "create-pin" && (
          <>
            <h1 className="text-2xl font-bold mb-2">Créer votre PIN</h1>
            <p className="text-sm text-slate-500 mb-6">
              Bonjour {name}. Créez votre code PIN à 4 chiffres.
            </p>

            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              className="w-full border rounded-xl px-4 py-3 mb-4"
            />

            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="Confirmer le PIN"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
              className="w-full border rounded-xl px-4 py-3 mb-4"
            />

            <button
              onClick={handleCreatePin}
              className="w-full bg-sky-500 text-white rounded-xl py-3 font-medium"
            >
              Créer mon PIN
            </button>
          </>
        )}

        {step === "login-pin" && (
          <>
            <h1 className="text-2xl font-bold mb-2">Bienvenue {name}</h1>
            <p className="text-sm text-slate-500 mb-6">
              Entrez votre code PIN.
            </p>

            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              className="w-full border rounded-xl px-4 py-3"
            />
          </>
        )}

        {message && (
          <p className="mt-4 text-sm text-slate-600">
            {message}
          </p>
        )}
      </div>
    </main>
  );
}