"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  LayoutDashboard,
  Play,
  BarChart3,
  Users,
  Settings,
  LogOut,
  X,
  Sparkles,
  Crown,
  Zap,
} from "lucide-react"
import { subscribeToAuthChanges, signOutUser, User } from "@/lib/auth-service"
import { useRevenueCat } from "@/lib/revenuecat/use-revenuecat"

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Sessions", icon: Play, href: "/dashboard?tab=sessions" },
  { label: "Analytics", icon: BarChart3, href: "/dashboard?tab=analytics" },
  { label: "Students", icon: Users, href: "/dashboard?tab=students" },
  { label: "Settings", icon: Settings, href: "/dashboard?tab=settings" },
]

interface DashboardSidebarProps {
  activeItem: string
  isMobileOpen?: boolean
  onCloseMobile?: () => void
}

export default function DashboardSidebar({
  activeItem,
  isMobileOpen = false,
  onCloseMobile,
}: DashboardSidebarProps) {
  const [user, setUser] = useState<User | null>(null)
  const { isPro, credits, openPaywall } = useRevenueCat()

  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((currentUser) => {
      setUser(currentUser)
    })
    return () => unsubscribe()
  }, [])

  const handleSignOut = async () => {
    try {
      await signOutUser()
      window.location.href = "/auth"
    } catch (error) {
      console.error("Sign out failed", error)
    }
  }

  const teacherName = user?.displayName || "Dr. Sarah Jenkins"
  const teacherEmail = user?.email || "sarah.j@school.edu"
  const avatarFallback = teacherName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const sidebarContent = (isMobile: boolean = false) => (
    <>
      <div className="flex flex-col items-start gap-6 sm:gap-8 w-full">
        {/* Logo */}
        <Link
          href="/dashboard"
          className="flex items-center w-full px-1 gap-2.5 drop-shadow-[0_0_8px_rgba(147,51,234,0.15)] hover:opacity-85 transition-all overflow-hidden"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center flex-shrink-0">
            <Image src="/logo.png" alt="Class AI" width={32} height={32} />
          </div>
          <span className={`text-base sm:text-lg font-bold tracking-tight text-neutral-900 ${!isMobile ? "sidebar-label" : ""}`}>
            Class<span className="text-purple-600">AI</span>
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex flex-col items-start gap-2 sm:gap-[14px] w-full">
          {navItems.map((item) => {
            const isActive = item.label === activeItem
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => isMobile && onCloseMobile?.()}
                title={item.label}
                className={
                  isMobile
                    ? `flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl transition-all ${
                        isActive
                          ? "bg-blue-50 text-blue-600 font-bold border border-blue-200/80 shadow-xs"
                          : "text-neutral-700 hover:bg-neutral-100 font-medium"
                      }`
                    : `nav-item ${isActive ? "active" : ""}`
                }
              >
                <item.icon className={`h-5 w-5 flex-shrink-0 ${isActive && isMobile ? "text-blue-600" : ""}`} />
                <span className={`text-xs sm:text-sm font-semibold whitespace-nowrap ${!isMobile ? "sidebar-label" : "text-neutral-900"}`}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>
      </div>

      {/* RevenueCat Plan Card */}
      <div className="w-full px-0.5 my-2">
        {isPro ? (
          <div
            onClick={openPaywall}
            className={`w-full p-3 rounded-2xl bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-indigo-500/10 border border-amber-300/40 cursor-pointer hover:border-amber-400 transition-all text-left ${
              !isMobile ? "sidebar-label" : ""
            }`}
          >
            <div className="flex items-center gap-1.5 text-amber-700 font-bold text-xs">
              <Crown className="h-3.5 w-3.5" />
              <span>Pro Educator</span>
            </div>
            <p className="text-[10px] text-neutral-500 mt-0.5">Unlimited AI Classrooms</p>
          </div>
        ) : (
          <div className={`w-full p-3 rounded-2xl bg-gradient-to-br from-neutral-50 to-neutral-100 border border-neutral-200/80 text-left ${
            !isMobile ? "sidebar-label" : ""
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Free Tier</span>
              <span className="text-[10px] font-semibold text-neutral-600">{credits} credit{credits === 1 ? "" : "s"}</span>
            </div>
            <button
              onClick={openPaywall}
              className="mt-2.5 w-full py-1.5 px-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm hover:opacity-95 transition-all cursor-pointer"
            >
              <Sparkles className="h-3 w-3" />
              <span>Upgrade</span>
            </button>
          </div>
        )}
      </div>

      {/* User Profile + Sign Out */}
      <div className="flex flex-col items-start gap-3 sm:gap-4 w-full border-t border-neutral-100 pt-3">
        <div className="flex items-center w-full overflow-hidden gap-2.5 px-0.5">
          {user?.photoURL ? (
            <Image
              src={user.photoURL}
              alt={teacherName}
              width={36}
              height={36}
              className="rounded-full border border-neutral-200 flex-shrink-0"
            />
          ) : (
            <div className="h-9 w-9 rounded-full bg-purple-600/10 border border-purple-500/10 flex items-center justify-center text-xs font-bold text-purple-600 flex-shrink-0">
              {avatarFallback}
            </div>
          )}
          <div className={`flex-1 overflow-hidden min-w-0 ${!isMobile ? "sidebar-label" : ""}`}>
            <p className="text-xs font-bold text-neutral-900 truncate">{teacherName}</p>
            <p className="text-[10px] text-neutral-500 truncate">{teacherEmail}</p>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className={
            isMobile
              ? "flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-red-600 hover:bg-red-50 text-xs font-bold transition-colors cursor-pointer"
              : "nav-item hover:text-red-500"
          }
          title="Sign Out"
        >
          <LogOut className="h-4.5 w-4.5 flex-shrink-0" />
          <span className={`text-xs font-bold whitespace-nowrap ${!isMobile ? "sidebar-label" : ""}`}>
            Sign Out
          </span>
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="sidebar-container fixed top-0 bottom-0 left-0 hidden lg:flex flex-col justify-between items-center py-6 px-3">
        {sidebarContent(false)}
      </aside>

      {/* Mobile Sidebar */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <aside className="relative flex flex-col justify-between items-start w-[270px] bg-white border-r border-neutral-200/80 pt-10 pb-6 px-4 h-full z-10 animate-slideRight overflow-y-auto shadow-2xl">
            <button
              onClick={onCloseMobile}
              className="absolute top-8 right-4 text-neutral-400 hover:text-neutral-900 cursor-pointer p-1.5 rounded-lg hover:bg-neutral-100"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="h-full flex flex-col justify-between items-start w-full">
              {sidebarContent(true)}
            </div>
          </aside>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-neutral-200/80 px-2 py-1.5 flex lg:hidden items-center justify-around shadow-[0_-4px_16px_rgba(0,0,0,0.04)] pb-[calc(env(safe-area-inset-bottom,0px)+6px)]">
        {navItems.map((item) => {
          const isActive = item.label === activeItem
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
                isActive
                  ? "text-purple-600 font-bold"
                  : "text-neutral-500 hover:text-neutral-800 font-medium"
              }`}
            >
              <item.icon className={`h-5 w-5 ${isActive ? "text-purple-600 scale-105" : "text-neutral-500"}`} />
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
