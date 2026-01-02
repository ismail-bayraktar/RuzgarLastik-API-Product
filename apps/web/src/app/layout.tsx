import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "../index.css";
import Providers from "@/components/providers";

const dmSans = DM_Sans({
	variable: "--font-dm-sans",
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
	title: "Ruzgar Lastik - Admin Panel",
	description: "Tedarikci ve Shopify senkronizasyon yonetimi",
	icons: {
		icon: "/favicon.png",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="tr" suppressHydrationWarning className="dark">
			<body className={`${dmSans.variable} font-sans antialiased`}>
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
