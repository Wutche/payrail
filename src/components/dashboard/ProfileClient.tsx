'use client'

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { User, Mail, Building2, Bell, Shield, Loader2, AlertTriangle } from "lucide-react"
import { deleteAccount, updateProfile } from "@/app/actions/auth"
import { Modal } from "@/components/dashboard/ActionModals"
import { useNotification } from "@/components/NotificationProvider"
import { useRouter } from "next/navigation"
import { logout } from "@/app/actions/auth"
import { useAuth } from "@/hooks/useAuth"
import { LogOut } from "lucide-react"

export function ProfileClient({ 
  initialUser, 
  initialRole 
}: { 
  initialUser: any, 
  initialRole: string | null 
}) {
  const { showNotification } = useNotification()
  const router = useRouter()
  const { signOut } = useAuth()
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [showConfirmDelete, setShowConfirmDelete] = React.useState(false)
  const [isUpdating, setIsUpdating] = React.useState(false)
  const [formData, setFormData] = React.useState({
    full_name: initialUser?.user_metadata?.full_name || "",
    organization: initialUser?.user_metadata?.organization || ""
  })

  const handleUpdateProfile = async () => {
    setIsUpdating(true)
    try {
      const result = await updateProfile(formData)
      if (result.error) {
        showNotification("error", "Update Failed", result.error)
      } else {
        showNotification("success", "Profile Updated", "Your changes have been saved successfully.")
        router.refresh()
      }
    } catch (err) {
      showNotification("error", "Error", "An unexpected error occurred.")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleSignOut = async () => {
    await logout()
    await signOut()
    router.push('/login')
  }

  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    try {
      const result = await deleteAccount()
      if (result?.error) {
        showNotification("error", "Deletion Failed", result.error)
        setIsDeleting(false)
      } else if (result?.success) {
        showNotification("success", "Account Deleted", "Your account has been permanently removed.")
        setTimeout(() => {
          router.push('/')
        }, 1500)
      }
    } catch (err) {
      showNotification("error", "Connection Error", "An error occurred. Please try again.")
      setIsDeleting(false)
    } finally {
      setShowConfirmDelete(false)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account information and preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Update your basic account details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="fullname">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="fullname" 
                      placeholder="John Doe" 
                      className="pl-10 rounded-xl"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="email" placeholder={initialUser?.email || "name@example.com"} disabled className="pl-10 rounded-xl bg-accent/30" />
                  </div>
                </div>
              </div>
              {initialRole === 'business' && (
                <div className="space-y-2">
                  <Label htmlFor="org">Organization Name</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="org" 
                      placeholder="Acme Corp" 
                      className="pl-10 rounded-xl bg-accent/30"
                      value={formData.organization}
                      disabled
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Organization name can be changed in the Organization settings.</p>
                </div>
              )}
              <div className="pt-2">
                <Button 
                  className="rounded-xl px-8 shadow-lg shadow-primary/20"
                  onClick={handleUpdateProfile}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>


        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-sm bg-accent/20">
            <CardHeader>
              <CardTitle className="text-lg">Account Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="flex justify-between items-center py-2 border-b border-border/50 text-sm">
                <span className="text-muted-foreground">Role</span>
                <span className="font-bold capitalize text-primary">{initialRole || 'User'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50 text-sm">
                <span className="text-muted-foreground">Account Status</span>
                <span className="text-green-600 font-bold uppercase tracking-widest text-[10px]">Active</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50 text-sm">
                <span className="text-muted-foreground">Verification</span>
                <span className="text-green-600 font-bold uppercase tracking-widest text-[10px]">Verified</span>
              </div>
            </CardContent>
          </Card>
          
          <div className="md:hidden pt-4 border-t border-border/50">
            <Button 
              variant="destructive" 
              className="w-full h-12 rounded-2xl text-base font-bold shadow-xl shadow-red-500/10 flex items-center justify-center gap-2"
              onClick={handleSignOut}
            >
              <LogOut className="h-5 w-5" />
              Sign Out
            </Button>
            <p className="text-[10px] text-muted-foreground text-center mt-4 px-6 leading-relaxed">
              If you wish to remove your account permanently, use the button below. This action cannot be undone.
            </p>
          </div>
          
          <Button 
            variant="ghost" 
            className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs py-6 mt-4"
            onClick={() => setShowConfirmDelete(true)}
            disabled={isDeleting}
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Delete Account
          </Button>
        </div>
      </div>

      <Modal 
        isOpen={showConfirmDelete} 
        onClose={() => !isDeleting && setShowConfirmDelete(false)} 
        title="Delete your account?" 
        description="This action is permanent and cannot be undone."
      >
        <div className="space-y-6">
          <div className="flex flex-col items-center text-center space-y-4 pt-4">
            <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center text-red-600 animate-bounce">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed px-4">
              All your data, organization history, and pending payments will be <span className="text-red-500 font-bold">permanently deleted</span>.
            </p>
          </div>
          
          <div className="flex flex-col gap-3">
            <Button 
              variant="destructive" 
              className="w-full h-12 rounded-2xl text-base font-bold shadow-xl shadow-red-500/20"
              onClick={handleDeleteAccount}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wiping Account...
                </>
              ) : (
                "Yes, delete everything"
              )}
            </Button>
            <Button 
              variant="ghost" 
              className="w-full h-12 rounded-2xl text-sm font-medium"
              onClick={() => setShowConfirmDelete(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
