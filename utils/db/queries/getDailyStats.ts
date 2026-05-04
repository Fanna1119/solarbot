import prisma from "../../../db/index";

export interface DailyStats {
  date: string;
  recordCount: number;
  // Energy totals (kWh)
  productionKwh: number;
  consumptionKwh: number;
  netEnergyKwh: number;
  excessEnergyKwh: number;
  energyDeficitKwh: number;
  // Battery
  avgBatteryPct: number;
  minBatteryPct: number;
  maxBatteryPct: number;
  startBatteryPct: number;
  endBatteryPct: number;
  netBatteryChangePct: number;
  // Efficiency
  selfConsumptionRatioPct: number;
  selfSufficiencyRatioPct: number;
  // Peak & timing
  peakProductionKw: number;
  peakProductionTime: string;
  peakConsumptionKw: number;
  peakConsumptionTime: string;
  avgProductionKw: number;
  avgConsumptionKw: number;
  productionHours: number;
  // Outages
  outageCount: number;
}

/**
 * Compute daily stats for a given date (defaults to today).
 * Energy is calculated via trapezoidal integration between consecutive
 * data points. Production/consumption are stored in Watts in the DB.
 */
export const getDailyStats = async (
  date?: Date,
): Promise<DailyStats | null> => {
  const targetDate = date ?? new Date();

  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const startTs = BigInt(startOfDay.getTime());
  const endTs = BigInt(endOfDay.getTime());

  const records = await prisma.gridStatus.findMany({
    where: { timestamp: { gte: startTs, lte: endTs } },
    orderBy: { timestamp: "asc" },
  });

  if (records.length === 0) return null;

  const dateStr = startOfDay.toLocaleDateString("en-ZA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const rows = records.map((r) => ({
    ts: Number(r.timestamp),
    status: r.status,
    battery: r.battery_level ?? 0,
    production: r.production ?? 0, // Watts
    consumption: r.consumption ?? 0, // Watts
  }));

  // Trapezoidal energy integration
  let productionWh = 0;
  let consumptionWh = 0;
  let excessWh = 0;
  let deficitWh = 0;
  let productionHoursMs = 0;

  for (let i = 1; i < rows.length; i++) {
    const dtHours = (rows[i].ts - rows[i - 1].ts) / 3_600_000;
    const prodAvgW = (rows[i].production + rows[i - 1].production) / 2;
    const consAvgW = (rows[i].consumption + rows[i - 1].consumption) / 2;

    productionWh += prodAvgW * dtHours;
    consumptionWh += consAvgW * dtHours;

    const netAvgW = prodAvgW - consAvgW;
    if (netAvgW > 0) excessWh += netAvgW * dtHours;
    else deficitWh += -netAvgW * dtHours;

    if (prodAvgW > 100) productionHoursMs += rows[i].ts - rows[i - 1].ts;
  }

  const productionKwh = productionWh / 1000;
  const consumptionKwh = consumptionWh / 1000;
  const netEnergyKwh = productionKwh - consumptionKwh;
  const excessEnergyKwh = excessWh / 1000;
  const energyDeficitKwh = deficitWh / 1000;
  const productionHours = productionHoursMs / 3_600_000;

  // Battery stats (ignore zero readings as they likely indicate missing data)
  const batteryVals = rows.map((r) => r.battery).filter((b) => b > 0);
  const avgBatteryPct =
    batteryVals.length > 0
      ? batteryVals.reduce((a, b) => a + b, 0) / batteryVals.length
      : 0;
  const minBatteryPct = batteryVals.length > 0 ? Math.min(...batteryVals) : 0;
  const maxBatteryPct = batteryVals.length > 0 ? Math.max(...batteryVals) : 0;
  const startBatteryPct = rows[0].battery;
  const endBatteryPct = rows[rows.length - 1].battery;
  const netBatteryChangePct = endBatteryPct - startBatteryPct;

  // Efficiency (simplified — battery discharge not directly measured)
  const selfConsumptionRatioPct =
    productionKwh > 0
      ? (Math.min(productionKwh, consumptionKwh) / productionKwh) * 100
      : 0;
  const selfSufficiencyRatioPct =
    consumptionKwh > 0
      ? (Math.min(productionKwh, consumptionKwh) / consumptionKwh) * 100
      : 0;

  // Peak values
  const peakProd = rows.reduce((max, r) =>
    r.production > max.production ? r : max,
  );
  const peakCons = rows.reduce((max, r) =>
    r.consumption > max.consumption ? r : max,
  );

  const fmtTime = (ts: number) =>
    new Date(ts).toLocaleTimeString("en-ZA", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const avgProductionKw =
    rows.reduce((s, r) => s + r.production, 0) / rows.length / 1000;
  const avgConsumptionKw =
    rows.reduce((s, r) => s + r.consumption, 0) / rows.length / 1000;

  const outageCount = rows.filter((r) => r.status === 0).length;

  return {
    date: dateStr,
    recordCount: rows.length,
    productionKwh: round(productionKwh, 2),
    consumptionKwh: round(consumptionKwh, 2),
    netEnergyKwh: round(netEnergyKwh, 2),
    excessEnergyKwh: round(excessEnergyKwh, 2),
    energyDeficitKwh: round(energyDeficitKwh, 2),
    avgBatteryPct: round(avgBatteryPct, 1),
    minBatteryPct,
    maxBatteryPct,
    startBatteryPct,
    endBatteryPct,
    netBatteryChangePct,
    selfConsumptionRatioPct: round(selfConsumptionRatioPct, 1),
    selfSufficiencyRatioPct: round(selfSufficiencyRatioPct, 1),
    peakProductionKw: round(peakProd.production / 1000, 2),
    peakProductionTime: fmtTime(peakProd.ts),
    peakConsumptionKw: round(peakCons.consumption / 1000, 2),
    peakConsumptionTime: fmtTime(peakCons.ts),
    avgProductionKw: round(avgProductionKw, 2),
    avgConsumptionKw: round(avgConsumptionKw, 2),
    productionHours: round(productionHours, 1),
    outageCount,
  };
};

const round = (n: number, decimals: number) =>
  Math.round(n * 10 ** decimals) / 10 ** decimals;
