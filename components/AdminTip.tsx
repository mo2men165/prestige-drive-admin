export default function AdminTip({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-6">
      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Admin Tip</p>
      <div className="text-sm text-blue-800 leading-relaxed">{children}</div>
    </div>
  );
}
