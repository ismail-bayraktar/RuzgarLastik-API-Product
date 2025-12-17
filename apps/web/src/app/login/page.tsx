"use client";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import { useState } from "react";

export default function LoginPage() {
	const [showSignIn, setShowSignIn] = useState(true);

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
			<div className="w-full max-w-md">
				<div className="text-center mb-8">
					<h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent mb-2">
						Rüzgar Lastik Sync
					</h1>
					<p className="text-slate-400">Admin Panel</p>
				</div>
				<div className="bg-slate-800/50 backdrop-blur-sm border border-purple-500/20 rounded-xl shadow-2xl p-6">
					{showSignIn ? (
						<SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
					) : (
						<SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
					)}
				</div>
			</div>
		</div>
	);
}
