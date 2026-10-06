import {
  CheckSquare,
  LayoutDashboard,
  ListTodo,
} from 'lucide-react'
import Link from 'next/link'

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
 
]

export function AppSidebar() {
  return (
    <Sidebar className="border-r border-border/60">
      <SidebarContent className="bg-card/50">
        <SidebarGroup className="px-3 py-5">
          {/* Logo */}
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
      </SidebarContent>
    </Sidebar>
  )
}