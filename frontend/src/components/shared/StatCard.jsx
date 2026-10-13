export function StatCard({ label, value, icon: Icon, accent = "#2563EB", testId, hint }) {
  return (
    <div className="bg-card border rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow" data-testid={testId}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{label}</p>
          <p className="font-display font-extrabold text-3xl mt-2 font-mono-nums">{value}</p>
          {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        </div>
        {Icon && (
          <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: accent + "1a" }}>
            <Icon className="h-5 w-5" style={{ color: accent }} />
          </div>
        )}
      </div>
    </div>
  );
}
