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
  isCollapsed?: boolean
}

export default function DashboardSidebar({
  activeItem,
  isMobileOpen = false,
  onCloseMobile,
  isCollapsed = false,
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

  const sidebarContent = (isMobile: boolean = false, isDesktopCollapsed: boolean = false) => (
    <>
      <div className={isDesktopCollapsed ? "space-y-8 flex flex-col items-center w-full" : "space-y-8"}>
        {/* Logo — preserved as-is */}
        <Link
          href="/dashboard"
          className={`flex items-center border-l-2 border-purple-500/40 pl-3 drop-shadow-[0_0_8px_rgba(147,51,234,0.15)] hover:border-purple-500/70 transition-all ${
            isDesktopCollapsed ? "justify-center pl-0 border-l-0" : "gap-2.5"
          }`}
        >
          <Image src="/logo.png" alt="Class AI" width={32} height={32} />
          {!isDesktopCollapsed && (
            <span className="text-lg font-bold tracking-tight text-neutral-900 animate-fadeIn">
              Class<span className="text-purple-600">AI</span>
            </span>
          )}
        </Link>

        {/* Navigation */}
        <nav className="space-y-1 w-full">
          {navItems.map((item) => {
            const isActive = item.label === activeItem
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => isMobile && onCloseMobile?.()}
                title={isDesktopCollapsed ? item.label : undefined}
                className={`flex items-center transition-all ${
                  isDesktopCollapsed
                    ? "justify-center p-2.5 rounded-xl"
                    : "gap-3 px-4 py-2.5 rounded-xl"
                } ${
                  isActive
                    ? "bg-neutral-100 text-neutral-900 font-semibold"
                    : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800"
                }`}
              >
                <item.icon
                  className="h-[18px] w-[18px] flex-shrink-0"
                />
                {!isDesktopCollapsed && <span className="text-sm font-medium animate-fadeIn">{item.label}</span>}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* User Profile + System Status */}
      <div className={isDesktopCollapsed ? "space-y-4 w-full flex flex-col items-center" : "space-y-4"}>
        <div className={`flex items-center group ${isDesktopCollapsed ? "justify-center w-full" : "gap-3"}`}>
          {user?.photoURL ? (
            <Image
              src={user.photoURL}
              alt={teacherName}
              width={38}
              height={38}
              className="rounded-full border border-neutral-200"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-purple-600/10 border border-purple-500/10 flex items-center justify-center text-sm font-bold text-purple-600 flex-shrink-0">
              {avatarFallback}
            </div>
          )}
          {!isDesktopCollapsed && (
            <>
              <div className="flex-1 overflow-hidden animate-fadeIn">
                <p className="text-sm font-semibold text-neutral-800 truncate">{teacherName}</p>
                <p className="text-[11px] text-neutral-400 truncate">{teacherEmail}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                title="Sign Out"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        {!isDesktopCollapsed && (
          <div className="flex items-center gap-2 px-1 animate-fadeIn">
            <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
            <span className="text-[11px] text-neutral-400 font-medium">All systems operational</span>
          </div>
        )}
      </div>
    </>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={`fixed top-0 bottom-0 left-0 z-30 hidden bg-white border-r border-neutral-200/60 transition-all duration-300 lg:flex flex-col justify-between ${
        isCollapsed ? "w-20 p-4 items-center" : "w-64 p-6"
      }`}>
        {sidebarContent(false, isCollapsed)}
      </aside>

      {/* Mobile Sidebar */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <aside className="relative flex flex-col justify-between w-64 bg-white border-r border-neutral-200/60 p-6 h-full z-10 animate-slideRight">
            <button
              onClick={onCloseMobile}
              className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-900 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="h-full flex flex-col justify-between mt-4">
              {sidebarContent(true, false)}
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
