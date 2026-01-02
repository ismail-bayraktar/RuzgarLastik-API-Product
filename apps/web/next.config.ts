import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	typedRoutes: true,
	reactCompiler: true,
	// Artık harici server yok, her şey dahili API üzerinden yürüyor.
};

export default nextConfig;