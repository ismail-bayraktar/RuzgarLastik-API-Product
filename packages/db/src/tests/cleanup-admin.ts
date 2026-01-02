import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../apps/web/.env") });

import { db } from "../index";
import { user, account } from "../schema/auth";
import { eq } from "drizzle-orm";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${salt}:${derivedKey.toString("hex")}`;
}

async function forceCreateAdmin() {
    const adminEmail = "admin@ruzgarlastik.com";
    const adminPassword = "RuzgarLastik2024!";
    
    console.log("🛠️ Admin hesabı sıfırlanıyor...");

    try {
        // Varsa eskiyi temizle
        const existing = await db.query.user.findFirst({ where: eq(user.email, adminEmail) });
        if (existing) {
            await db.delete(account).where(eq(account.userId, existing.id));
            await db.delete(user).where(eq(user.id, existing.id));
            console.log("🗑️ Eski kayıtlar temizlendi.");
        }

        const userId = "admin_" + Date.now();
        
        // 1. User Ekle
        await db.insert(user).values({
            id: userId,
            email: adminEmail,
            name: "Admin",
            emailVerified: true,
        });

        // 2. Account (Şifre) Ekle - Better-Auth scrypt formatı
        // Not: Better-Auth internal hash kullanmak yerine en güvenli yolu tercih edelim.
        // Aslında en iyisi auth.api.signUp kullanmak ama monorepo yol hatası veriyordu.
        // Bu sefer veritabanına direkt insert yerine signup trigger edeceğiz.
        
        console.log("✅ Veritabanı temizlendi. Şimdi sunucu üzerinden signup denenecek.");
        process.exit(0);
    } catch (e) {
        console.error("❌ Hata:", e);
        process.exit(1);
    }
}

forceCreateAdmin();
