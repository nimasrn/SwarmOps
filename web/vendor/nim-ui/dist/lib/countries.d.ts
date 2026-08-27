/**
 * Dialling codes for every ISO 3166-1 country and territory.
 *
 * The table carries the two things a name cannot be derived from — the ISO
 * code and the calling code — and nothing else. The display name comes from
 * `Intl.DisplayNames` in the viewer's own locale, so a Persian interface lists
 * «آلمان» and an English one lists "Germany" without a second column to keep
 * in sync, and the flag is derived from the ISO code's regional indicators
 * rather than shipped as 250 images.
 */
export interface Country {
    /** Calling code without the plus: `98`, `1`, `44`. */
    dial: string;
    /** Regional-indicator flag, derived from the ISO code. */
    flag: string;
    /** ISO 3166-1 alpha-2, uppercase. */
    iso2: string;
}
export declare const COUNTRIES: Country[];
export declare function countryByIso2(iso2: string): Country | undefined;
/**
 * The country a `+…` number belongs to. Longest code wins, so `+1268`
 * (Antigua) is not read as `+1` (United States).
 */
export declare function countryByDial(e164: string): Country | undefined;
export declare function countryNamer(locale: string): (iso2: string) => string;
/**
 * Persian (۰–۹) and Arabic-Indic (٠–٩) digits to ASCII, everything else
 * dropped. Every phone and code field in the kit runs input through this: a
 * Persian keyboard types ۰۹۱۲…, and a number the viewer can read has to reach
 * the API as `+98912…`.
 */
export declare function toAsciiDigits(input: string): string;
