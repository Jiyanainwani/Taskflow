import { MagicAddForm } from '@/components/tasks/magic-add-form'

export default function MagicAddPage() {
  return (
    <main className="min-h-[calc(100vh-4.25rem)] px-4 py-5 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
      <div className="mx-auto w-full max-w-5xl">
        <MagicAddForm />
      </div>
    </main>
  )
}
