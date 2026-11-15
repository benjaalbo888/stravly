import Link from "next/link";
import { ArrowUpRight, CalendarRange, LockKeyhole } from "lucide-react";
import { demoBookingEnabled } from "@/lib/supabase/env";

export function Brand({ inverse = false }: { inverse?: boolean }) {
  return <Link href="/" className={`brand ${inverse ? "brand-inverse" : ""}`} aria-label="Stravly, inicio">
    <span className="brand-mark"><CalendarRange size={18} aria-hidden="true" strokeWidth={2.1} /></span>
    <span>stravly<span className="brand-dot">.</span></span>
  </Link>;
}

export function Header() {
  const multi = process.env.STRAVLY_MULTI_BUSINESS === "1";
  return <header className="site-header">
    <div className="shell nav-row">
      <Brand />
      <nav aria-label="Navegación principal" className="main-nav">
        <Link href="/">Inicio</Link><Link href="/#como-funciona">Cómo funciona</Link>
        <Link href="/demo">Demo</Link>
        {demoBookingEnabled() && <Link href="/reservar">Reservar</Link>}
      </nav>
      <Link className="admin-link" href={multi ? "/dashboard" : "/admin"}><LockKeyhole size={15} aria-hidden="true" /> <span>{multi ? "Mis negocios" : "Acceso administrador"}</span></Link>
    </div>
  </header>;
}

export function Footer() {
  const repo = process.env.STRAVLY_GITHUB_URL;
  const repoUrl = repo && /^https:\/\/github\.com\/[\w.-]+\/stravly\/?$/i.test(repo) ? repo : "https://github.com/benjaalbo888/stravly";
  return <footer className="site-footer">
    <div className="shell footer-row"><Brand /><p>Agenda para negocios con citas</p>
      <div className="footer-links">
        <a href={repoUrl} rel="noopener noreferrer">GitHub <ArrowUpRight size={14} aria-hidden="true" /></a>
      </div>
    </div>
  </footer>;
}
