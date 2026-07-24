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
  onToggleCollapse?: () => void
}

export default function DashboardSidebar({
  activeItem,
  isMobileOpen = false,
  onCloseMobile,
  isCollapsed = false,
  onToggleCollapse,
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

  const hamburgerButton = (
    <button
      onClick={onToggleCollapse}
      className="w-10 h-10 rounded-xl border border-neutral-200/80 hover:bg-neutral-50 flex flex-col justify-center items-center gap-1 transition-colors cursor-pointer flex-shrink-0 shadow-sm"
      title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
    >
      <span className="w-5 h-[2px] bg-neutral-600 rounded-full transition-transform duration-300" />
      <span className="w-5 h-[2px] bg-neutral-600 rounded-full transition-transform duration-300" />
      <span className="w-5 h-[2px] bg-neutral-600 rounded-full transition-transform duration-300" />
    </button>
  )

  const sidebarContent = (isMobile: boolean = false, isDesktopCollapsed: boolean = false) => (
    <>
      <div className="space-y-8 flex flex-col w-full">
        {/* Header Top: Logo & Toggle */}
        <div className={`flex items-center justify-between w-full ${isDesktopCollapsed ? "flex-col gap-4" : ""}`}>
          <Link
            href="/dashboard"
            className={`flex items-center border-l-2 border-purple-500/40 pl-3 drop-shadow-[0_0_8px_rgba(147,51,234,0.15)] hover:border-purple-500/70 transition-all ${
              isDesktopCollapsed ? "pl-0 border-l-0" : "gap-2.5"
            }`}
          >
            <Image src="/logo.png" alt="Class AI" width={32} height={32} />
            {!isDesktopCollapsed && (
              <span className="text-lg font-bold tracking-tight text-neutral-900 animate-fadeIn">
                Class<span className="text-purple-600">AI</span>
              </span>
            )}
          </Link>
          {!isMobile && hamburgerButton}
        </div>

        {/* Navigation */}
        <nav className="space-y-1.5 w-full">
          {navItems.map((item) => {
            const isActive = item.label === activeItem
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => isMobile && onCloseMobile?.()}
                title={isDesktopCollapsed ? item.label : undefined}
                style={{ height: "48px" }}
                className={`flex items-center transition-all duration-200 rounded-[14px] ${
                  isDesktopCollapsed
                    ? "justify-center p-2.5"
                    : "gap-3 px-4 py-3"
                } ${
                  isActive
                    ? "bg-[#EEF4FF] text-blue-700 font-semibold"
                    : "text-neutral-500 hover:bg-[#F5F7FA] hover:text-neutral-800"
                }`}
              >
                <item.icon
                  className={`h-5 w-5 flex-shrink-0 ${isActive ? "text-blue-600" : ""}`}
                />
                {!isDesktopCollapsed && (
                  <span className="text-sm font-medium animate-fadeIn">{item.label}</span>
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* User Profile + System Status */}
      <div className={`space-y-4 w-full ${isDesktopCollapsed ? "flex flex-col items-center" : ""}`}>
        <div className={`flex items-center group w-full ${isDesktopCollapsed ? "justify-center" : "gap-3"}`}>
          {user?.photoURL ? (
            <Image
              src={user.photoURL}
              alt={teacherName}
              width={38}
              height={38}
              className="rounded-full border border-neutral-200 flex-shrink-0"
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
            <span className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0 animate-pulse" />
            <span className="text-[11px] text-neutral-400 font-medium">All systems operational</span>
          </div>
        )}
      </div>
    </>
  )

  const collapsedStyles = {
    width: isCollapsed ? "64px" : "280px",
    background: "#FFFFFF",
    borderRight: "1px solid rgba(15, 23, 42, 0.08)",
    boxShadow: "0 12px 40px rgba(15, 23, 42, 0.08), 0 2px 8px rgba(15, 23, 42, 0.04)",
    borderRadius: "0 24px 24px 0",
    transition: "all .35s cubic-bezier(.22,1,.36,1)",
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        style={collapsedStyles}
        className="fixed top-0 bottom-0 left-0 z-30 hidden lg:flex flex-col justify-between p-4 overflow-hidden"
      >
        {sidebarContent(false, isCollapsed)}
      </aside>

      {/* Mobile Sidebar */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <aside className="relative flex flex-col justify-between w-[280px] bg-white border-r border-neutral-200/60 p-5 h-full z-10 animate-slideRight rounded-r-[24px]">
            <button
              onClick={onCloseMobile}
              className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-900 cursor-pointer p-1 rounded-lg hover:bg-neutral-50"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="h-full flex flex-col justify-between mt-8">
              {sidebarContent(true, false)}
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
