'use client'

import * as React from "react"
import { 
  Users, 
  Plus, 
  Search, 
  MoreHorizontal, 
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { useNotification } from "@/components/NotificationProvider"
import { AddTeamMemberModal } from "@/components/dashboard/ActionModals"
import { deleteTeamMember } from "@/app/actions/team"
import { useRouter } from "next/navigation"
import { RecipientDetailsModal } from "./RecipientDetailsModal"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { History as HistoryIcon } from "lucide-react"

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
}

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring" as const, stiffness: 100, damping: 15 }
  }
}

export function RecipientsClient({ initialRecipients }: { initialRecipients: any[] }) {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false)
  const [editingMember, setEditingMember] = React.useState<any>(null)
  const [trackingRecipient, setTrackingRecipient] = React.useState<any>(null)
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 5
  const { showNotification } = useNotification()
  const router = useRouter()

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = React.useState<{ isOpen: boolean; memberId: string | null; memberName: string }>({
    isOpen: false,
    memberId: null,
    memberName: ''
  })
  const [isDeleting, setIsDeleting] = React.useState(false)

  const handleDeleteRequest = (id: string, name: string) => {
    setDeleteConfirm({ isOpen: true, memberId: id, memberName: name })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.memberId) return
    
    setIsDeleting(true)
    try {
      const { error } = await deleteTeamMember(deleteConfirm.memberId)
      if (error) {
        showNotification('error', 'Failed', error)
      } else {
        showNotification('success', 'Removed', 'Member removed successfully.')
        router.refresh()
      }
    } finally {
      setIsDeleting(false)
      setDeleteConfirm({ isOpen: false, memberId: null, memberName: '' })
    }
  }

  const filteredRecipients = initialRecipients.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (f.email && f.email.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const totalPages = Math.ceil(filteredRecipients.length / itemsPerPage)
  const paginatedRecipients = filteredRecipients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  return (
    <motion.div 
      className="space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div className="flex flex-col md:flex-row md:items-center justify-between gap-4" variants={itemVariants}>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payout Recipients</h1>
          <p className="text-muted-foreground mt-1">Manage your employees, contractors, and their payment details.</p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)} className="rounded-xl shadow-lg shadow-primary/20">
          <Plus className="mr-2 h-4 w-4" />
          Add Recipient
        </Button>
      </motion.div>

      <AddTeamMemberModal 
        isOpen={isAddModalOpen || !!editingMember} 
        initialData={editingMember}
        onClose={() => {
          setIsAddModalOpen(false)
          setEditingMember(null)
          router.refresh()
        }} 
      />

      <RecipientDetailsModal
        isOpen={!!trackingRecipient}
        recipient={trackingRecipient}
        onClose={() => setTrackingRecipient(null)}
      />

      <motion.div variants={itemVariants}>
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="border-b bg-accent/5 pb-6">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div className="relative max-w-sm w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 rounded-xl h-10"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="rounded-lg">Filter</Button>
                <Button variant="outline" size="sm" className="rounded-lg">Export</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground font-medium bg-accent/5">
                    <th className="px-6 py-4 text-left text-[10px] md:text-sm">Recipient Name</th>
                    <th className="px-6 py-4 text-left hidden md:table-cell">Role</th>
                    <th className="px-6 py-4 text-left text-[10px] md:text-sm">Wallet Address</th>
                    <th className="px-6 py-4 text-left hidden lg:table-cell">Rate (USD)</th>
                    <th className="px-6 py-4 text-left hidden sm:table-cell">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y relative">
                  {paginatedRecipients.map((f) => (
                    <tr key={f.id} className="group hover:bg-accent/20 transition-colors">
                      <td className="px-3 py-4 md:px-6">
                        <div className="flex items-center gap-2 md:gap-3">
                          <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary group-hover:scale-110 transition-transform text-[10px] md:text-base">
                            {f.name.split(' ').map((n: string) => n[0]).join('')}
                          </div>
                          <div>
                            <p className="font-bold text-[10px] md:text-sm truncate max-w-[100px] md:max-w-none">{f.name}</p>
                            <p className="text-[8px] md:text-xs text-muted-foreground hidden md:block">{f.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <span className="text-xs font-medium px-2 py-1 bg-accent/50 rounded-lg">{f.role || 'No Role'}</span>
                      </td>
                      <td className="px-3 py-4 md:px-6">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1 md:gap-2 font-mono text-[8px] md:text-[10px] bg-accent/30 w-fit px-1.5 py-0.5 rounded-lg whitespace-nowrap">
                            <span className="text-[7px] md:text-[8px] font-bold text-primary uppercase">STX</span>
                            {f.wallet_address.substring(0, 4)}...{f.wallet_address.substring(f.wallet_address.length - 4)}
                          </div>
                          {f.btc_address && (
                            <div className="flex items-center gap-1 md:gap-2 font-mono text-[8px] md:text-[10px] bg-accent/30 w-fit px-1.5 py-0.5 rounded-lg whitespace-nowrap">
                              <span className="text-[7px] md:text-[8px] font-bold text-orange-500 uppercase">BTC</span>
                              {f.btc_address.substring(0, 4)}...{f.btc_address.substring(f.btc_address.length - 4)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden lg:table-cell">
                        <div className="flex flex-col">
                          <span className="font-bold">${f.rate}</span>
                          <span className="text-[10px] text-muted-foreground uppercase">{f.payment_frequency}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden sm:table-cell">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          f.status === 'Active' ? "bg-green-100 text-green-700 dark:bg-green-950/30" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30"
                        )}>
                          {f.status}
                        </span>
                      </td>
                      <td className="px-3 py-4 md:px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1 md:gap-2">
                           <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 md:h-8 md:w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => setTrackingRecipient(f)}
                           >
                              <HistoryIcon className="h-3 w-3 md:h-3.5 md:w-3.5" />
                           </Button>
                           <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 md:h-8 md:w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => setEditingMember(f)}
                           >
                              <Edit2 className="h-3 w-3 md:h-3.5 md:w-3.5" />
                           </Button>
                           <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 md:h-8 md:w-8 text-red-500 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRequest(f.id, f.name);
                              }}
                           >
                              <Trash2 className="h-3 w-3 md:h-3.5 md:w-3.5" />
                           </Button>
                           <div className="group-hover:hidden transition-all">
                              <MoreHorizontal className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
                           </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredRecipients.length > itemsPerPage && (
              <div className="flex items-center justify-between p-6 bg-accent/5 border-t">
                <p className="text-xs text-muted-foreground">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredRecipients.length)} of {filteredRecipients.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-8 w-8 rounded-lg"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-8 w-8 rounded-lg"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            {filteredRecipients.length === 0 && (
              <div className="p-12 text-center border-t">
                <div className="bg-accent/50 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-bold">No recipients found</h3>
                <p className="text-sm text-muted-foreground">Try adjusting your search query or add a new recipient.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, memberId: null, memberName: '' })}
        onConfirm={handleDeleteConfirm}
        title="Remove Recipient?"
        message={`Are you sure you want to remove "${deleteConfirm.memberName}"? This action cannot be undone.`}
        confirmText="Remove"
        cancelText="Keep"
        variant="danger"
        isLoading={isDeleting}
      />
    </motion.div>
  )
}
