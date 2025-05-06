
interface User {
  id: string;
  email: string;
  name: string;
}

// Implementación simple de autenticación sin JWT
export function getUser(): User | null {
  const userString = localStorage.getItem("user");
  if (!userString) return null;
  
  try {
    return JSON.parse(userString);
  } catch (error) {
    console.error("Error parsing user:", error);
    return null;
  }
}

export function setUser(user: User): void {
  localStorage.setItem("user", JSON.stringify(user));
}

export function clearUser(): void {
  localStorage.removeItem("user");
}

// Función simple para verificar si el usuario está autenticado
export function isAuthenticated(): boolean {
  return getUser() !== null;
}
