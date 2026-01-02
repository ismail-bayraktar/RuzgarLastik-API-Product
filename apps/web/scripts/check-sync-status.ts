import dotenv from "dotenv";
import path from "path";

const envPath = path.resolve(import.meta.dir, "../../.env");
dotenv.config({ path: envPath });

async function main() {
	const { db } = await import("@my-better-t-app/db");

	// Son sync session'ları kontrol et
	const sessions = await db.execute(
		"SELECT * FROM sync_sessions ORDER BY started_at DESC LIMIT 3"
	);
	console.log("=== Recent Sync Sessions ===");
	for (const session of sessions.rows) {
		console.log(JSON.stringify(session, null, 2));
	}

	// Son sync items (hata detayları - dry_run olmayan)
	const errorItems = await db.execute(
		"SELECT * FROM sync_items WHERE message != 'dry_run' ORDER BY id DESC LIMIT 10"
	);
	console.log("\n=== Non-DryRun Sync Items (Errors/Success) ===");
	for (const item of errorItems.rows) {
		console.log(JSON.stringify(item, null, 2));
	}

	// Session'a göre grupla
	const latestSessionId = sessions.rows[0]?.id;
	if (latestSessionId) {
		const sessionItems = await db.execute(
			`SELECT message, COUNT(*) as count FROM sync_items WHERE session_id = '${latestSessionId}' GROUP BY message`
		);
		console.log("\n=== Latest Session Item Summary ===");
		console.log(JSON.stringify(sessionItems.rows, null, 2));
	}
}

main().catch(console.error);
