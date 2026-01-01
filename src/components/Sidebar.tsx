'use client'

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { 
  LayoutDashboard, 
  Users, 
  Send, 
  History, 
  Settings, 
  Wallet,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ExternalLink,
  UserCircle,
  Loader2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { logout } from "@/app/actions/auth"

interface SidebarItem {
  name: string
  href: string
  icon: React.ElementType
}

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = React.useState(false)
  const [isSigningOut, setIsSigningOut] = React.useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { role, signOut } = useAuth()

  const handleSignOut = async () => {
    setIsSigningOut(true)
    await logout()
    await signOut()
    router.push('/login')
  }

  const businessLinks: SidebarItem[] = [
    { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Organization', href: '/dashboard/organization', icon: Building2 },
    { name: 'Payroll', href: '/dashboard/payroll', icon: Send },
    { name: 'Recipients', href: '/dashboard/recipients', icon: Users },
    { name: 'History', href: '/dashboard/history', icon: History },
  ]

  const freelancerLinks: SidebarItem[] = [
    { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Payments', href: '/dashboard/payments', icon: Wallet },
    { name: 'History', href: '/dashboard/history', icon: History },
  ]

  const settingsLinks: SidebarItem[] = [
    { name: 'Wallet', href: '/dashboard/wallet', icon: Wallet },
    { name: 'Profile', href: '/dashboard/profile', icon: UserCircle },
  ]

  const links = role === 'business' ? businessLinks : freelancerLinks

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 bottom-0 z-40 hidden md:flex flex-col border-r bg-card transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Branding Area */}
      <div className={cn("p-6 flex items-center gap-3", isCollapsed && "px-4")}>
        <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20 shrink-0">
          <Wallet className="h-5 w-5 text-primary-foreground" />
        </div>
        {!isCollapsed && (
          <span className="text-xl font-black tracking-tight italic text-primary">Payrail</span>
        )}
      </div>
      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-4 h-6 w-6 rounded-full border bg-background shadow-sm z-50 md:flex hidden"
      >
        {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </Button>

      <div className="flex flex-col flex-1 gap-8 p-4">
        {/* Main Nav */}
        <div className="space-y-1">
          <p className={cn("text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-4 px-2", isCollapsed && "hidden")}>
            Menu
          </p>
          {links.map((item) => {
            // Special handling for Payroll to match sub-routes
            const isActive = item.href === '/dashboard/payroll' 
              ? pathname.startsWith('/dashboard/payroll')
              : pathname === item.href
            
            return (
            <Link key={item.name} href={item.href}>
              <div className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-xl transition-all group",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}>
                <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-primary" : "group-hover:text-foreground")} />
                {!isCollapsed && <span className="text-sm font-medium">{item.name}</span>}
              </div>
            </Link>
          )})}
        </div>

        {/* Settings Nav */}
        <div className="space-y-1">
          <p className={cn("text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-4 px-2", isCollapsed && "hidden")}>
            Settings
          </p>
          {settingsLinks.map((item) => {
            const isActive = pathname === item.href
            const isProfile = item.name === 'Profile'
            
            return (
              <Link key={item.name} href={item.href}>
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-xl transition-all group",
                  isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}>
                  {isProfile ? (
                    <div className={cn(
                      "h-5 w-5 rounded-full border-2 transition-transform duration-300 overflow-hidden bg-accent shrink-0",
                      isActive ? "border-primary scale-110" : "border-transparent group-hover:border-foreground/20"
                    )}>
                      <img 
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${role === 'business' ? 'Felix' : 'Scooter'}&backgroundColor=b6e3f4,c0aede,d1d4f9`} 
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-primary" : "group-hover:text-foreground")} />
                  )}
                  {!isCollapsed && <span className="text-sm font-medium">{item.name}</span>}
                </div>
              </Link>
            )
          })}
        </div>

        {/* Sign Out */}
        <div className="mt-auto pt-4 border-t">
          <Button 
            variant="ghost" 
            className={cn("w-full justify-start gap-3 px-3 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20", isCollapsed && "justify-center px-0")}
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            {isSigningOut ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
            ) : (
              <LogOut className="h-5 w-5 shrink-0" />
            )}
            {!isCollapsed && <span className="text-sm font-medium">{isSigningOut ? "Signing out..." : "Sign Out"}</span>}
          </Button>
        </div>
      </div>
    </aside>
  )
}
