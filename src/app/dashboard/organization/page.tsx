import { createClient } from "@/lib/supabase-server"
import { OrganizationClient } from "@/components/dashboard/OrganizationClient"
import { redirect } from "next/navigation"

export default async function OrganizationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_name, country, default_currency, organization_type')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <OrganizationClient 
      initialOrgName={profile?.organization_name} 
      initialCountry={profile?.country}
      initialCurrency={profile?.default_currency}
      initialOrgType={profile?.organization_type}
    />
  )
}
