'use client'

import { Search } from 'lucide-react'
import { usePathname } from 'next/navigation'

import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'

const routeTitles: Record<string, string> = {
  '/dashboard': 'Overview',
  '/dashboard/magic-add': 'Magic Add',
  '/dashboard/standup': 'Daily digest',
  '/dashboard/search': 'Semantic search',
  '/dashboard/teams': 'Teams',
  '/dashboard/projects': 'Projects',
  '/dashboard/admin/reminders': 'Failed reminders',
}

export function DashboardTopbar() {
  const pathname = usePathname()
  const title = routeTitles[pathname] ?? (pathname.startsWith('/dashboard/teams/') ? 'Team workspace' : 'Workspace')

  return (
    <header className="sticky top-0 z-20 flex h-[4.25rem] items-center justify-between border-b border-border/70 bg-background/85 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger className="-ml-2 text-muted-foreground" />
        <div className="min-w-0">
          <p className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:block">
            TaskFlow workspace
          </p>
          <p className="truncate text-sm font-semibold tracking-tight sm:text-base">{title}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-9 gap-2 border-border/70 bg-card/70 px-3 text-muted-foreground shadow-none hover:border-primary/30 hover:bg-card sm:min-w-52 sm:justify-start"
          onClick={() => window.dispatchEvent(new Event('taskflow:open-command'))}
          aria-label="Open command search"
        >
          <Search className="size-4" />
          <span className="hidden text-xs sm:inline">Search anything</span>
          <span className="ml-auto hidden rounded border border-border px-1.5 py-0.5 text-[10px] sm:inline-flex">
            Ctrl K
          </span>
        </Button>
        <ThemeToggle />
      </div>
    </header>
  )
}
