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
		<div className="min-h-screen bg-background">
			<DashboardNav userName={session.user.name} />
			<main className="lg:pl-64">{children}</main>
		</div>
	);
}
