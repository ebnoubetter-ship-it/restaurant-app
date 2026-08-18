import Link from "next/link";

export default function RestrictedPage() {
  return (
    <main className="min-h-screen bg-[#F5F2EB] px-6 py-12 text-[#1F2924]">
      <div className="mx-auto flex min-h-[75vh] max-w-md items-center justify-center">
        <div className="w-full rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="text-3xl font-bold text-[#1E4D3A]">
            MAIDA
          </div>

          <p className="mt-2 text-sm text-[#737A75]">
            Votre restaurant. Plus simple.
          </p>

          <div className="mt-8 rounded-2xl bg-[#FFF4F1] p-6">
            <p className="font-semibold text-[#B54A3A]">
              Votre accès est restreint. Contactez le support MAIDA.
            </p>
          </div>

          <p className="mt-6 text-sm leading-6 text-[#737A75]">
            Si votre accès a été réactivé, vous pouvez essayer de vous reconnecter.
          </p>

          <Link
            href="/login"
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#1E4D3A] px-5 font-semibold text-white transition hover:bg-[#173D2F]"
          >
            Réessayer
          </Link>
        </div>
      </div>
    </main>
  );
}