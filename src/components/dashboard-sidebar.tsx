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
  ChevronDown,
} from "lucide-react"
import { subscribeToAuthChanges, signOutUser, User } from "@/lib/auth-service"

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
      <div className="space-y-8">
        {/* Logo — preserved as-is */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 border-l-2 border-purple-500/40 pl-3 drop-shadow-[0_0_8px_rgba(147,51,234,0.3)] hover:border-purple-500/70 transition-all"
        >
          <Image src="/logo.png" alt="Class AI" width={32} height={32} />
          <span className="text-lg font-bold tracking-tight text-white">
            Class<span className="text-purple-400">AI</span>
          </span>
        </Link>

        {/* Navigation */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = item.label === activeItem
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => isMobile && onCloseMobile?.()}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-white/[0.08] text-white"
                    : "text-white/45 hover:bg-white/[0.03] hover:text-white/70"
                }`}
              >
                <item.icon
                  className={`h-[18px] w-[18px] ${
                    isActive ? "text-white/80" : "text-white/35"
                  }`}
                />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* User Profile + System Status */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 group">
          {user?.photoURL ? (
            <Image
              src={user.photoURL}
              alt={teacherName}
              width={38}
              height={38}
              className="rounded-full border border-white/10"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-purple-600/15 border border-purple-500/15 flex items-center justify-center text-sm font-bold text-purple-300 flex-shrink-0">
              {avatarFallback}
            </div>
          )}
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-semibold text-white truncate">{teacherName}</p>
            <p className="text-[11px] text-white/30 truncate">{teacherEmail}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="p-1.5 rounded-lg hover:bg-white/5 text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
            title="Sign Out"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 px-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
          <span className="text-[11px] text-white/30 font-medium">All systems operational</span>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="fixed top-0 bottom-0 left-0 z-30 hidden w-64 bg-[#0A0A0A] border-r border-white/[0.04] p-6 lg:flex flex-col justify-between">
        {sidebarContent(false)}
      </aside>

      {/* Mobile Sidebar */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <aside className="relative flex flex-col justify-between w-64 bg-[#0A0A0A] border-r border-white/[0.04] p-6 h-full z-10 animate-slideRight">
            <button
              onClick={onCloseMobile}
              className="absolute top-4 right-4 text-white/40 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="h-full flex flex-col justify-between mt-4">
              {sidebarContent(true)}
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
