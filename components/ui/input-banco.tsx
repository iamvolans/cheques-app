"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

export default function InputBanco({
  name,
  bancos,
  defaultValue,
  required,
  className,
  placeholder = "Buscá tu banco…",
}: {
  name: string;
  bancos: string[];
  defaultValue?: string;
  required?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const [seleccion, setSeleccion] = useState(defaultValue ?? "");
  const [texto, setTexto] = useState(defaultValue ?? "");
  const [abierto, setAbierto] = useState(false);
  const [resaltado, setResaltado] = useState(0);

  const contenedorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLUListElement>(null);

  const filtrados = useMemo(() => {
    const q = normalizar(texto);
    if (!q) return bancos;
    return bancos.filter((b) => normalizar(b).includes(q));
  }, [texto, bancos]);

  useEffect(() => { setResaltado(0); }, [texto, abierto]);

  useEffect(() => {
    function alClickAfuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) cerrar();
    }
    if (abierto) document.addEventListener("mousedown", alClickAfuera);
    return () => document.removeEventListener("mousedown", alClickAfuera);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  useEffect(() => {
    if (!abierto || !listaRef.current) return;
    const item = listaRef.current.children[resaltado] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [resaltado, abierto]);

  function elegir(banco: string) {
    setSeleccion(banco);
    setTexto(banco);
    setAbierto(false);
  }

  function cerrar() {
    setAbierto(false);
    setTexto(seleccion || "");
  }

  function alTeclear(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!abierto) { setAbierto(true); return; }
      setResaltado((r) => Math.min(r + 1, filtrados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setResaltado((r) => Math.max(r - 1, 0));
    } else if (e.key === "Enter") {
      if (abierto && filtrados[resaltado]) {
        e.preventDefault();
        elegir(filtrados[resaltado]);
      }
    } else if (e.key === "Escape" || e.key === "Tab") {
      cerrar();
    }
  }

  return (
    <div ref={contenedorRef} className="relative">
      <input type="hidden" name={name} value={seleccion} required={required} />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={abierto}
        aria-controls={`${name}-lista`}
        aria-autocomplete="list"
        autoComplete="off"
        value={texto}
        placeholder={placeholder}
        className={className}
        onChange={(e) => {
          setTexto(e.target.value);
          setSeleccion("");
          if (!abierto) setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={alTeclear}
      />
      {abierto && (
        <ul
          ref={listaRef}
          id={`${name}-lista`}
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-card py-1 shadow-lg shadow-foreground/10"
        >
          {filtrados.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">Sin coincidencias</li>
          ) : (
            filtrados.map((b, i) => (
              <li
                key={b}
                role="option"
                aria-selected={b === seleccion}
                onMouseDown={(e) => { e.preventDefault(); elegir(b); }}
                onMouseEnter={() => setResaltado(i)}
                className={`cursor-pointer px-3 py-2 text-sm normal-case tracking-normal ${i === resaltado ? "bg-muted text-foreground" : "text-foreground/90"} ${b === seleccion ? "font-medium text-primary" : ""}`}
              >
                {b}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
