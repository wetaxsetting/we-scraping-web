/**
 * Tax-agent code check — `BusinessRules §3`: 10 or 13 digits when supplied.
 *
 * Blank is valid: most declarations are filed without an agent, and §3 only
 * constrains the field "if tax agent information is provided".
 *
 * The 13-digit form is a 10-digit parent code plus a 3-digit branch suffix, so
 * lengths in between are always a typo rather than a shorter valid code.
 */
export function isValidAgentTaxCode(value: string): boolean {
    const code = value.trim();
    if (!code) return true;
    return /^\d{10}$/.test(code) || /^\d{13}$/.test(code);
}
