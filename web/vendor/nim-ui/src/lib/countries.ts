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

/** `ISO2:dialling code`, packed so the source stays reviewable in one screen. */
const TABLE =
  'AD:376 AE:971 AF:93 AG:1268 AI:1264 AL:355 AM:374 AO:244 AQ:672 AR:54 AS:1684 AT:43 AU:61 ' +
  'AW:297 AX:358 AZ:994 BA:387 BB:1246 BD:880 BE:32 BF:226 BG:359 BH:973 BI:257 BJ:229 BL:590 ' +
  'BM:1441 BN:673 BO:591 BQ:599 BR:55 BS:1242 BT:975 BW:267 BY:375 BZ:501 CA:1 CC:61 CD:243 ' +
  'CF:236 CG:242 CH:41 CI:225 CK:682 CL:56 CM:237 CN:86 CO:57 CR:506 CU:53 CV:238 CW:599 CX:61 ' +
  'CY:357 CZ:420 DE:49 DJ:253 DK:45 DM:1767 DO:1809 DZ:213 EC:593 EE:372 EG:20 EH:212 ER:291 ' +
  'ES:34 ET:251 FI:358 FJ:679 FK:500 FM:691 FO:298 FR:33 GA:241 GB:44 GD:1473 GE:995 GF:594 ' +
  'GG:44 GH:233 GI:350 GL:299 GM:220 GN:224 GP:590 GQ:240 GR:30 GT:502 GU:1671 GW:245 GY:592 ' +
  'HK:852 HN:504 HR:385 HT:509 HU:36 ID:62 IE:353 IL:972 IM:44 IN:91 IO:246 IQ:964 IR:98 IS:354 ' +
  'IT:39 JE:44 JM:1876 JO:962 JP:81 KE:254 KG:996 KH:855 KI:686 KM:269 KN:1869 KP:850 KR:82 ' +
  'KW:965 KY:1345 KZ:7 LA:856 LB:961 LC:1758 LI:423 LK:94 LR:231 LS:266 LT:370 LU:352 LV:371 ' +
  'LY:218 MA:212 MC:377 MD:373 ME:382 MF:590 MG:261 MH:692 MK:389 ML:223 MM:95 MN:976 MO:853 ' +
  'MP:1670 MQ:596 MR:222 MS:1664 MT:356 MU:230 MV:960 MW:265 MX:52 MY:60 MZ:258 NA:264 NC:687 ' +
  'NE:227 NF:672 NG:234 NI:505 NL:31 NO:47 NP:977 NR:674 NU:683 NZ:64 OM:968 PA:507 PE:51 ' +
  'PF:689 PG:675 PH:63 PK:92 PL:48 PM:508 PR:1787 PS:970 PT:351 PW:680 PY:595 QA:974 RE:262 ' +
  'RO:40 RS:381 RU:7 RW:250 SA:966 SB:677 SC:248 SD:249 SE:46 SG:65 SH:290 SI:386 SJ:47 SK:421 ' +
  'SL:232 SM:378 SN:221 SO:252 SR:597 SS:211 ST:239 SV:503 SX:1721 SY:963 SZ:268 TC:1649 ' +
  'TD:235 TG:228 TH:66 TJ:992 TK:690 TL:670 TM:993 TN:216 TO:676 TR:90 TT:1868 TV:688 TW:886 ' +
  'TZ:255 UA:380 UG:256 US:1 UY:598 UZ:998 VA:39 VC:1784 VE:58 VG:1284 VI:1340 VN:84 VU:678 ' +
  'WF:681 WS:685 YE:967 YT:262 ZA:27 ZM:260 ZW:263'

export interface Country {
  /** Calling code without the plus: `98`, `1`, `44`. */
  dial: string
  /** Regional-indicator flag, derived from the ISO code. */
  flag: string
  /** ISO 3166-1 alpha-2, uppercase. */
  iso2: string
}

/** 🇮🇷 from `IR`: two regional indicator symbols, no image asset involved. */
function flagOf(iso2: string): string {
  return String.fromCodePoint(...[...iso2].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65))
}

export const COUNTRIES: Country[] = TABLE.split(' ').map((entry) => {
  const [iso2, dial] = entry.split(':')
  return { dial, flag: flagOf(iso2), iso2 }
})

const BY_ISO2 = new Map(COUNTRIES.map((country) => [country.iso2, country]))

export function countryByIso2(iso2: string): Country | undefined {
  return BY_ISO2.get(iso2.toUpperCase())
}

/**
 * The country a `+…` number belongs to. Longest code wins, so `+1268`
 * (Antigua) is not read as `+1` (United States).
 */
export function countryByDial(e164: string): Country | undefined {
  const digits = e164.replace(/\D/g, '')
  let match: Country | undefined
  for (const country of COUNTRIES) {
    if (!digits.startsWith(country.dial)) continue
    if (!match || country.dial.length > match.dial.length) match = country
  }
  return match
}

/**
 * Country names in `locale`, memoised per locale — building an
 * `Intl.DisplayNames` is not free and a picker asks for every name on each
 * keystroke.
 */
const NAME_CACHE = new Map<string, (iso2: string) => string>()

export function countryNamer(locale: string): (iso2: string) => string {
  const cached = NAME_CACHE.get(locale)
  if (cached) return cached

  let lookup: (iso2: string) => string
  try {
    const display = new Intl.DisplayNames([locale], { type: 'region' })
    lookup = (iso2) => display.of(iso2) ?? iso2
  } catch {
    lookup = (iso2) => iso2
  }
  NAME_CACHE.set(locale, lookup)
  return lookup
}

/**
 * Persian (۰–۹) and Arabic-Indic (٠–٩) digits to ASCII, everything else
 * dropped. Every phone and code field in the kit runs input through this: a
 * Persian keyboard types ۰۹۱۲…, and a number the viewer can read has to reach
 * the API as `+98912…`.
 */
export function toAsciiDigits(input: string): string {
  let output = ''
  for (const character of input) {
    const code = character.codePointAt(0) ?? 0
    if (code >= 0x06f0 && code <= 0x06f9) output += String.fromCodePoint(code - 0x06f0 + 0x30)
    else if (code >= 0x0660 && code <= 0x0669) output += String.fromCodePoint(code - 0x0660 + 0x30)
    else if (character >= '0' && character <= '9') output += character
  }
  return output
}
