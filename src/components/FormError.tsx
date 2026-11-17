// Error that belongs to the whole form, such as a wrong password or a failed save.
export default function FormError({ message }: { message?: string }) {
  if (!message) return null

  return (
    <p role="alert" className="rounded-lg border border-danger/40 bg-danger/5 px-3 py-2.5 text-sm font-medium text-danger">
      {message}
    </p>
  )
}
