'use client'

import { Button } from '@/components/ui/button'

type ErrorPageProps = {
  reset: () => void
}

export default function ErrorPage({
  reset,
}: ErrorPageProps) {
  return (
    <main className="flex min-h-[400px] flex-col items-center justify-center p-6 text-center">
      <h2 className="text-xl font-semibold">
        Something went wrong
      </h2>

      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        We couldn&apos;t load your dashboard. Please try again.
      </p>

      <Button
        className="mt-6"
        onClick={() => reset()}
      >
        Try again
      </Button>
    </main>
  )
}