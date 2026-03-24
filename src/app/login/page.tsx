import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md px-4 py-12 text-center text-muted-foreground">Loading…</div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
