import csv
import os

RUTA_CSV = os.path.join(os.path.dirname(__file__), "datos", "regiones.csv")

_cache = None


def obtener_region(ciudad: str) -> dict:
    global _cache
    if _cache is None:
        _cache = {}
        with open(RUTA_CSV, newline="", encoding="utf-8") as f:
            for fila in csv.DictReader(f):
                _cache[fila["ciudad"]] = {
                    "radiacion_kwh_m2_dia": float(fila["radiacion_kwh_m2_dia"]),
                    "tarifa_kwh_cop":       float(fila["tarifa_kwh_cop"]),
                    "eficiencia_paneles":   float(fila["eficiencia_paneles"]),
                }
    if ciudad not in _cache:
        raise ValueError(f"Ciudad '{ciudad}' no encontrada.")
    return _cache[ciudad]
