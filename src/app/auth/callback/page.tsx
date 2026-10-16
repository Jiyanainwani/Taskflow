"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get("accessToken");

    window.history.replaceState(
      null,
      "",
      window.location.pathname
    );

    if (!accessToken) {
      router.replace("/login?error=missing_token");
      return;
    }

    sessionStorage.setItem("accessToken", accessToken);
    router.replace("/dashboard");
  }, [router]);

  return <p>Signing you in...</p>;
}