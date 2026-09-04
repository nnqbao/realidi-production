import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("cleanup orphan storage", { hours: 6 }, internal.files.cleanupOrphans, {});

export default crons;
