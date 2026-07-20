"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { ShaderAnimation } from "@/components/ui/shader-lines"

export function LoadingScreen({ onComplete }: { onComplete?: () => void }) {
  const [progress, setProgress] = useState(0)
  const [isVisible, setIsVisible] = useState(true)
  const [shaderReady, setShaderReady] = useState(false)
  const [showLogo, setShowLogo] = useState(false)
  const [showTitle, setShowTitle] = useState(false)
  const [showSubtitle, setShowSubtitle] = useState(false)
  const [showProgress, setShowProgress] = useState(false)

  // Staggered reveal sequence
  useEffect(() => {
    // Wait a beat for shader to initialize, then start reveals
    const t1 = setTimeout(() => setShaderReady(true), 300)
    const t2 = setTimeout(() => setShowLogo(true), 600)
    const t3 = setTimeout(() => setShowTitle(true), 1200)
    const t4 = setTimeout(() => setShowSubtitle(true), 1700)
    const t5 = setTimeout(() => setShowProgress(true), 2100)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
      clearTimeout(t5)
    }
  }, [])

  // Progress bar animation — starts after all elements revealed
  useEffect(() => {
    if (!showProgress) return

    const duration = 2500
    const interval = 30
    const steps = duration / interval
    let currentStep = 0

    const timer = setInterval(() => {
      currentStep++
      const raw = currentStep / steps
      const eased = raw < 0.5
        ? 4 * raw * raw * raw
        : 1 - Math.pow(-2 * raw + 2, 3) / 2
      setProgress(Math.min(eased * 100, 100))

      if (currentStep >= steps) {
        clearInterval(timer)
        setTimeout(() => {
          setIsVisible(false)
          setTimeout(() => onComplete?.(), 500)
        }, 400)
      }
    }, interval)

    return () => clearInterval(timer)
  }, [showProgress, onComplete])

  if (!isVisible) return null

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-500 ${
        progress >= 100 ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Shader background — fades in */}
      <div
        className={`absolute inset-0 transition-opacity duration-1000 ${
          shaderReady ? "opacity-100" : "opacity-0"
        }`}
      >
        <ShaderAnimation />
      </div>

      {/* Overlay gradient for readability */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Logo — scales up + fades in with intense glow */}
        <div
          className={`relative transition-all duration-700 ease-out ${
            showLogo
              ? "opacity-100 translate-y-0 scale-100"
              : "opacity-0 translate-y-8 scale-75"
          }`}
        >
          {/* Outer glow pulse */}
          <div
            className={`absolute -inset-10 rounded-full bg-purple-500/15 blur-3xl transition-opacity duration-1000 animate-pulse-slow ${
              showLogo ? "opacity-100" : "opacity-0"
            }`}
          />
          {/* Inner glow */}
          <div
            className={`absolute -inset-6 rounded-full bg-purple-400/25 blur-2xl transition-opacity duration-1000 ${
              showLogo ? "opacity-100" : "opacity-0"
            }`}
          />
          {/* Tight glow */}
          <div
            className={`absolute -inset-2 rounded-full bg-violet-500/20 blur-xl transition-opacity duration-700 ${
              showLogo ? "opacity-100" : "opacity-0"
            }`}
          />
          <Image
            src="/logo.png"
            alt="Class AI Logo"
            width={200}
            height={200}
            className="relative drop-shadow-2xl brightness-110 contrast-110"
            style={{
              filter: "drop-shadow(0 0 20px rgba(139, 92, 246, 0.4)) drop-shadow(0 0 40px rgba(139, 92, 246, 0.2)) brightness(1.1) contrast(1.1)",
            }}
            priority
          />
        </div>

        {/* Title — slides up + fades in */}
        <div className="text-center overflow-hidden">
          <h1
            className={`text-4xl font-bold tracking-tight text-white md:text-5xl transition-all duration-700 ease-out ${
              showTitle
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-10"
            }`}
          >
            Class{" "}
            <span className="bg-gradient-to-r from-purple-400 to-violet-500 bg-clip-text text-transparent">
              AI
            </span>
          </h1>

          {/* Subtitle — fades in after title */}
          <p
            className={`mt-2 text-sm font-medium uppercase tracking-[0.3em] text-white/50 transition-all duration-700 ease-out delay-100 ${
              showSubtitle
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-6"
            }`}
          >
            AI-Powered Classroom
          </p>
        </div>

        {/* Progress bar — fades in last */}
        <div
          className={`w-64 overflow-hidden transition-all duration-500 ease-out ${
            showProgress
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4"
          }`}
        >
          <div className="h-[2px] w-full rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-violet-400 transition-all duration-100 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-3 text-center text-xs font-mono text-white/30">
            {progress < 30
              ? "Initializing systems..."
              : progress < 60
              ? "Loading AI modules..."
              : progress < 90
              ? "Preparing classroom..."
              : "Ready"}
          </p>
        </div>
      </div>
    </div>
  )
}
