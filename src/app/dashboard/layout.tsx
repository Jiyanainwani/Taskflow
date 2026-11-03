import { AppSidebar } from '@/components/layout/app-sidebar'
import { SidebarProvider } from '@/components/ui/sidebar'
import { DashboardAuthGuard } from '@/components/auth/dashboard-auth-guard'
import { CommandPalette } from '@/components/command-palette'
import { TaskRealtimeProvider } from '@/components/realtime/task-realtime-provider'
import { DashboardTopbar } from '@/components/layout/dashboard-topbar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DashboardAuthGuard>
      <TaskRealtimeProvider>
        <CommandPalette />
        <SidebarProvider>
          <AppSidebar />

          <div className="min-w-0 flex-1">
            <DashboardTopbar />
            {children}
          </div>
        </SidebarProvider>
      </TaskRealtimeProvider>
    </DashboardAuthGuard>
  )
}
