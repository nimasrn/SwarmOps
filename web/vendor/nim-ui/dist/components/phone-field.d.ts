export interface PhoneFieldProps {
    className?: string;
    /** ISO 3166-1 alpha-2 of the selected country, e.g. `IR`. */
    country: string;
    error?: string;
    hint?: string;
    id?: string;
    label?: string;
    /** Locale the country names are shown in. Defaults to the document's. */
    locale?: string;
    onChange: (value: string) => void;
    onCountryChange: (iso2: string) => void;
    onSubmit?: () => void;
    placeholder?: string;
    /** Countries to float above the alphabetical list — the ones most viewers
        of this product will pick. */
    priority?: string[];
    required?: boolean;
    /** Accessible names for the picker. */
    labels?: {
        pickCountry: string;
        search: string;
        noMatch: string;
    };
    /** The national number, ASCII digits only, without the dialling code. */
    value: string;
}
/**
 * Phone number entry: a country picker welded to a number input.
 *
 * The two halves are separate props on purpose. A field that owns one E.164
 * string has to re-parse it on every keystroke to know which flag to draw, and
 * gets it wrong the moment someone types a `+` themselves; keeping the country
 * and the national digits apart means `+${dial}${value}` is the whole
 * serialisation and there is nothing to guess.
 *
 * The picker lists every ISO country, named in the viewer's locale, searchable
 * by name, code, or ISO letters. The input is `dir="ltr"` in every direction —
 * a phone number reads left to right in Persian too — and Persian digits are
 * normalised to ASCII on the way in.
 */
export declare function PhoneField({ className, country, error, hint, id, label, labels, locale, onChange, onCountryChange, onSubmit, placeholder, priority, required, value, }: PhoneFieldProps): import("react").JSX.Element;
/** `+${dial}${national}` — what an auth API actually wants. */
export declare function toE164(country: string, national: string): string;
