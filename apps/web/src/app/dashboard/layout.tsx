import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@my-better-t-app/auth";
import DashboardNav from "./nav";

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		redirect("/login");
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
			<DashboardNav userName={session.user.name} />
			<main>{children}</main>
		</div>
	);
}
