import type { NextConfig } from "next";
import path from "path";

const config: NextConfig = {
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.fbcdn.net" }, { protocol: "https", hostname: "**.cdninstagram.com" }],
  },
};

export default config;
