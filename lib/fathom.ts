"use client";

import { invokeFunction, type FunctionResult } from "./functions";
import type { SyncResult } from "./model";

/** Checks the key with Fathom, then stores it in Supabase Vault. The key is sent once and never read back. */
export const connectFathom = (apiKey: string): Promise<FunctionResult<{ key_last4: string }>> =>
  invokeFunction("fathom", { action: "connect", api_key: apiKey });

export const disconnectFathom = (): Promise<FunctionResult<object>> => invokeFunction("fathom", { action: "disconnect" });

/** Imports new Fathom meetings; returns the new calls to analyse automatically. */
export const syncFathom = (): Promise<FunctionResult<{ result: SyncResult; analyse_call_ids: string[] }>> =>
  invokeFunction("fathom", { action: "sync" });
