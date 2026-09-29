"use client";

import React, { ReactNode } from "react";
import { RevenueCatProvider } from "@/lib/revenuecat/use-revenuecat";
import RevenueCatPaywall from "@/components/revenuecat-paywall";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <RevenueCatProvider>
      {children}
      <RevenueCatPaywall />
    </RevenueCatProvider>
  );
}
