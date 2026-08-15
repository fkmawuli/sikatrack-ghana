export default function MobileHeader({ businessName }: { businessName: string }) {
  return (
    <header className="lg:hidden sticky top-0 z-30 bg-primary text-white px-4 py-3 flex items-center gap-2">
      <div className="h-8 w-8 rounded-lg bg-gold text-primary-dark font-bold flex items-center justify-center text-sm">
        S
      </div>
      <div>
        <p className="font-semibold text-sm leading-tight">KudiTrack</p>
        <p className="text-[11px] text-white/70 truncate max-w-[220px]">{businessName}</p>
      </div>
    </header>
  );
}
