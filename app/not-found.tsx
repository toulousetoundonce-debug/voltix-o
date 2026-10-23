import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-20 text-slate-100">
      <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900/80 p-8 text-center shadow-2xl shadow-cyan-500/10">
        <p className="mb-3 text-sm font-medium tracking-[0.2em] text-cyan-300">Voltix Dynamics</p>
        <h1 className="text-3xl font-black text-white">الصفحة غير موجودة</h1>
        <p className="mt-4 text-sm text-slate-300">
          الصفحة التي طلبتها غير متاحة حالياً. يمكنك العودة إلى الصفحة الرئيسية أو إرسال طلب دعم.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/" className="rounded-full bg-cyan-400 px-4 py-2 font-bold text-slate-950 transition hover:bg-cyan-300">
            الصفحة الرئيسية
          </Link>
          <Link href="/#contact" className="rounded-full border border-slate-600 px-4 py-2 font-semibold text-white hover:border-cyan-300">
            تواصل معنا
          </Link>
        </div>
      </div>
    </main>
  );
}
