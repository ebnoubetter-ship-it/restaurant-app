import { getTranslations } from "next-intl/server";

export default async function UnauthorizedPage() {
  const t =
    await getTranslations(
      "Unauthorized"
    );

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F2EB] px-6 text-[#1F2924]">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
        <div className="text-3xl font-bold text-[#1E4D3A]">
          MAIDA
        </div>

        <p className="mt-2 text-sm text-[#737A75]">
          {t("tagline")}
        </p>

        <div className="mt-8">
          <h1 className="text-2xl font-black">
            {t("title")}
          </h1>

          <p className="mt-3 text-sm leading-6 text-[#737A75]">
            {t("description")}
          </p>
        </div>
      </div>
    </main>
  );
}