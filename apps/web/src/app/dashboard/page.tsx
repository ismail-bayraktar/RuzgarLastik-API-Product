import { redirect } from "next/navigation";
import Dashboard from "./dashboard";
import { headers } from "next/headers";
import { authClient } from "@/lib/auth-client";

export default async function DashboardPage() {
	const session = await authClient.getSession({
		fetchOptions: {
			headers: await headers(),
			throw: true,
		},
	});

	if (!session?.user) {
		redirect("/login");
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
			<div className="container mx-auto px-4 py-8">
				<div className="mb-8">
					<h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
						Rüzgar Lastik Sync Dashboard
					</h1>
					<p className="text-slate-400">Merhaba, {session.user.name}</p>
				</div>
				<Dashboard session={session} />
			</div>
		</div>
	);
}
