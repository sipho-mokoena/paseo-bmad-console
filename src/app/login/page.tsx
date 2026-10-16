import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const githubEnabled =
    !!process.env.GITHUB_CLIENT_ID && !!process.env.GITHUB_CLIENT_SECRET;
  const registrationEnabled = process.env.ALLOW_REGISTRATION === "true";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-8">
      <Suspense>
        <LoginForm
          githubEnabled={githubEnabled}
          registrationEnabled={registrationEnabled}
        />
      </Suspense>
      <p className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] text-xs text-muted-foreground">
        Paseo BMAD Console
      </p>
    </div>
  );
}
