import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
} from "next/font/google";
import {
  NextIntlClientProvider,
} from "next-intl";

import "./globals.css";

const geistSans =
  Geist({
    variable:
      "--font-geist-sans",

    subsets: [
      "latin",
    ],
  });

const geistMono =
  Geist_Mono({
    variable:
      "--font-geist-mono",

    subsets: [
      "latin",
    ],
  });

export const metadata: Metadata =
  {
    title: "MAIDA",

    description:
      "Gestion de restaurant",
  };

export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      dir="ltr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}