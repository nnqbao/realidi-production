/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _lib_aggregates from "../_lib/aggregates.js";
import type * as _lib_audit from "../_lib/audit.js";
import type * as _lib_authz from "../_lib/authz.js";
import type * as _lib_capabilities from "../_lib/capabilities.js";
import type * as _lib_dtos from "../_lib/dtos.js";
import type * as _lib_errors from "../_lib/errors.js";
import type * as _lib_feedDto from "../_lib/feedDto.js";
import type * as _lib_feedRanking from "../_lib/feedRanking.js";
import type * as _lib_geo from "../_lib/geo.js";
import type * as _lib_placeRanking from "../_lib/placeRanking.js";
import type * as _lib_search from "../_lib/search.js";
import type * as _lib_time from "../_lib/time.js";
import type * as _lib_uniqueness from "../_lib/uniqueness.js";
import type * as _providers_EmailOtp from "../_providers/EmailOtp.js";
import type * as _providers_Password from "../_providers/Password.js";
import type * as account from "../account.js";
import type * as auth from "../auth.js";
import type * as authEmails from "../authEmails.js";
import type * as authLockout from "../authLockout.js";
import type * as catalog from "../catalog.js";
import type * as curation from "../curation.js";
import type * as discovery from "../discovery.js";
import type * as feed from "../feed.js";
import type * as flags from "../flags.js";
import type * as http from "../http.js";
import type * as places from "../places.js";
import type * as profiles from "../profiles.js";
import type * as ranking from "../ranking.js";
import type * as search from "../search.js";
import type * as seed from "../seed.js";
import type * as seed_catalog from "../seed/catalog.js";
import type * as seed_defaults from "../seed/defaults.js";
import type * as seed_editorialPlaces from "../seed/editorialPlaces.js";
import type * as sessions from "../sessions.js";
import type * as validators from "../validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "_lib/aggregates": typeof _lib_aggregates;
  "_lib/audit": typeof _lib_audit;
  "_lib/authz": typeof _lib_authz;
  "_lib/capabilities": typeof _lib_capabilities;
  "_lib/dtos": typeof _lib_dtos;
  "_lib/errors": typeof _lib_errors;
  "_lib/feedDto": typeof _lib_feedDto;
  "_lib/feedRanking": typeof _lib_feedRanking;
  "_lib/geo": typeof _lib_geo;
  "_lib/placeRanking": typeof _lib_placeRanking;
  "_lib/search": typeof _lib_search;
  "_lib/time": typeof _lib_time;
  "_lib/uniqueness": typeof _lib_uniqueness;
  "_providers/EmailOtp": typeof _providers_EmailOtp;
  "_providers/Password": typeof _providers_Password;
  account: typeof account;
  auth: typeof auth;
  authEmails: typeof authEmails;
  authLockout: typeof authLockout;
  catalog: typeof catalog;
  curation: typeof curation;
  discovery: typeof discovery;
  feed: typeof feed;
  flags: typeof flags;
  http: typeof http;
  places: typeof places;
  profiles: typeof profiles;
  ranking: typeof ranking;
  search: typeof search;
  seed: typeof seed;
  "seed/catalog": typeof seed_catalog;
  "seed/defaults": typeof seed_defaults;
  "seed/editorialPlaces": typeof seed_editorialPlaces;
  sessions: typeof sessions;
  validators: typeof validators;
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
