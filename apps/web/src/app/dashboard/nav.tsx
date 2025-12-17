"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import {
	LayoutDashboard,
	RefreshCw,
	Package,
	DollarSign,
	FileText,
	Settings,
	LogOut,
	Menu,
	X,
	Plug,
} from "lucide-react";
import { useState } from "react";

const navItems = [
	{ href: "/dashboard", label: "Genel Bakis", icon: LayoutDashboard },
	{ href: "/dashboard/sync", label: "Senkronizasyon", icon: RefreshCw },
	{ href: "/dashboard/products", label: "Urunler", icon: Package },
	{ href: "/dashboard/pricing-rules", label: "Fiyat Kurallari", icon: DollarSign },
	{ href: "/dashboard/logs", label: "Loglar", icon: FileText },
	{ href: "/dashboard/settings", label: "Ayarlar", icon: Settings },
	{ href: "/dashboard/api-test", label: "API Test", icon: Plug },
];

export default function DashboardNav({ userName }: { userName: string }) {
	const pathname = usePathname();
	const router = useRouter();
	const [mobileOpen, setMobileOpen] = useState(false);

	const handleSignOut = async () => {
		await authClient.signOut();
		router.push("/login");
	};

	return (
		<>
			<button
				onClick={() => setMobileOpen(true)}
				className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-card border border-border rounded-lg"
			>
				<Menu className="h-5 w-5" />
			</button>

			{mobileOpen && (
				<div
					className="lg:hidden fixed inset-0 z-40 bg-black/50"
					onClick={() => setMobileOpen(false)}
				/>
			)}

			<nav
				className={`fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border transform transition-transform lg:translate-x-0 ${
					mobileOpen ? "translate-x-0" : "-translate-x-full"
				}`}
			>
				<div className="flex flex-col h-full">
					<div className="p-6 border-b border-border">
						<div className="flex items-center justify-between">
							<Link href="/dashboard" className="flex items-center gap-2">
								<div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
									<span className="text-primary-foreground font-bold text-sm">RL</span>
								</div>
								<span className="font-semibold text-foreground">Ruzgar Lastik</span>
							</Link>
							<button
								onClick={() => setMobileOpen(false)}
								className="lg:hidden p-1 hover:bg-muted rounded"
							>
								<X className="h-5 w-5" />
							</button>
						</div>
					</div>

					<div className="flex-1 overflow-y-auto py-4">
						<div className="px-3 space-y-1">
							{navItems.map((item) => {
								const Icon = item.icon;
								const isActive = pathname === item.href;
								return (
									<Link
										key={item.href}
										href={item.href}
										onClick={() => setMobileOpen(false)}
										className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
											isActive
												? "bg-primary text-primary-foreground"
												: "text-muted-foreground hover:text-foreground hover:bg-muted"
										}`}
									>
										<Icon className="h-5 w-5" />
										{item.label}
									</Link>
								);
							})}
						</div>
					</div>

					<div className="p-4 border-t border-border">
						<div className="flex items-center gap-3 px-3 py-2 mb-2">
							<div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
								<span className="text-sm font-medium">{userName?.charAt(0)?.toUpperCase()}</span>
							</div>
							<span className="text-sm text-foreground truncate">{userName}</span>
						</div>
						<button
							onClick={handleSignOut}
							className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
						>
							<LogOut className="h-5 w-5" />
							Cikis Yap
						</button>
					</div>
				</div>
			</nav>
		</>
	);
}
