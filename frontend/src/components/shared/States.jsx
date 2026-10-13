import { Loader2, Inbox, AlertTriangle } from "lucide-react";

export function Loading({ label = "Loading..." }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground" data-testid="loading-state">
      <Loader2 className="h-8 w-8 animate-spin mb-3" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({ title = "Nothing here yet", description, action, testId = "empty-state" }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center" data-testid={testId}>
      <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
        <Inbox className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="font-display font-bold text-lg">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message = "Something went wrong.", onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="error-state">
      <AlertTriangle className="h-8 w-8 text-destructive mb-3" />
      <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-4 text-sm font-semibold text-[#2563EB] hover:underline" data-testid="retry-button">
          Try again
        </button>
      )}
    </div>
  );
}
