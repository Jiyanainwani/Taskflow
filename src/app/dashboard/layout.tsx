import { AppSidebar } from '@/components/layout/app-sidebar'
import { SidebarProvider } from '@/components/ui/sidebar'
import { DashboardAuthGuard } from '@/components/auth/dashboard-auth-guard'
import { CommandPalette } from '@/components/command-palette'
import { TaskRealtimeProvider } from '@/components/realtime/task-realtime-provider'

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

          <main className="min-w-0 flex-1">{children}</main>
        </SidebarProvider>
      </TaskRealtimeProvider>
    </DashboardAuthGuard>
  )
}
