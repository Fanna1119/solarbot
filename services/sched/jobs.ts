import { testPower } from "../tasks/testPower";
import { allDataMessage, dailyStatsMessage } from "../telegram_bot/templates";
import { sendTelegramMessage } from "../telegram_bot/index";
import { getDailyStats } from "../../utils/db/queries/getDailyStats";

const FOUR_MINUTES = 4 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const sendDailyStats = async () => {
  // Report on the day that just ended (yesterday from current time)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const stats = await getDailyStats(yesterday);
  if (!stats) return;

  await sendTelegramMessage(
    process.env.RECIPIENT_ID ?? "",
    dailyStatsMessage(stats),
  );
};

/** Schedule callback to run at the next midnight, then every 24 h. */
const scheduleAtMidnight = (callback: () => void) => {
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setDate(nextMidnight.getDate() + 1);
  nextMidnight.setHours(0, 0, 0, 0);
  const delay = nextMidnight.getTime() - now.getTime();

  setTimeout(() => {
    callback();
    setInterval(callback, ONE_DAY_MS);
  }, delay);
};

export const startCron = () => {
  setInterval(async () => {
    const { batteryLevelNow, sunPower, consumptionNow, hasChanged } =
      await testPower();
    const message = allDataMessage(
      hasChanged.isOn,
      batteryLevelNow,
      sunPower,
      consumptionNow,
    );
    if (hasChanged.gridChange) {
      await sendTelegramMessage(process.env.RECIPIENT_ID ?? "", message);
    }
  }, FOUR_MINUTES);

  scheduleAtMidnight(sendDailyStats);
};
