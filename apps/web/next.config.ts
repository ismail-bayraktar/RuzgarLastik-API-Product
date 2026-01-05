import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	typedRoutes: true,
	reactCompiler: true,
    typescript: {
        ignoreBuildErrors: true,
    },
    transpilePackages: [
        "@my-better-t-app/api",
        "@my-better-t-app/auth",
        "@my-better-t-app/db",
        "@my-better-t-app/config"
    ],
	// Artık harici server yok, her şey dahili API üzerinden yürüyor.
};

export default nextConfig;