import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // Evite que Turbopack ne remonte vers un depot Git parent (C:\Users\USER)
    // pour deviner la racine du projet.
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
