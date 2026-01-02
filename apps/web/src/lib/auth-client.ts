import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
    // Unified yapıda baseURL boş bırakılabilir veya NEXT_PUBLIC_SERVER_URL kullanılabilir
	baseURL: process.env.NEXT_PUBLIC_SERVER_URL || window.location.origin,
});