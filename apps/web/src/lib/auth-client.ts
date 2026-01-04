import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
    // Production'da relative path kullanarak CORS sorununu çözüyoruz.
    // Development'ta (localhost) env değişkenini kullanabiliriz.
    baseURL: process.env.NODE_ENV === "development" ? "http://localhost:3000" : undefined,
});