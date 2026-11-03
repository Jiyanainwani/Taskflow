
'use client'

import { BellRing, CheckSquare, Command, FolderKanban, LayoutDashboard, UsersRound } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogoutButton } from '@/components/auth/logout-button'
import { Button } from '@/components/ui/button'
import { CommandShortcut } from '@/components/ui/command'
import {
  checkReminderAdminAccess,
  reminderAdminAccessQueryKey,
} from '@/lib/reminder-admin-api'
import { getCurrentUserId } from '@/lib/auth'

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

const items = [
  {
    title: 'Dashboard',
    url: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Teams',
    url: '/dashboard/teams',
    icon: UsersRound,
  },
  {
    title: 'Projects',
    url: '/dashboard/projects',
    icon: FolderKanban,
  },
]

const adminItems = [
  {
    title: 'Failed reminders',
    url: '/dashboard/admin/reminders',
    icon: BellRing,
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const userId = getCurrentUserId()
  const reminderAdminAccess = useQuery({
    queryKey: reminderAdminAccessQueryKey(userId),
    queryFn: checkReminderAdminAccess,
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
  })
  const visibleItems =
    reminderAdminAccess.isSuccess &&
    reminderAdminAccess.data?.isAdmin &&
    !reminderAdminAccess.isFetching
      ? [...items, ...adminItems]
      : items

  return (
    <Sidebar className="border-r border-sidebar-border/80">
      <SidebarContent className="bg-sidebar">
        <SidebarGroup className="px-3 py-5">
          <SidebarGroupLabel className="mb-8 px-3 text-xl font-bold tracking-tight text-sidebar-foreground">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_6px_16px_-7px_color-mix(in_oklch,var(--primary)_70%,transparent)]">
                <CheckSquare className="h-5 w-5" />
              </div>

              <span className="font-semibold">TaskFlow</span>
            </div>
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarGroupLabel className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/55">
              Workspace
            </SidebarGroupLabel>
            <SidebarMenu className="gap-1">
              {visibleItems.map((item) => {
                const Icon = item.icon

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      render={<Link href={item.url} />}
                      isActive={item.url === '/dashboard'
                        ? pathname === item.url
                        : pathname === item.url || pathname.startsWith(`${item.url}/`)}
                      className="h-10 rounded-lg px-3 text-[13px] font-medium transition-all hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground data-active:shadow-[inset_2px_0_0_var(--primary)]"
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <div className="px-4 pb-5">
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full justify-between rounded-lg border-sidebar-border/80 bg-white/[0.04] text-xs text-sidebar-foreground/65 shadow-none hover:bg-sidebar-accent hover:text-sidebar-foreground"
            onClick={() => window.dispatchEvent(new Event('taskflow:open-command'))}
          >
            <span className="flex items-center gap-2">
              <Command className="size-4" />
              Search commands
            </span>
            <CommandShortcut>Ctrl K</CommandShortcut>
          </Button>
        </div>
        <div className="mt-auto border-t border-sidebar-border/80 p-4"><LogoutButton /></div>
      </SidebarContent>
    </Sidebar>
  )
}
