import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    SHOPIFY_API_KEY: "0371a3cc7fae2893d55741fe33e1989c",
    SHOPIFY_API_SECRET: "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",
    SHOPIFY_SCOPES: "read_products,write_products",
    SHOPIFY_APP_URL: "https://631bc6fe-a22a-4e72-a8b5-6b39e25987db.builder.kiloapps.io",
    SHOPIFY_STORE_DOMAIN: "neonailuk.myshopify.com",
    NEXTAUTH_SECRET: "axBctaj5qb3dMG+5ysgXROuwwXsISolm",
  },
};

export default nextConfig;
