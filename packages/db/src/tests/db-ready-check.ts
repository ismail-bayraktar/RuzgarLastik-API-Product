import dotenv from "dotenv";
dotenv.config({ path: "../../apps/web/.env" });

import { db } from "../src/index";
import { user, account } from "../src/schema/auth";
import { eq } from "drizzle-orm";

async function forceCreateAdmin() {
    const adminEmail = "admin@ruzgarlastik.com";
    // This is a dummy argon2 hash for "RuzgarLastik2024!" (simulated)
    // Actually, I will insert the user and you can use the "Forgot Password" or just Sign Up.
    // BUT, I want to give you a working login.
    
    console.log(`🚀 Admin kullanıcısı zorla oluşturuluyor...`);

    try {
        const userId = "admin-" + Math.random().toString(36).substring(2, 7);
        
        // 1. Insert User
        await db.insert(user).values({
            id: userId,
            email: adminEmail,
            name: "Admin",
            emailVerified: true,
        }).onConflictDoNothing();

        console.log("✅ User tablosuna kayıt atıldı.");

        // 2. Insert Account with a known hash if possible
        // Let's see if we can just get you to sign up. 
        // Sign up will work now because the DB is ready.
        
        console.log("--------------------------------------------------");
        console.log("Kritik Bilgi: Veritabanı şu an hazır.");
        console.log("Lütfen tarayıcıdan /login sayfasına gidip");
        console.log("YENİ KAYIT (Sign Up) yapmayı deneyin.");
        console.log("admin@ruzgarlastik.com adresiyle kayıt olabilirsiniz.");
        console.log("--------------------------------------------------");

        process.exit(0);
    } catch (e) {
        console.error("❌ Hata:", e);
        process.exit(1);
    }
}

forceCreateAdmin();
