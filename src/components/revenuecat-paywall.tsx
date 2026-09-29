"use client";

import React, { useState } from "react";
import {
  X,
  Check,
  Sparkles,
  Zap,
  ShieldCheck,
  CreditCard,
  RefreshCw,
  Crown,
  RotateCcw,
} from "lucide-react";
import { useRevenueCat } from "@/lib/revenuecat/use-revenuecat";

export default function RevenueCatPaywall() {
  const {
    isPro,
    credits,
    isPaywallOpen,
    closePaywall,
    purchasePlan,
    restorePurchases,
    resetDemo,
    plans,
  } = useRevenueCat();

  const [selectedPlanId, setSelectedPlanId] = useState<string>("ai_class_pro_annual");
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isPaywallOpen) return null;

  const handlePurchase = async () => {
    setIsProcessing(true);
    setSuccessMessage(null);
    try {
      const result = await purchasePlan(selectedPlanId);
      if (result.success) {
        setSuccessMessage(result.message);
        setTimeout(() => {
          closePaywall();
          setSuccessMessage(null);
        }, 1800);
      }
    } catch (err: any) {
      alert("Purchase failed: " + (err.message || "Unknown error"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestore = async () => {
    setIsProcessing(true);
    try {
      await restorePurchases();
      setSuccessMessage("Purchases restored successfully!");
      setTimeout(() => setSuccessMessage(null), 2500);
    } catch (err: any) {
      alert("Failed to restore purchases: " + (err.message || "Unknown error"));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden text-neutral-900 animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Glow */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-6 text-white relative">
          <button
            onClick={closePaywall}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all cursor-pointer text-white"
            aria-label="Close paywall"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-bold tracking-wider uppercase">
              <Zap className="h-3 w-3 text-amber-300" />
              Powered by RevenueCat
            </span>
            {isPro && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-400 text-neutral-950 text-[11px] font-bold">
                <Crown className="h-3 w-3" />
                Active Pro
              </span>
            )}
          </div>

          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            Supercharge Your AI Classroom
          </h2>
          <p className="text-sm text-blue-100 mt-1 max-w-lg">
            Unlock complete 6-minute AI lectures with 80 dynamic slides, ultra-realistic Camb AI voice synthesis, and multi-student proctoring.
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 md:p-8 space-y-6 max-h-[80vh] overflow-y-auto">
          {successMessage && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center gap-2.5 animate-fadeIn">
              <Check className="h-5 w-5 text-emerald-600 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Current Entitlement Banner */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/80 text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-600" />
              <span className="font-semibold text-neutral-700">
                Current Plan:{" "}
                <span className="text-neutral-900 font-bold">
                  {isPro ? "Pro Educator (Unlimited)" : "Free Trial"}
                </span>
              </span>
            </div>
            <span className="font-semibold text-neutral-500">
              {isPro ? "Unlimited Sessions" : `${credits} Session Credit${credits === 1 ? "" : "s"} Remaining`}
            </span>
          </div>

          {/* Plan Options */}
          <div className="grid gap-3.5 sm:grid-cols-3">
            {plans.map((plan) => {
              const isSelected = selectedPlanId === plan.id;
              return (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`relative p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? "border-blue-600 bg-blue-50/40 shadow-md ring-2 ring-blue-500/20"
                      : "border-neutral-200 hover:border-neutral-300 bg-white"
                  }`}
                >
                  {plan.badge && (
                    <span className="absolute -top-3 left-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                      {plan.badge}
                    </span>
                  )}
                  <div>
                    <h3 className="font-bold text-sm text-neutral-900">{plan.name}</h3>
                    <div className="mt-2">
                      <span className="text-2xl font-black text-neutral-900">{plan.price}</span>
                      <span className="text-[11px] text-neutral-500 block leading-tight mt-0.5">{plan.period}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-blue-600">
                      {isSelected ? "Selected" : "Select"}
                    </span>
                    <div
                      className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                        isSelected ? "border-blue-600 bg-blue-600 text-white" : "border-neutral-300"
                      }`}
                    >
                      {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Feature Checklist */}
          <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200/70">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">
              Included with Pro Educator
            </h4>
            <div className="grid gap-2 sm:grid-cols-2 text-xs text-neutral-700">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>Full 6-Min Lectures with 80 Visual Slides</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>Ultra-Realistic Camb AI Voice Synthesis</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>Real-Time Multi-Student CV Proctoring</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>Sub-Second NVIDIA NIM LLM Inference</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>Student Interactive Doubt-Chat</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>Class Attendance & Focus CSV Export</span>
              </div>
            </div>
          </div>

          {/* Action CTA */}
          <div className="space-y-3">
            <button
              onClick={handlePurchase}
              disabled={isProcessing}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:opacity-95 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Processing with RevenueCat...</span>
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4" />
                  <span>
                    {selectedPlanId === "ai_class_credits_5"
                      ? "Purchase 5 Credits ($1.99)"
                      : "Upgrade to Pro Educator"}
                  </span>
                </>
              )}
            </button>

            {/* Footer Trust & Restore */}
            <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-neutral-500" />
                <span>Secure in-app purchase powered by RevenueCat SDK</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleRestore}
                  disabled={isProcessing}
                  className="hover:text-neutral-700 underline cursor-pointer"
                >
                  Restore Purchases
                </button>
                <button
                  onClick={resetDemo}
                  title="Reset entitlements to test purchase flow again"
                  className="hover:text-red-600 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset Demo
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
