export default function UnauthorizedPage() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">
          Accès non autorisé
        </h1>

        <p className="mt-2 text-slate-500">
          Vous n'avez pas accès à cet espace.
        </p>
      </div>
    </main>
  );
}