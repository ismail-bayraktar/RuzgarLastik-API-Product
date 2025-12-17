"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

const navItems = [
	{ href: "/dashboard", label: "Genel Bakış", icon: "📊" },
	{ href: "/dashboard/sync", label: "Senkronizasyon", icon: "🔄" },
	{ href: "/dashboard/products", label: "Ürünler", icon: "📦" },
	{ href: "/dashboard/pricing-rules", label: "Fiyat Kuralları", icon: "💰" },
	{ href: "/dashboard/logs", label: "Loglar", icon: "📋" },
	{ href: "/dashboard/settings", label: "Ayarlar", icon: "⚙️" },
];

export default function DashboardNav({ userName }: { userName: string }) {
	const pathname = usePathname();
	const router = useRouter();

	const handleSignOut = async () => {
		await authClient.signOut();
		router.push("/login");
	};

	return (
		<nav className="bg-slate-800/80 backdrop-blur-sm border-b border-purple-500/20 sticky top-0 z-50">
			<div className="max-w-7xl mx-auto px-4">
				<div className="flex items-center justify-between h-16">
					<div className="flex items-center gap-8">
						<Link href="/dashboard" className="flex items-center gap-2">
							<span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
								Rüzgar Lastik
							</span>
						</Link>
						<div className="hidden md:flex items-center gap-1">
							{navItems.map((item) => (
								<Link
									key={item.href}
									href={item.href}
									className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
										pathname === item.href
											? "bg-purple-600/30 text-purple-300"
											: "text-slate-400 hover:text-white hover:bg-slate-700/50"
									}`}
								>
									<span className="mr-1">{item.icon}</span>
									{item.label}
								</Link>
							))}
						</div>
					</div>
					<div className="flex items-center gap-4">
						<span className="text-sm text-slate-400">{userName}</span>
						<button
							onClick={handleSignOut}
							className="px-3 py-1.5 text-sm bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg transition"
						>
							Çıkış
						</button>
					</div>
				</div>
			</div>
		</nav>
	);
}
