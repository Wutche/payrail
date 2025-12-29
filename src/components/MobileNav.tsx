'use client'

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  LayoutDashboard, 
  Users, 
  Send, 
  History, 
  Wallet,
  Settings,
  MoreHorizontal,
  Building2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { useAuth } from "@/hooks/useAuth"

interface NavItem {
  name: string
  href: string
  icon: React.ElementType
  isProfile?: boolean
}

export function MobileNav() {
  const pathname = usePathname()
  const { role } = useAuth()

  const businessLinks: NavItem[] = [
    { name: 'Home', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Recipients', href: '/dashboard/recipients', icon: Users },
    { name: 'Pay', href: '/dashboard/payroll/create', icon: Send },
    { name: 'History', href: '/dashboard/history', icon: History },
    { name: 'Profile', href: '/dashboard/profile', icon: Settings, isProfile: true },
  ]

  const freelancerLinks: NavItem[] = [
    { name: 'Home', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Wallet', href: '/dashboard/payments', icon: Wallet },
    { name: 'History', href: '/dashboard/history', icon: History },
    { name: 'Profile', href: '/dashboard/profile', icon: Settings, isProfile: true },
  ]

  const navItems = role === 'business' ? businessLinks : freelancerLinks

  // Only show on dashboard pages
  if (!pathname.startsWith('/dashboard')) return null

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-2 pointer-events-none">
      <nav className="mx-auto max-w-md bg-card/80 backdrop-blur-xl border border-primary/10 rounded-[2rem] shadow-2xl flex items-center justify-between p-2 pointer-events-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          
          return (
            <Link 
              key={item.name} 
              href={item.href}
              className="flex-1 relative group"
            >
              <div className={cn(
                "flex flex-col items-center gap-1 py-2 px-1 transition-all duration-300 rounded-2xl",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-primary/5"
              )}>
                <AnimatePresence>
                  {isActive && (
                    <motion.div 
                      layoutId="activeNav"
                      className="absolute inset-0 bg-primary/10 rounded-2xl z-0"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </AnimatePresence>

                {item.isProfile ? (
                  <div className="relative z-10">
                    <div className={cn(
                      "h-6 w-6 rounded-full border-2 transition-transform duration-300 overflow-hidden bg-accent",
                      isActive ? "border-primary scale-110 shadow-lg shadow-primary/20" : "border-transparent"
                    )}>
                      {/* Cool Avatar Placeholder - 3D stylised avatar */}
                      <img 
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${role === 'business' ? 'Felix' : 'Scooter'}&backgroundColor=b6e3f4,c0aede,d1d4f9`} 
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                ) : (
                  <item.icon className={cn(
                    "h-5 w-5 relative z-10 transition-transform duration-300",
                    isActive && "scale-110"
                  )} />
                )}
                
                <span className="text-[10px] font-bold tracking-tight relative z-10">
                  {item.name}
                </span>
              </div>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
