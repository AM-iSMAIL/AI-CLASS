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
      <div className="flex flex-col items-start gap-8 w-full">
        {/* Logo */}
        <Link
          href="/dashboard"
          className="flex items-center w-full px-1 gap-2 drop-shadow-[0_0_8px_rgba(147,51,234,0.15)] hover:opacity-85 transition-all overflow-hidden"
        >
          <div className="w-10.5 h-10.5 flex items-center justify-center flex-shrink-0">
            <Image src="/logo.png" alt="Class AI" width={32} height={32} />
          </div>
          <span className="sidebar-label text-lg font-bold tracking-tight text-neutral-900">
            Class<span className="text-purple-600">AI</span>
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex flex-col items-start gap-[14px] w-full">
          {navItems.map((item) => {
            const isActive = item.label === activeItem
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => isMobile && onCloseMobile?.()}
                title={item.label}
                className={`sidebar-btn ${isActive ? "active" : ""}`}
              >
                <div className="w-10.5 h-12 flex items-center justify-center flex-shrink-0">
                  <item.icon className="h-[22px] w-[22px] flex-shrink-0" />
                </div>
                <span className="sidebar-label text-sm font-medium whitespace-nowrap ml-1.5">
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>
      </div>

      {/* User Profile + Sign Out */}
      <div className="flex flex-col items-start gap-4 w-full">
        <div className="flex items-center w-full overflow-hidden gap-2 px-1">
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
          <div className="sidebar-label flex-1 overflow-hidden">
            <p className="text-sm font-semibold text-neutral-800 truncate">{teacherName}</p>
            <p className="text-[11px] text-neutral-400 truncate">{teacherEmail}</p>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="sidebar-btn hover:text-red-500"
          title="Sign Out"
        >
          <div className="w-10.5 h-12 flex items-center justify-center flex-shrink-0">
            <LogOut className="h-[22px] w-[22px]" />
          </div>
          <span className="sidebar-label text-sm font-medium whitespace-nowrap ml-1.5">
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
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <aside className="relative flex flex-col justify-between items-center w-[280px] bg-white border-r border-neutral-200/60 py-6 px-3 h-full z-10 animate-slideRight">
            <button
              onClick={onCloseMobile}
              className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-900 cursor-pointer p-1 rounded-lg hover:bg-neutral-50"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="h-full flex flex-col justify-between mt-8 items-center w-full">
              {sidebarContent(true)}
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
