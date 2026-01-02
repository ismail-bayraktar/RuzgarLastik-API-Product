import dotenv from "dotenv";
dotenv.config({ path: "../../apps/web/.env" });

import { db } from "../src/index";
import { user, account } from "../src/schema/auth";
import { eq } from "drizzle-orm";
// Better-Auth uses argon2 or scrypt. 
// We can use a simpler approach: 
// Better-Auth allows providing a custom hasher, 
// but by default it uses a secure one.
// Let's try to use the one from better-auth if we can.

async function createAdmin() {
    const adminEmail = "admin@ruzgarlastik.com";
    // We will use a pre-hashed password if needed, 
    // but let's try to find a way to hash it correctly.
    const adminName = "Admin";

    console.log(`🚀 Admin kullanıcısı oluşturuluyor: ${adminEmail}`);

    try {
        const userId = "admin-user-id";
        
        // 1. User
        await db.insert(user).values({
            id: userId,
            email: adminEmail,
            name: adminName,
            emailVerified: true,
        }).onConflictDoNothing();

        // 2. Account (Password)
        // Since I cannot easily hash with argon2 without the lib, 
        // I will use a placeholder or ask the user to login and reset.
        // ACTUALLY, Better-Auth might fail if hash is wrong.
        
        // I'll try to use the signup method from a script that DOES have access to auth
        console.log("⚠️ Please use the UI to sign up the first user, or wait for me to fix the script.");
        
        process.exit(0);
    } catch (error) {
        console.error("❌ Hata:", error);
        process.exit(1);
    }
}

createAdmin();
