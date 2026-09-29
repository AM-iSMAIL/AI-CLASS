"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  initializeRevenueCat,
  getProEntitlementStatus,
  getCreditBalance,
  purchaseRevenueCatPlan,
  restoreRevenueCatPurchases,
  consumeLectureCredit,
  resetDemoPurchases,
  RevenueCatPlan,
  REVENUECAT_PLANS,
} from "./index";
import { subscribeToAuthChanges } from "@/lib/auth-service";

interface RevenueCatContextType {
  isPro: boolean;
  credits: number;
  isPaywallOpen: boolean;
  isLoading: boolean;
  plans: RevenueCatPlan[];
  openPaywall: () => void;
  closePaywall: () => void;
  purchasePlan: (planId: string) => Promise<{ success: boolean; message: string }>;
  restorePurchases: () => Promise<void>;
  consumeCredit: () => boolean;
  resetDemo: () => void;
}

const RevenueCatContext = createContext<RevenueCatContextType | undefined>(undefined);

export function RevenueCatProvider({ children }: { children: ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const [credits, setCredits] = useState(1);
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Sync state from storage
  const syncState = () => {
    setIsPro(getProEntitlementStatus());
    setCredits(getCreditBalance());
  };

  useEffect(() => {
    syncState();
    setIsLoading(false);

    // Initialize RevenueCat SDK with current user if logged in
    const unsubscribe = subscribeToAuthChanges((user) => {
      initializeRevenueCat(user?.uid);
    });

    return () => unsubscribe();
  }, []);

  const openPaywall = () => setIsPaywallOpen(true);
  const closePaywall = () => setIsPaywallOpen(false);

  const purchasePlan = async (planId: string) => {
    setIsLoading(true);
    try {
      const result = await purchaseRevenueCatPlan(planId);
      syncState();
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  const restorePurchases = async () => {
    setIsLoading(true);
    try {
      await restoreRevenueCatPurchases();
      syncState();
    } finally {
      setIsLoading(false);
    }
  };

  const consumeCredit = () => {
    const success = consumeLectureCredit();
    syncState();
    return success;
  };

  const resetDemo = () => {
    resetDemoPurchases();
    syncState();
  };

  return (
    <RevenueCatContext.Provider
      value={{
        isPro,
        credits,
        isPaywallOpen,
        isLoading,
        plans: REVENUECAT_PLANS,
        openPaywall,
        closePaywall,
        purchasePlan,
        restorePurchases,
        consumeCredit,
        resetDemo,
      }}
    >
      {children}
    </RevenueCatContext.Provider>
  );
}

export function useRevenueCat() {
  const context = useContext(RevenueCatContext);
  if (!context) {
    throw new Error("useRevenueCat must be used within a RevenueCatProvider");
  }
  return context;
}
