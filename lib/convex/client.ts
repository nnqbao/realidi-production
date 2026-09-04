"use client";

import { ConvexReactClient } from "convex/react";
import { convexUrl } from "./env";

let client: ConvexReactClient | undefined;

export function getConvexClient(): ConvexReactClient {
  client ??= new ConvexReactClient(convexUrl());
  return client;
}
