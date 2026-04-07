/**
 * Globalny komponent obsługi błędów aplikacji (Next.js App Router).
 */

"use client";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: Props) {

  const lang =
    typeof window !== "undefined" && localStorage.getItem("lang") === "en"
      ? "en"
      : "pl";

  return (
    <html lang="pl"> 
      <body className="p-6 text-red-500 bg-gray-50 dark:bg-gray-900"> 
        <h2 className="text-3xl font-bold mb-4">
          ❌ {lang === "en"
            ? "An unexpected error occurred"
            : "Wystąpił nieoczekiwany błąd"}
        </h2>

        <p className="mb-4">{error.message}</p>

        <button
          className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
          onClick={() => reset()}
        >
          🔁 {lang === "en" ? "Try again" : "Spróbuj ponownie"}
        </button>
      </body>
    </html>
  );
}
