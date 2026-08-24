import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl =
  createNextIntlPlugin(
    "./i18n/request.ts"
  );

const nextConfig: NextConfig = {
  /*
   * Configuration Next.js MAIDA
   */
};

export default withNextIntl(
  nextConfig
);