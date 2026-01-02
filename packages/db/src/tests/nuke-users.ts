import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { db } from "../index";
import { user, account, session } from "../schema/auth";

async function nukeUsers() {
    console.log("🧨 Tüm kullanıcı verileri temizleniyor...");
    try {
        // Foreign key kısıtlamaları nedeniyle sırayla siliyoruz
        await db.delete(session);
        await db.delete(account);
        await db.delete(user);
        
        console.log("✅ Tüm kullanıcılar, hesaplar ve oturumlar silindi.");
        process.exit(0);
    } catch (e) {
        console.error("❌ Temizlik hatası:", e);
        process.exit(1);
    }
}

nukeUsers();
