"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Button from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Card, CardBody } from "@/components/ui/Card";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("Incorrect email or password. Please try again.");
      return;
    }
    router.push(params.get("callbackUrl") || "/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-primary px-4 py-8">
      <div className="mb-8 text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gold text-primary-dark font-bold text-2xl mb-3">
          S
        </div>
        <h1 className="text-2xl font-bold text-white">KudiTrack</h1>
        <p className="text-white/70 text-sm mt-1">Sales &amp; stock made simple</p>
      </div>

      <Card className="w-full max-w-sm">
        <CardBody>
          <h2 className="text-lg font-semibold mb-4">Sign in to your shop</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourshop.com"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-danger bg-danger-light rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <Button type="submit" fullWidth size="lg" loading={loading}>
              Sign in
            </Button>
          </form>
        </CardBody>
      </Card>

      <p className="text-white/60 text-xs mt-6 text-center max-w-sm">
        Having trouble signing in? Ask your business owner or manager to reset your password
        from Users &amp; Permissions.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
