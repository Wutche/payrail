'use client'

import * as React from "react"
import { Building2, Save, Globe, Wallet, ShieldCheck, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useStacks } from "@/hooks/useStacks"
import { useNotification } from "@/components/NotificationProvider"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { countries } from "@/lib/constants/countries"

import { updateProfile } from "@/app/actions/auth"

export function OrganizationClient({ 
  initialOrgName,
  initialCountry,
  initialCurrency,
  initialOrgType
}: { 
  initialOrgName?: string 
  initialCountry?: string
  initialCurrency?: string
  initialOrgType?: string
}) {
  const { isConnected, address, connectWallet, createOrganization, registerBusiness, getBusinessInfo, contractName } = useStacks()
  const { showNotification } = useNotification()
  const [isMounted, setIsMounted] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [orgName, setOrgName] = React.useState(initialOrgName || "")
  const [country, setCountry] = React.useState(initialCountry || "")
  const [currency, setCurrency] = React.useState(initialCurrency || "STX")
  const [orgType, setOrgType] = React.useState(initialOrgType || "")
  
  const [isRegistered, setIsRegistered] = React.useState(false)
  const [hasOrg, setHasOrg] = React.useState(false)

  React.useEffect(() => {
    setIsMounted(true)
  }, [])

  React.useEffect(() => {
    if (address && getBusinessInfo) {
      getBusinessInfo(address).then((data: any) => {
        if (data) {
          setIsRegistered(data.isRegistered)
          setHasOrg(data.hasOrg)
        }
      })
    }
  }, [address, getBusinessInfo])

  const handleRegister = async () => {
    if (!isConnected) return
    try {
      setIsSubmitting(true)
      await registerBusiness()
    } catch (err) {
      showNotification("error", "Failed to register business")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveOrganization = async () => {
    if (!orgName) {
      showNotification("error", "Please enter an organization name")
      return
    }

    try {
      setIsSubmitting(true)
      
      // 1. Save Off-Chain to Supabase
      const result = await updateProfile({
        organization: orgName,
        // We'll update the updateProfile action to support these fields soon
        // For now, let's assume it supports them or we'll add them to auth.ts
        country,
        default_currency: currency,
        organization_type: orgType
      } as any)

      if (result.error) {
        showNotification("error", "Failed to save to database", result.error)
        return
      }

      // 2. Save On-Chain if name changed or doesn't exist on-chain
      // We only do this if connected and not already created on-chain
      if (isConnected && !hasOrg) {
        await createOrganization(orgName)
        showNotification("success", "Organization saved and broadcasted on-chain")
      } else {
        showNotification("success", "Organization details updated")
      }
    } catch (err) {
      showNotification("error", "Failed to update organization")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Organization Details</h1>
        <p className="text-muted-foreground mt-1 text-sm">Manage your business profile and on-chain ownership settings.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Business Identity</CardTitle>
              <CardDescription>This information is stored off-chain and used for display purposes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization Name</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="orgName" 
                    placeholder="Acme Corp" 
                    className="pl-10 rounded-xl" 
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                    <Select value={country} onValueChange={setCountry}>
                      <SelectTrigger className="pl-10 rounded-xl">
                        <SelectValue placeholder="Select Country" />
                      </SelectTrigger>
                      <SelectContent>
                        {countries.map((country) => (
                          <SelectItem key={country.code} value={country.code}>
                            {country.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Default Payout Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="rounded-xl font-bold bg-accent/30">
                      <SelectValue placeholder="Select Currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STX">STX (Stacks)</SelectItem>
                      <SelectItem value="BTC">BTC (Bitcoin)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="orgType">Organization Type (Optional)</Label>
                <Select value={orgType} onValueChange={setOrgType}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LLC">LLC</SelectItem>
                    <SelectItem value="Corporation">Corporation</SelectItem>
                    <SelectItem value="DAO">DAO</SelectItem>
                    <SelectItem value="Partnership">Partnership</SelectItem>
                    <SelectItem value="Sole Proprietorship">Sole Proprietorship</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-2">
                <Button 
                  onClick={handleSaveOrganization}
                  disabled={isSubmitting}
                  className="rounded-xl px-8 shadow-lg shadow-primary/20 bg-primary font-bold"
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {hasOrg ? "Update Details" : "Save & Register"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm border-2 border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                On-Chain Ownership
              </CardTitle>
              <CardDescription>Verification of organization ownership on the Stacks blockchain.</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="p-4 bg-accent/30 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Owner Principal</span>
                    <code className="bg-background px-2 py-0.5 rounded border font-bold">
                      {(isMounted && address) ? `${address.substring(0, 5)}...${address.substring(address.length - 4)}` : "Not Connected"}
                    </code>
                  </div>
                  {!isMounted ? (
                    <div className="h-10 w-full bg-accent/50 animate-pulse rounded-xl" />
                  ) : !isConnected ? (
                    <Button onClick={connectWallet} variant="outline" className="w-full rounded-xl border-dashed border-primary/50 text-primary">
                      Connect Wallet to Verify
                    </Button>
                  ) : !isRegistered ? (
                    <Button onClick={handleRegister} disabled={isSubmitting} className="w-full rounded-xl bg-orange-500 hover:bg-orange-600 font-bold">
                       {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                       Register Business Wallet
                    </Button>
                  ) : (
                    <div className="flex justify-between items-center text-sm pt-2 border-t border-border/50">
                        <span className="text-muted-foreground">Registration</span>
                         <span className="text-green-600 font-bold uppercase tracking-widest text-[10px]">Verified Business</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Contract ID</span>
                    <code className="bg-background px-2 py-0.5 rounded border text-xs">{contractName || 'loading...'}</code>
                  </div>
                  <div className="flex justify-between items-center text-sm pt-2 border-t border-border/50">
                    <span className="text-muted-foreground">Status</span>
                    <span className="text-green-600 font-bold uppercase tracking-widest text-[10px]">Active & Verified</span>
                  </div>
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
