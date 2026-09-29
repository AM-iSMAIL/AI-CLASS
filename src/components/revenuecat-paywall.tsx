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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div
        className="relative w-full max-w-md sm:max-w-lg bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden text-neutral-900 animate-scaleUp max-h-[84vh] flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Glow with Status Bar Clearance */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 pt-5 sm:pt-6 pb-3 sm:pb-5 px-3.5 sm:px-6 text-white relative flex-shrink-0">
          <button
            onClick={closePaywall}
            className="absolute top-4 right-3.5 sm:right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-all cursor-pointer text-white"
            aria-label="Close paywall"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>

          <div className="flex items-center gap-1.5 mb-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-[9px] font-bold tracking-wider uppercase">
              <Zap className="h-2.5 w-2.5 text-amber-300" />
              Powered by RevenueCat
            </span>
            {isPro && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400 text-neutral-950 text-[9px] font-bold">
                <Crown className="h-2.5 w-2.5" />
                Active Pro
              </span>
            )}
          </div>

          <h2 className="text-base sm:text-xl font-bold tracking-tight">
            Supercharge Your AI Classroom
          </h2>
          <p className="text-[11px] sm:text-xs text-blue-100 mt-0.5 max-w-lg leading-snug">
            Unlock complete AI lectures with dynamic slides, ultra-realistic Camb AI voice synthesis, and multi-student proctoring.
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-3 sm:p-5 space-y-3 sm:space-y-4 overflow-y-auto flex-1">
          {successMessage && (
            <div className="p-2.5 sm:p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
              <Check className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Current Entitlement Banner */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 border border-neutral-200/80 text-[10px] sm:text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <Sparkles className="h-3 w-3 text-purple-600 flex-shrink-0" />
              <span className="font-semibold text-neutral-700 truncate">
                Current:{" "}
                <span className="text-neutral-900 font-bold">
                  {isPro ? "Pro (Unlimited)" : "Free Tier"}
                </span>
              </span>
            </div>
            <span className="font-semibold text-neutral-500 text-[10px] flex-shrink-0">
              {isPro ? "Unlimited" : `${credits} Credit${credits === 1 ? "" : "s"}`}
            </span>
          </div>

          {/* Plan Options */}
          <div className="grid gap-2 sm:gap-3 sm:grid-cols-3">
            {plans.map((plan) => {
              const isSelected = selectedPlanId === plan.id;
              return (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`relative p-2.5 sm:p-3.5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? "border-blue-600 bg-blue-50/40 shadow-xs ring-1 ring-blue-500/20"
                      : "border-neutral-200 hover:border-neutral-300 bg-white"
                  }`}
                >
                  {plan.badge && (
                    <span className="absolute -top-2 left-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-xs">
                      {plan.badge}
                    </span>
                  )}
                  <div>
                    <h3 className="font-bold text-xs text-neutral-900">{plan.name}</h3>
                    <div className="mt-1">
                      <span className="text-base sm:text-xl font-bold text-neutral-900">{plan.price}</span>
                      <span className="text-[9px] sm:text-[10px] text-neutral-500 block leading-tight mt-0.5">{plan.period}</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 sm:mt-4 sm:pt-3 border-t border-neutral-100 flex items-center justify-between">
                    <span className="text-[10px] sm:text-[11px] font-semibold text-blue-600">
                      {isSelected ? "Selected" : "Select"}
                    </span>
                    <div
                      className={`h-3.5 w-3.5 sm:h-4 sm:w-4 rounded-full border flex items-center justify-center ${
                        isSelected ? "border-blue-600 bg-blue-600 text-white" : "border-neutral-300"
                      }`}
                    >
                      {isSelected && <Check className="h-2 w-2 sm:h-2.5 sm:w-2.5 stroke-[3]" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Feature Checklist */}
          <div className="bg-neutral-50 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-neutral-200/70">
            <h4 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">
              Included with Pro Educator
            </h4>
            <div className="grid gap-1.5 sm:gap-2 sm:grid-cols-2 text-[11px] sm:text-xs text-neutral-700">
              <div className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                <span>Interactive AI Lectures with Dynamic Slides</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                <span>Ultra-Realistic Camb AI Voice Synthesis</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                <span>Real-Time Multi-Student CV Proctoring</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                <span>Sub-Second NVIDIA NIM LLM Inference</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                <span>Student Interactive Doubt-Chat</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                <span>Class Attendance & Focus CSV Export</span>
              </div>
            </div>
          </div>

          {/* Action CTA */}
          <div className="space-y-2">
            <button
              onClick={handlePurchase}
              disabled={isProcessing}
              className="w-full py-2.5 sm:py-3 px-4 sm:px-5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:opacity-95 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.99]"
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
            <div className="flex flex-col sm:flex-row items-center justify-between text-[10px] sm:text-[11px] text-neutral-400 gap-1.5 pt-0.5">
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
