export default function CouponLoading() {
  return (
    <div className="min-h-[70vh] bg-[#f4f5f2] pb-12">
      <div className="mx-auto max-w-md px-4 pt-5">
        <div className="rounded-[26px] bg-[#0c110b] p-5 text-white">
          <p className="text-[11px] font-extrabold tracking-[0.14em] text-[#5eff38]">RAPPI SPORTS HUB</p>
          <p className="mt-4 font-[family-name:var(--font-oswald)] text-[56px] font-bold leading-[0.9] text-[#5eff38]">5% OFF</p>
          <div className="mx-auto mt-5 h-[200px] w-[200px] animate-pulse rounded-[18px] bg-white/15" />
          <p className="mt-3 text-center text-sm text-white/70">Preparing your coupon…</p>
        </div>
      </div>
    </div>
  );
}
