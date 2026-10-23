'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FolderKanban, LayoutDashboard, UsersRound } from 'lucide-react'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }

    function handleOpen() {
      setOpen(true)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('taskflow:open-command', handleOpen)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('taskflow:open-command', handleOpen)
    }
  }, [])

  function navigate(path: string) {
    setOpen(false)
    router.push(path)
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search or navigate..." />

      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => navigate('/dashboard')} value="dashboard home">
            <LayoutDashboard />
            Dashboard
            <CommandShortcut>↵</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => navigate('/dashboard#tasks')} value="tasks">
            <span className="flex size-4 items-center justify-center text-xs font-bold">✓</span>
            Tasks
          </CommandItem>
          <CommandItem onSelect={() => navigate('/dashboard/teams')} value="teams">
            <UsersRound />
            Teams
          </CommandItem>
          <CommandItem onSelect={() => navigate('/dashboard/projects')} value="projects">
            <FolderKanban />
            Projects
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
