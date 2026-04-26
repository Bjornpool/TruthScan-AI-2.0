/**
 * Komponent przełącznika trybu jasnego i ciemnego (dark mode).
 *
 * Odpowiada za:
 * - zarządzanie stanem trybu kolorystycznego interfejsu,
 * - synchronizację ustawienia z localStorage,
 * - dynamiczne dodawanie klasy `dark` do elementu <html>.
 */

"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function DarkModeToggle() {
  const [darkMode, setDarkMode] = useState<boolean>(false);

  useEffect(() => {
    const saved = localStorage.getItem("darkMode");
    if (saved === "true") {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("darkMode", String(darkMode));
  }, [darkMode]);

  return (
    <button
      onClick={() => setDarkMode(!darkMode)}
      className="p-2 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
      aria-label={darkMode ? "Przełącz na tryb jasny" : "Przełącz na tryb ciemny"}
      title={darkMode ? "Tryb jasny" : "Tryb ciemny"}
    >
      {darkMode ? (
        <Sun className="w-5 h-5 text-yellow-400" />
      ) : (
        <Moon className="w-5 h-5 text-gray-800 dark:text-white" />
      )}
    </button>
  );
}




