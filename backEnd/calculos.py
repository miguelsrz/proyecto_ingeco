def calcular_viabilidad(region: dict, area_m2: float, costo_instalacion: float) -> dict:
    """
    Calculo basico de prueba:
      ahorro_anual = area * radiacion * 365 * eficiencia * tarifa
      viable       = ahorro_anual * 10 > costo_instalacion
    """
    ahorro_anual = area_m2 * region["radiacion_kwh_m2_dia"] * 365 * region["eficiencia_paneles"] * region["tarifa_kwh_cop"]
    viable       = ahorro_anual * 10 > costo_instalacion

    return {
        "ahorro_anual_cop": round(ahorro_anual, 2),
        "viable":           viable,
    }
