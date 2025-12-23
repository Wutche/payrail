'use client'

import { useAuth } from '@/hooks/useAuth'

export default function DashboardPage() {
  const { role, user, loading } = useAuth()

  if (loading) return <div className="p-8">Loading dashboard...</div>

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4 capitalize">{role || 'User'} Dashboard</h1>
      <p className="text-muted-foreground mb-8">Welcome back, {user?.email}</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 border rounded-xl bg-card">
          <h2 className="text-xl font-semibold mb-2">Overview</h2>
          <p className="text-sm text-muted-foreground">Your recent payroll activity will appear here.</p>
        </div>
        
        {role === 'business' && (
          <div className="p-6 border rounded-xl bg-card border-orange-200">
            <h2 className="text-xl font-semibold mb-2">Create Payroll</h2>
            <button className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-lg">Pay Freelancers</button>
          </div>
        )}

        {role === 'freelancer' && (
          <div className="p-6 border rounded-xl bg-card border-blue-200">
            <h2 className="text-xl font-semibold mb-2">Incoming Payments</h2>
            <p className="text-sm text-muted-foreground">Track your STX earnings.</p>
          </div>
        )}
      </div>
    </div>
  )
}
