import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
} from "next/font/google";
import {
  NextIntlClientProvider,
} from "next-intl";
import {
  getMessages,
} from "next-intl/server";
import {
  cookies,
} from "next/headers";

import LanguageSwitcher from "@/components/LanguageSwitcher";

import "./globals.css";

const geistSans = Geist({
  variable:
    "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono =
  Geist_Mono({
    variable:
      "--font-geist-mono",
    subsets: ["latin"],
  });

export const metadata: Metadata = {
  title: "MAIDA",
  description:
    "Gestion de restaurant",
};

export default async function RootLayout({
  children,
}: LayoutProps<"/">) {
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

  const direction =
    locale === "ar"
      ? "rtl"
      : "ltr";

  const messages =
    await getMessages({
      locale,
    });

  return (
    <html
      lang={locale}
      dir={direction}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="fixed bottom-4 left-4 z-[100]">
          <LanguageSwitcher
            locale={locale}
          />
        </div>

        <NextIntlClientProvider
          locale={locale}
          messages={messages}
        >
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}