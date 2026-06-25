export default function Sparkline({
  datos,
  ancho = 80,
  alto = 24,
}: {
  datos: number[];
  ancho?: number;
  alto?: number;
}) {
  if (!datos || datos.length < 2) {
    return <span className="text-xs text-muted-foreground/50">—</span>;
  }

  const max = Math.max(...datos);
  const min = Math.min(...datos);
  const rango = max - min || 1;
  const pasoX = ancho / (datos.length - 1);

  // Mapea cada valor a coordenadas SVG (Y invertido: más alto = más arriba)
  const puntos = datos.map((v, i) => {
    const x = i * pasoX;
    const y = alto - ((v - min) / rango) * (alto - 4) - 2;
    return [x, y] as const;
  });

  const d = puntos.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");

  // Tendencia: comparar último vs primero para el color
  const sube = datos[datos.length - 1] >= datos[0];
  const color = sube ? "var(--primary)" : "var(--danger)";
  const [ultX, ultY] = puntos[puntos.length - 1];

  return (
    <svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`} className="overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={ultX} cy={ultY} r={2} fill={color} />
    </svg>
  );
}
