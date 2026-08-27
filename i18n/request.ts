import {
  getRequestConfig,
} from "next-intl/server";
import {
  cookies,
} from "next/headers";

export default getRequestConfig(
  async () => {
    const cookieStore =
      await cookies();

    const cookieLocale =
      cookieStore.get(
        "maida_locale"
      )?.value;

    const locale =
      cookieLocale === "ar"
        ? "ar"
        : "fr";

    return {
      locale,
      messages:
        (
          await import(
            `../messages/${locale}.json`
          )
        ).default,
    };
  }
);