import Dashboard from "./dashboard";
import { headers } from "next/headers";
import { auth } from "@my-better-t-app/auth";

export default async function DashboardPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	return (
		<div className="p-6 lg:p-8">
			<div className="max-w-7xl mx-auto">
				<div className="mb-8">
					<h1 className="text-2xl font-semibold text-foreground">
						Genel Bakis
					</h1>
					<p className="text-muted-foreground mt-1">Hos geldin, {session?.user.name}</p>
				</div>
				<Dashboard session={session!} />
			</div>
		</div>
	);
}
