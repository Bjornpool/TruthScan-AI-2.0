/**
 * Komponent stanu ładowania dla widoku dashboardu.
 */

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center h-screen text-gray-600 dark:text-gray-300">
      
      <div className="relative flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-transparent border-t-blue-500 border-b-purple-500"></div>
        <div className="absolute animate-pulse bg-gradient-to-r from-blue-500 to-purple-500 rounded-full h-6 w-6"></div>
      </div>

      <p className="mt-6 text-xl font-semibold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent animate-pulse">
        ⏳ Ładowanie dashboardu...
      </p>
    </div>
  );
}


