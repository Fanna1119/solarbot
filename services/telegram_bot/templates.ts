import type { DailyStats } from "../../utils/db/queries/getDailyStats";

interface DataField {
  value?: string;
}

export const allDataMessage = (
  status: boolean,
  batteryLevelNow?: DataField,
  sunPower?: DataField,
  consumptionNow?: DataField,
): string => {
  return `${status ? `⚡️ POWER IS ON` : `🚨 POWER IS OFF`} \n\n🔋 at ${batteryLevelNow?.value}%\n\n ☀️ Producing ${+(sunPower?.value ?? 0) / 1000} kW \n\n 🏡 Current Consumption ${+(consumptionNow?.value ?? 0) / 1000} kW`;
};

export const dailyStatsMessage = (s: DailyStats): string => {
  const netSign = s.netEnergyKwh >= 0 ? "+" : "";
  const battChange =
    s.netBatteryChangePct >= 0
      ? `+${s.netBatteryChangePct}%`
      : `${s.netBatteryChangePct}%`;

  return [
    `📅 <b>Daily Report — ${s.date}</b>`,
    ``,
    `☀️ <b>Energy</b>`,
    `  Production:    ${s.productionKwh} kWh`,
    `  Consumption:   ${s.consumptionKwh} kWh`,
    `  Net:           ${netSign}${s.netEnergyKwh} kWh ${s.netEnergyKwh >= 0 ? "(surplus)" : "(deficit)"}`,
    `  Excess export: ${s.excessEnergyKwh} kWh`,
    `  Grid import:   ${s.energyDeficitKwh} kWh`,
    ``,
    `🔋 <b>Battery</b>`,
    `  Avg: ${s.avgBatteryPct}%  |  Min: ${s.minBatteryPct}%  |  Max: ${s.maxBatteryPct}%`,
    `  Day change:    ${battChange}  (${s.startBatteryPct}% → ${s.endBatteryPct}%)`,
    ``,
    `⚡ <b>Efficiency</b>`,
    `  Self-Consumption:  ${s.selfConsumptionRatioPct}%`,
    `  Self-Sufficiency:  ${s.selfSufficiencyRatioPct}%`,
    ``,
    `📈 <b>Peak</b>`,
    `  ☀️  Production:  ${s.peakProductionKw} kW at ${s.peakProductionTime}`,
    `  🏡 Consumption: ${s.peakConsumptionKw} kW at ${s.peakConsumptionTime}`,
    `  Avg prod/cons: ${s.avgProductionKw} / ${s.avgConsumptionKw} kW`,
    `  Production hrs: ${s.productionHours}h (>100 W)`,
    ``,
    `🚨 Outage records: ${s.outageCount}`,
    `📊 Data points: ${s.recordCount}`,
  ].join("\n");
};
