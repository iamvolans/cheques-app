"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const guardado = localStorage.getItem("tema");
    const esDark = guardado ? guardado === "dark" : true;
    setDark(esDark);
    document.documentElement.classList.toggle("dark", esDark);
  }, []);

  function alternar() {
    const nuevo = !dark;
    setDark(nuevo);
    document.documentElement.classList.toggle("dark", nuevo);
    localStorage.setItem("tema", nuevo ? "dark" : "light");
  }

  return (
    <button
      onClick={alternar}
      title={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:text-foreground"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
