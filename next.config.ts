import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Une page vue il y a moins de 30 s se réaffiche sans attendre. Toute action
    // de l'utilisateur vide ce cache (revalidatePath).
    staleTimes: { dynamic: 30 },
  },
  turbopack: {
    // Evite que Turbopack ne remonte vers un depot Git parent pour deviner la
    // racine du projet.
    root: path.resolve(__dirname),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Interdit d'afficher le site dans une page piégée (clickjacking).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
        ],
      },
    ];
  },
};

export default nextConfig;
