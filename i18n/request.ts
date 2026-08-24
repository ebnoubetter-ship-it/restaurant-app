import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async () => {
  /*
   * Étape 1 :
   * français par défaut.
   *
   * À l'étape suivante,
   * cette valeur viendra
   * du choix utilisateur.
   */
  const locale = "fr";

  return {
    locale,

    messages:
      (
        await import(
          `../messages/${locale}.json`
        )
      ).default,
  };
});