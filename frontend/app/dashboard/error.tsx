/**
 * Komponent obsługi błędów dla widoku dashboardu.
 */

"use client";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: Props) {
  return (
    <div className="p-6 text-red-500">
      <h2 className="text-2xl font-bold mb-4">
        ❌ {typeof window !== "undefined" && localStorage.getItem("lang") === "en"
          ? "An error occurred in the dashboard"
          : "Wystąpił błąd w dashboardzie"}
      </h2>

      <p>{error.message}</p>

      <button
        className="mt-4 bg-red-600 text-white px-4 py-2 rounded"
        onClick={() => reset()}
      >
        🔁 {typeof window !== "undefined" && localStorage.getItem("lang") === "en"
          ? "Try again"
          : "Spróbuj ponownie"}
      </button>
    </div>
  );
}
