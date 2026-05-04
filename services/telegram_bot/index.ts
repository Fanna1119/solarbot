import { Bot } from "gramio";
import { readFileSync } from "fs";
import { resolve } from "path";
import { testPower } from "../tasks/testPower";
import { allDataMessage, dailyStatsMessage } from "./templates";
import { getAllGridData } from "../../utils/db/queries/getAllData";
import { getDailyStats } from "../../utils/db/queries/getDailyStats";

const token = process.env.TELEGRAM_TOKEN ?? "";

export const bot = new Bot(token);

export const sendTelegramMessage = async (
  chatId: string | number,
  message: string,
): Promise<void> => {
  await bot.api.sendMessage({
    chat_id: chatId,
    text: message,
    parse_mode: "HTML",
  });
};

bot.command("now", async (context) => {
  const { batteryLevelNow, sunPower, consumptionNow, hasChanged } =
    await testPower();
  const message = allDataMessage(
    hasChanged.isOn,
    batteryLevelNow,
    sunPower,
    consumptionNow,
  );
  await context.send(message);
});

bot.command("debug", async (context) => {
  const status = await testPower();
  await context.send(JSON.stringify(status));
});

bot.command("outages", async (context) => {
  const allData = await getAllGridData();
  const outages = allData.filter(
    (data: { status: any }) => Number(data.status) === 0,
  );
  const last = outages.at(-1)?.timestamp;
  const message = `📊 ${outages.length} outages since ${
    last ? new Date(Number(last)).toLocaleString() : "unknown"
  }`;
  await context.send(message);
});

bot.command("dump", async (context) => {
  const dbUrl = process.env.DATABASE_URL ?? "file:./database/app.sqlite";
  const dbPath = resolve(dbUrl.replace(/^file:/, ""));
  try {
    const buffer = readFileSync(dbPath);
    await context.sendDocument(
      new File([buffer], "solarbot.sqlite", {
        type: "application/octet-stream",
      }),
      { caption: `🗄 DB dump — ${new Date().toLocaleString()}` },
    );
  } catch (err) {
    await context.send(`❌ Could not read database: ${err}`);
  }
});

bot.command("stats", async (context) => {
  // Accept optional argument: "yesterday" or a number of days ago (1–7)
  const arg = context.text?.split(" ")[1]?.trim().toLowerCase();
  let daysAgo = 0;
  if (arg === "yesterday") {
    daysAgo = 1;
  } else if (arg && /^\d+$/.test(arg)) {
    daysAgo = Math.min(Math.max(parseInt(arg, 10), 0), 7);
  }

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - daysAgo);

  const stats = await getDailyStats(targetDate);
  if (!stats) {
    await context.send("📭 No data found for that day.");
    return;
  }
  await context.send(dailyStatsMessage(stats), { parse_mode: "HTML" });
});
