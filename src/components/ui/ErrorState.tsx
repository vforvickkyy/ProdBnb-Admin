export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded border border-red-200 bg-red-50 px-6 py-8 text-center">
      <p className="text-sm font-medium text-red-800">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400"
        >
          Retry
        </button>
      )}
    </div>
  );
}

// Best-effort extraction of the backend's real error message
// ({ error: { message } }) instead of the generic strings every page used
// to hardcode -- falls back to a generic message only when the response
// genuinely isn't in that shape.
export function extractErrorMessage(err: unknown, fallback = "Something went wrong."): string {
  if (err && typeof err === "object") {
    const maybe = err as { error?: { message?: string }; message?: string };
    if (maybe.error?.message) return maybe.error.message;
    if (maybe.message) return maybe.message;
  }
  return fallback;
}
