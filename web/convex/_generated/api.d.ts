/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as bot from "../bot.js";
import type * as botInternal from "../botInternal.js";
import type * as botSettings from "../botSettings.js";
import type * as brokerCredential from "../brokerCredential.js";
import type * as brokerCredentialActions from "../brokerCredentialActions.js";
import type * as brokerSync from "../brokerSync.js";
import type * as brokerSyncActions from "../brokerSyncActions.js";
import type * as crons from "../crons.js";
import type * as engineData from "../engineData.js";
import type * as http from "../http.js";
import type * as lib_adminAuth from "../lib/adminAuth.js";
import type * as lib_billing from "../lib/billing.js";
import type * as lib_brokerCrypto from "../lib/brokerCrypto.js";
import type * as lib_defaultBotSettings from "../lib/defaultBotSettings.js";
import type * as lib_entitlements from "../lib/entitlements.js";
import type * as lib_founderSubscription from "../lib/founderSubscription.js";
import type * as lib_internalSecret from "../lib/internalSecret.js";
import type * as lib_strategyDefaults from "../lib/strategyDefaults.js";
import type * as lib_userBootstrap from "../lib/userBootstrap.js";
import type * as paperAccount from "../paperAccount.js";
import type * as performance from "../performance.js";
import type * as signals from "../signals.js";
import type * as strategyStats from "../strategyStats.js";
import type * as subscription from "../subscription.js";
import type * as subscriptionInternal from "../subscriptionInternal.js";
import type * as tradeActions from "../tradeActions.js";
import type * as trades from "../trades.js";
import type * as users from "../users.js";
import type * as watchlist from "../watchlist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  bot: typeof bot;
  botInternal: typeof botInternal;
  botSettings: typeof botSettings;
  brokerCredential: typeof brokerCredential;
  brokerCredentialActions: typeof brokerCredentialActions;
  brokerSync: typeof brokerSync;
  brokerSyncActions: typeof brokerSyncActions;
  crons: typeof crons;
  engineData: typeof engineData;
  http: typeof http;
  "lib/adminAuth": typeof lib_adminAuth;
  "lib/billing": typeof lib_billing;
  "lib/brokerCrypto": typeof lib_brokerCrypto;
  "lib/defaultBotSettings": typeof lib_defaultBotSettings;
  "lib/entitlements": typeof lib_entitlements;
  "lib/founderSubscription": typeof lib_founderSubscription;
  "lib/internalSecret": typeof lib_internalSecret;
  "lib/strategyDefaults": typeof lib_strategyDefaults;
  "lib/userBootstrap": typeof lib_userBootstrap;
  paperAccount: typeof paperAccount;
  performance: typeof performance;
  signals: typeof signals;
  strategyStats: typeof strategyStats;
  subscription: typeof subscription;
  subscriptionInternal: typeof subscriptionInternal;
  tradeActions: typeof tradeActions;
  trades: typeof trades;
  users: typeof users;
  watchlist: typeof watchlist;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
