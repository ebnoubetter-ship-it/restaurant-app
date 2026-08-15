export default function CashierLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F2EB] p-4">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1E4D3A] text-lg font-black text-white">
          M
        </div>

        <div className="mx-auto mt-6 h-7 w-7 animate-spin rounded-full border-[3px] border-[#D4DDD7] border-t-[#1E4D3A]" />

        <p className="mt-4 font-semibold text-[#343D38]">
          Chargement...
        </p>

        <p className="mt-1 text-sm text-[#8A918C]">
          MAIDA prépare la caisse.
        </p>
      </div>
    </main>
  );
}