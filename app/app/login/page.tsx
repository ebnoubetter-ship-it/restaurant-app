"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [name, setName] = useState("");
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

    if (!data.pin_defined) {
      setMessage(
        `Bienvenue ${data.name}. Première connexion : vous devez créer votre PIN.`
      );
      return;
    }

    setMessage(`Utilisateur trouvé : ${data.name} - ${data.role}`);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm bg-white p-6 rounded-2xl shadow">
        <h1 className="text-2xl font-bold mb-6">
          Connexion
        </h1>

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

        {message && (
          <p className="mt-4 text-sm text-slate-600">
            {message}
          </p>
        )}
      </div>
    </main>
  );
}