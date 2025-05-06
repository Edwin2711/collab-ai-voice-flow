
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { getUser } from "@/lib/auth";
import { useEffect } from "react";

const Meeting = () => {
  const navigate = useNavigate();
  const user = getUser();

  useEffect(() => {
    // Redirect to home if not logged in
    if (!user) {
      navigate("/");
    }
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b py-4 px-4 sm:px-6 lg:px-8 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <span className="text-white font-bold">C</span>
            </div>
            <h1 className="text-xl font-bold">CollabCopilot</h1>
          </div>
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            Volver al panel
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto py-8 px-4">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Nueva reunión</h2>
          <p className="text-gray-600 mb-6">
            Esta es una versión demo de la página de reuniones. Aquí es donde se integraría la funcionalidad de grabación y análisis de audio.
          </p>
          <div className="flex gap-4">
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              Cancelar
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-4 px-4">
        <div className="container mx-auto">
          <div className="text-center text-gray-500">
            <p>© 2025 CollabCopilot. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Meeting;
