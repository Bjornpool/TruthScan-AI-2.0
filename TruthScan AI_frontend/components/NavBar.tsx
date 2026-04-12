/**
 * Globalny komponent nawigacji aplikacji.
 *
 * Odpowiada za:
 * - prezentację głównej nawigacji między widokami,
 * - obsługę zmiany języka interfejsu (PL / EN),
 * - przełączanie trybu jasnego i ciemnego,
 * - wizualne wskazanie aktywnej trasy.
 */


"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Home, LayoutDashboard, Bookmark } from "lucide-react";
import LanguageSwitcher from "./LanguageSwitcher";
import DarkModeToggle from "./DarkModeToggle";

type Lang = "pl" | "en" | "no";

export default function NavBar() {
  const pathname = usePathname();
  const [language, setLanguage] = useState<Lang>("pl");

  useEffect(() => {
    const stored = localStorage.getItem("lang");
    if (stored === "pl" || stored === "en" || stored === "no") setLanguage(stored as Lang);
  }, []);

  useEffect(() => {
    localStorage.setItem("lang", language);
    if (typeof document !== "undefined") document.documentElement.lang = language;
    window.dispatchEvent(new CustomEvent("app:langchange", { detail: language }));
  }, [language]);

  const links = [
    { href: "/",          labelPl: "Strona główna", labelEn: "Home",      labelNo: "Hjem",     Icon: Home },
    { href: "/dashboard", labelPl: "Dashboard",     labelEn: "Dashboard", labelNo: "Dashbord", Icon: LayoutDashboard },
    { href: "/saved",     labelPl: "Zapisane",      labelEn: "Saved",     labelNo: "Lagrede",  Icon: Bookmark },
  ];

 return (
    <nav className="sticky top-0 z-50 bg-gray-100 dark:bg-gray-900 shadow-md border-b border-gray-300/20 dark:border-gray-700/50">
      <div className="w-full flex justify-between items-center px-4 md:px-6 h-14">

        <div className="flex items-center gap-6">
          <div
            className="hidden sm:block text-base font-semibold text-blue-600 dark:text-blue-400 select-none cursor-default"
            aria-label="TruthScan AI"
            role="img"
          >
            TruthScan AI
          </div>

          <div className="flex items-center gap-6 relative">
            {links.map(({ href, labelPl, labelEn, labelNo, Icon }) => {
              const active = pathname === href || (href !== "/" && pathname.startsWith(href));
              return (
                <div key={href} className="relative">
                  <Link href={href} className="inline-flex items-center gap-1.5">
                    <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" aria-hidden="true" />
                    {language === "pl" ? labelPl : language === "no" ? labelNo : labelEn}
                  </Link>

                  {active && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute -bottom-1 left-0 right-0 h-[2px] bg-blue-600 dark:bg-blue-400 rounded-full"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher language={language} setLanguage={setLanguage} />
          <DarkModeToggle />
        </div>
      </div>
    </nav>
  );
}


