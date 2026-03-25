import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  formatISO,
  parse,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";

import { promptExit } from "./config.ts";
import { Config } from "../shared/types.ts";

export const getDateRange = (
  config: Pick<Config, "timeRange" | "startDate" | "endDate">,
): { startDate: string; endDate: string } => {
  const { timeRange, startDate: customStart, endDate: customEnd } = config;

  if (timeRange === "custom") {
    if (!customStart || !customEnd) {
      promptExit(
        "Both start date and end date must be provided when using custom time range.",
        1,
      );
    }

    let start = parse(customStart as string, "MM-dd-yyyy", new Date());
    start = startOfDay(start);
    let end = parse(customEnd as string, "MM-dd-yyyy", new Date());
    end = endOfDay(end);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      promptExit(
        "Invalid custom date format. Please use MM-DD-YYYY format (e.g., 12-25-2023).",
        1,
      );
    }

    const startDate = formatISO(start);
    const endDate = formatISO(end);

    console.log(`
Date Range:
  From: ${startDate}
  To:   ${endDate}`);

    return { startDate, endDate };
  }

  const today = new Date();
  let startDate: Date | string = today;
  let endDate: Date | string = today;

  switch (timeRange) {
    case "week": {
      startDate = startOfWeek(today);
      endDate = endOfWeek(today);
      break;
    }
    case "month":
      startDate = startOfMonth(today);
      endDate = endOfMonth(today);
      break;
    case "year":
      startDate = startOfYear(today);
      endDate = endOfYear(today);
      break;
    default:
      promptExit("Invalid time range specified.", 1);
  }

  startDate = formatISO(startDate as Date);
  endDate = formatISO(endDate as Date);

  console.log(`
Date Range:
  From: ${startDate}
  To:   ${endDate}`);

  return { startDate, endDate };
};
