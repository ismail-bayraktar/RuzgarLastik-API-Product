import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Try to load from web root or project root
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { db } from "@my-better-t-app/db";
import { user, account } from "@my-better-t-app/db/schema";
import { eq } from "drizzle-orm";
import { crypto } from "better-auth/crypto";

async function createAdmin() {
    const adminEmail = "admin@ruzgarlastik.com";
    const adminPassword = "RuzgarLastik2024!";
    const adminName = "Admin";

    console.log(`🚀 Admin kullanıcısı oluşturuluyor: ${adminEmail}`);

    try {
        // 1. Kullanıcıyı kontrol et
        const existingUser = await db.query.user.findFirst({
            where: eq(user.email, adminEmail)
        });

        let userId = existingUser?.id;

        if (!existingUser) {
            // 2. User oluştur
            userId = Math.random().toString(36).substring(2, 15);
            await db.insert(user).values({
                id: userId,
                email: adminEmail,
                name: adminName,
                emailVerified: true,
            });
            console.log("✅ User kaydı oluşturuldu.");
        } else {
            console.log("⚠️ User zaten mevcut, account kontrol ediliyor.");
        }

        // 3. Password Hash (Better-Auth uyumlu)
        // Better-Auth default hashing is usually bcrypt or scrypt. 
        // We can use their internal crypto helper if accessible.
        const passwordHash = await crypto.hashPassword(adminPassword);

        // 4. Account oluştur (Credential provider)
        const existingAccount = await db.query.account.findFirst({
            where: eq(account.userId, userId!)
        });

        if (!existingAccount) {
            await db.insert(account).values({
                id: Math.random().toString(36).substring(2, 15),
                userId: userId!,
                accountId: adminEmail,
                providerId: "email",
                password: passwordHash,
            });
            console.log("✅ Account (Kimlik) kaydı oluşturuldu.");
        } else {
            console.log("⚠️ Account zaten mevcut.");
        }

        console.log("🚀 Admin hesabı hazır!");
        process.exit(0);
    } catch (error) {
        console.error("❌ Hata:", error);
        process.exit(1);
    }
}

createAdmin();