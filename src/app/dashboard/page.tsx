import { createClient } from "@/lib/supabase-server"
import { redirect } from "next/navigation"
import { BusinessDashboard } from "@/components/dashboard/BusinessDashboard"
import { FreelancerDashboard } from "@/components/dashboard/FreelancerDashboard"

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <h2 className="text-2xl font-bold">Profile Incomplete</h2>
        <p className="text-muted-foreground mt-2">Please wait for your account to be initialized.</p>
      </div>
    )
  }

  if (profile.role === 'business') return <BusinessDashboard initialOrgName={profile.organization_name} />
  if (profile.role === 'freelancer') return <FreelancerDashboard />

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh]">
      <h2 className="text-2xl font-bold">Role Not Found</h2>
      <p className="text-muted-foreground mt-2">Could not determine your account role.</p>
    </div>
  )
}
