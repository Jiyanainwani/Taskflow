
'use client'

import { CheckSquare, Command, FolderKanban, LayoutDashboard, UsersRound } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogoutButton } from '@/components/auth/logout-button'
import { Button } from '@/components/ui/button'
import { CommandShortcut } from '@/components/ui/command'

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

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar className="border-r border-border/60">
      <SidebarContent className="bg-card/50">
        <SidebarGroup className="px-3 py-5">
          <SidebarGroupLabel className="mb-6 px-3 text-xl font-bold tracking-tight text-foreground">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
                <CheckSquare className="h-5 w-5" />
              </div>

              <span>TaskFlow</span>
            </div>
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {items.map((item) => {
                const Icon = item.icon

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      render={<Link href={item.url} />}
                      isActive={item.url === '/dashboard'
                        ? pathname === item.url
                        : pathname === item.url || pathname.startsWith(`${item.url}/`)}
                      className="h-11 rounded-xl px-3 text-sm font-medium transition-all hover:bg-primary/10 hover:text-primary"
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
        <div className="px-4 pb-4">
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between text-muted-foreground"
            onClick={() => window.dispatchEvent(new Event('taskflow:open-command'))}
          >
            <span className="flex items-center gap-2">
              <Command className="size-4" />
              Search commands
            </span>
            <CommandShortcut>⌘ K</CommandShortcut>
          </Button>
        </div>
        <div className="mt-auto p-4"><LogoutButton /></div>
      </SidebarContent>
    </Sidebar>
  )
}
