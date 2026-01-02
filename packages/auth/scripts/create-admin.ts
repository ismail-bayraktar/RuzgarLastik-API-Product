import { auth } from "../src/index";
import { db } from "@my-better-t-app/db";
import { user } from "@my-better-t-app/db/schema/auth";
import { eq } from "drizzle-orm";

async function createAdmin() {
    const adminEmail = "admin@ruzgarlastik.com";
    const adminPassword = "RuzgarLastik2024!";
    const adminName = "Admin";

    console.log(`🚀 Admin kullanıcısı oluşturuluyor: ${adminEmail}`);

    try {
        // Mevcut kullanıcıyı kontrol et
        const existingUser = await db.query.user.findFirst({
            where: eq(user.email, adminEmail)
        });

        if (existingUser) {
            console.log("⚠️ Admin kullanıcısı zaten mevcut.");
            process.exit(0);
        }

        // Better-Auth API kullanarak kullanıcı oluştur (Bu şifreyi hash'ler)
        const newUser = await auth.api.signUpEmail({
            body: {
                email: adminEmail,
                password: adminPassword,
                name: adminName,
            }
        });

        console.log("✅ Admin kullanıcısı başarıyla oluşturuldu!");
        console.log("Kullanıcı ID:", newUser.user.id);
        
        process.exit(0);
    } catch (error) {
        console.error("❌ Admin oluşturma hatası:", error);
        process.exit(1);
    }
}

createAdmin();
