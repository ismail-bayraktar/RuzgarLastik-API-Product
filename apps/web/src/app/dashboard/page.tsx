import Dashboard from "./dashboard";
import { headers } from "next/headers";
import { auth } from "@my-better-t-app/auth";

export default async function DashboardPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	return (
		<div className="text-white p-8">
			<div className="max-w-7xl mx-auto">
				<div className="mb-8">
					<h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
						Genel Bakış
					</h1>
					<p className="text-slate-400 mt-1">Hoş geldin, {session?.user.name}</p>
				</div>
				<Dashboard session={session!} />
			</div>
		</div>
	);
}
