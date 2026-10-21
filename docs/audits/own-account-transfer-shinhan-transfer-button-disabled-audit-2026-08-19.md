# Own Account Transfer — Shinhan VN Rows Show "Bank login credentials were deleted" and the Transfer Button Is Disabled — Audit

**Date:** 2026-08-19
**Type:** AUDIT / INVESTIGATION
**Current Work Classification:** AUDIT
**Finding Classification:** NO DEFECT on the observed gate + tooltip (correct response to a deleted credential) · ISSUE — accounts left pointing at a deleted SEQ_NO by the credential-delete path · BUG B3 (cert resolved without bank_cd — lockout hazard) · BUG B2 (bank-level row gate) · B1 withdrawn
**Investigation Status:** COMPLETE
**Approval Status:** PENDING
**Implementation Status:** NOT STARTED
**Status:** COMPLETE — investigation only; root cause CONFIRMED (M1); two earlier classifications corrected in-record; implementation NOT approved
**Repository:** wecms-web
**Issue:** —

## Observed Behavior

On LOCAL (`localhost:3000/banking/transfer-own-accounts`), with the **Shinhan VN** bank filter
selected, all four rows render a **disabled Transfer button**. Hovering it shows:

```
Bank login credentials were deleted. Please register Login Credentials again.
```

Two of the rows carry `Last Refresh = Success` with real balances (SHB 4690 → `3.553.015`,
SHB 2658 → `3.000.000.000`), so the accounts themselves are live in the list.

The reporter states the Shinhan login credentials **are already saved in the database** via the
Settings → Login Credentials flow, so the message appears wrong.

## Expected Behavior

Either:

- the Transfer button is enabled for Shinhan rows whose bank credentials really are registered, **or**
- if some credential the transfer needs is genuinely missing, the message names *that* condition
  accurately rather than claiming the credentials were "deleted".

## Scope of this audit

- What exactly gates the Transfer button on the source-accounts table, and which field drives the
  `own_account_transfer.no_credentials_tooltip` message.
- Where those fields come from: the `/source-accounts` wire contract → mapper → row type.
- Whether the refactor reads the same credential linkage legacy uses, and whether "saved in
  Settings → Login Credentials" populates the field this screen checks.
- Whether this is a frontend gate defect, a backend contract gap, or correct behaviour for the
  current data.

## Out of scope

- Any code change — this record is investigation only (CLAUDE.md §16, class A). Implementation
  waits for a human decision.
- The engine session-reuse work (separate, already committed as `704ade7`).

## Initial Evidence (orientation only — before the investigation)

- The message is the locale key `own_account_transfer.no_credentials_tooltip`
  (`locales/en.json:2775`).
- Its only consumer is
  [components/banking/own-account-transfer/source-accounts-columns.tsx](../../components/banking/own-account-transfer/source-accounts-columns.tsx).

## Investigation Plan

1. Read `source-accounts-columns.tsx` — the exact condition behind the disabled button + tooltip.
2. Follow the field it reads back through `types.ts` → `mappers.ts` → the `/source-accounts` wire
   type, and establish whether the backend sends it.
3. Check what the Settings → Login Credentials flow actually writes, and whether the transfer
   screen reads the same linkage.
4. Compare against legacy JEX (`trns_0001_001` / `trns_0001_007` source-list query) to see which
   column legacy uses to decide a row is transferable.
5. Classify the finding: BUG (frontend gate wrong) · ISSUE (backend contract / data gap) ·
   NO DEFECT (correct for this data).

## Frontend Trace (verified in source)

```
SourceAccountsTable.tsx:163   hasCredentials: banksWithCredentials.has(row.bankCd)
        ↑
OwnAccountTransferPage.tsx:265-271
        banksWithCredentials = { row.bankCd | hasSavedBankCert(row) }     ← BANK-level set
        ↑
lib/nxisas/jexjs-adapter.ts:520-523
        hasSavedBankCert = Boolean(bankCertSeq && loginID && loginPWD)    ← ALL THREE required
        ↑
components/banking/own-account-transfer/mappers.ts:63-67
        bankCertSeq ← bank_cert_seq
        loginID     ← cert_info_con
        loginPWD    ← cert_info_detl_con        (decrypted server-side)
```

`SourceAccountsTable.tsx:265` then computes
`disabled = !row.canTransfer || !engineReady || !hasCredentials`, and shows the
`no_credentials_tooltip` **only** when `!hasCredentials` — so the observed tooltip proves the
gate failed on the credential triplet, not on permission (`canTransfer`) and not on engine
readiness.

**All four Shinhan rows are disabled**, and the set is bank-level (ANY row with a full triplet
enables the whole bank) — therefore **no Shinhan row resolves a complete triplet**.

## Backend / Contract Trace (verified in source)

`wecms-api` → `OwnAccountTransferService`:

- `:195-198` — the cert lookup is **per account**:
  `ACCT_MSTR.BANK_CERT_SEQ → BANK_CERT_INFO.SEQ_NO`.
- `:209` — `cert = a.getBankCertSeq() == null ? null : certBySeq.get(...)`, so a null or
  unmatched `BANK_CERT_SEQ` yields a null cert and **all five cert fields project as null**.
- `:846` — the login password uses **`decryptPasswordOrNull`** (STRICT): a blob that does not
  decrypt under the legacy cipher projects as `null` rather than being echoed. Its Javadoc says
  verbatim: *"corrupt row, or one written by the retired AES-GCM cipher … Without this, the
  ciphertext was forwarded to the bank as the password, surfacing as an opaque institution error
  (**Shinhan `8000FFFF`**). Cure for a logged failure: **re-save the credential via Settings >
  Login Credentials**."* It logs a WARN when this fires.

`AccountRegistrationService:164` / `:195` — **`BANK_CERT_SEQ` is written only for the accounts
the user actually ticks in the Login-Credentials "Select Bank Accounts" step**
(`for (… req.accounts())`). Saving a credential alone links nothing.

`grep setBankCertSeq(null)` → **no hits anywhere**: deleting a credential
(`DELETE /api/v1/…/bank-credentials/{seqNo}`) removes the `BANK_CERT_INFO` row but leaves
`ACCT_MSTR.BANK_CERT_SEQ` pointing at a seq that no longer exists.

## Root Cause — three distinct states collapse into one message

The tooltip fires on `loginPWD` / `bankCertSeq` / `loginID` being falsy, which happens in **three
different situations** that the UI cannot currently distinguish:

| | State | DB condition | What the user did |
|---|---|---|---|
| **S1** | Never linked | `ACCT_MSTR.BANK_CERT_SEQ IS NULL` | Accounts exist (Bank Account Management / seed / other path) but were never registered through the Login-Credentials Account Picker for Shinhan |
| **S2** | Genuinely deleted | `BANK_CERT_SEQ` points to a `SEQ_NO` no longer in `BANK_CERT_INFO` | The credential was deleted (the only case the tooltip's wording actually describes) |
| **S3** | Undecryptable password | Cert row exists + linked, but `CERT_INFO_DETL_CON` fails **strict** decrypt → `loginPWD = null` | Credential was written under the retired AES-GCM cipher (or is legacy-foreign), so the refactor cannot decrypt it. Backend logs a WARN. Cure: **re-save it** |

**Given the reporter's statement that the Shinhan credential is saved in the DB, S2 is unlikely
and the live cause is S1 or S3.** Two corroborating details point toward S3:

- The backend's own Javadoc singles out **Shinhan** as the bank where this manifested before the
  strict-decrypt guard was added.
- Two Shinhan rows show `Last Refresh = Success (3 weeks ago)` with real balances — a scrape did
  resolve a working credential at some point, which fits "the stored blob later stopped
  decrypting" better than "was never linked". (Suggestive, not proof — the refresh could have come
  from another path.)
- Workspace memory `project_cert_info_cipher_incompatible` records the cert cipher as legacy
  pgcrypto (AES-256-CBC / zero-IV / `sha256('wabooksvn')`), i.e. exactly the mismatch S3 describes.

**Finding Classification:** the *data* condition is an **ISSUE** (environment / credential-data
state, not a code defect) — pending the one check below to say which of S1 / S3. Two **BUG**-class
frontend defects were found alongside it, independent of the data cause:

- **B1 — the message asserts a history it cannot know.** "Bank login credentials were deleted"
  is correct only for S2. In S1 it should say the accounts are not registered against a credential;
  in S3 it should say the saved credential must be re-saved. Today all three read as "deleted",
  which is why this looked wrong to the reporter.
- **B2 — bank-level gate vs per-account data.** `banksWithCredentials` is keyed by `BANK_CD`
  (ANY row with a triplet enables the bank), but the linkage and the composer's own pre-flight
  (`hasSavedBankCert(currentSource)`) are per **account**. A bank with one linked account therefore
  shows an enabled Transfer button on its *unlinked* accounts too, and the user only hits the wall
  after opening the composer — with a *different* message.

## The one check that settles S1 vs S3 — no DB access needed

Open DevTools → Network on `/banking/transfer-own-accounts`, inspect the
`…/own-account-transfer/source-accounts` response, and read a Shinhan row:

| Response shape | State | Cure |
|---|---|---|
| `bank_cert_seq: null` | **S1** | Register those accounts through Settings → Login Credentials → Shinhan → Select Bank Accounts |
| `bank_cert_seq` set, `cert_info_con: null` | **S2** | The credential row is gone — re-create it |
| `bank_cert_seq` set, `cert_info_con` set, `cert_info_detl_con: null` | **S3** | **Re-save** the Shinhan credential (re-encrypts under the legacy cipher) |

For S3 the backend log also carries, verbatim:
`oat source-row login password failed strict decrypt — credential is not legacy-cipher ciphertext (re-save via Settings > Login Credentials)`.

*(I could not run this check myself: it needs the running app / backend log, and the Postgres MCP
servers are disconnected in this session, so no DB verification was possible.)*

## CORRECTION (2026-08-19, after the reporter supplied the real response)

**My first classification was wrong and is withdrawn.** I listed three candidate states and leaned
**S3** (undecryptable password). The reporter's DevTools capture of
`GET …/own-account-transfer/source-accounts?bank_cd=11704088` shows the opposite:

```json
{ "bank_cd": "11704088", "acct_no": "700022499445", "acct_nick_nm": "SHB 9445",
  "can_transfer": true,
  "bank_cert_seq":       "1",      ← SET, not null
  "cert_info_con":       null,
  "cert_info_detl_con":  null,
  "cert_info_detl_con2": null,
  "nxisas_gb_seq_no":    null }
```

…identical on `703012365769` (SHB 5769), and `bank_cert_info` **does** hold a row for
`biz_key='VN_VNM0004_000001'` + `bank_cd='11704088'`.

Two things were wrong in my table:

1. **I never verified `bank_cert_seq` was null — I asked, and it isn't.** The "S1 / never linked"
   branch does not apply: every Shinhan account carries `BANK_CERT_SEQ = 1`.
2. **My S2 row ("credential row is gone") was incomplete.** `cert_info_con: null` with
   `bank_cert_seq` set does *not* only happen when the credential was deleted. It happens whenever
   the **seq lookup misses**, and the row can be perfectly present while the lookup still misses.
   That is the state you are in.

**Also withdrawn: the strict-decrypt theory (S3).** Strict decrypt nulls **only**
`cert_info_detl_con` (the password). Here `cert_info_con` — the login **ID**, which is never
decrypted, just copied — is null too, along with `cert_info_detl_con2` and `nxisas_gb_seq_no`.
That combination cannot be produced by a decrypt failure; it means the projected `cert` object was
`null` (or every one of its four columns is null in the DB).

Sorry for the noise — you were right to push back.

## What the payload narrows it to

`OwnAccountTransferService`:

```java
// :193-197
final Map<BigDecimal, BankCertInfo> certBySeq = loadBankCerts(bizKey, rows);

// :209-211
final BankCertInfo cert = a.getBankCertSeq() == null
        ? null
        : certBySeq.get(BigDecimal.valueOf(a.getBankCertSeq()));   // ← miss ⇒ all 5 fields null

// :897-912  loadBankCerts
wantedSeqs.add(BigDecimal.valueOf(a.getBankCertSeq()));            // Long → scale 0, always
final List<BankCertInfo> all = bankCertInfoRepo.findByBizKeyOrderBySeqNoAsc(bizKey);  // biz_key ONLY
for (BankCertInfo b : all) {
    if (b.getSeqNo() != null && wantedSeqs.contains(b.getSeqNo())) {   // BigDecimal.equals → scale-sensitive
        bySeq.put(b.getSeqNo(), b);
    }
}
```

Field types (`AcctMstr:89-91`, `BankCertInfo:55-57`):

```java
@JdbcTypeCode(SqlTypes.NUMERIC)
@Column(name = "BANK_CERT_SEQ", precision = 10, scale = 0)
private Long bankCertSeq;          // → BigDecimal.valueOf(1L) = 1, scale 0

@Id @Column(name = "SEQ_NO", nullable = false, precision = 10, scale = 0)
private BigDecimal seqNo;          // ← scale comes from the REAL column, not the annotation
```

`precision/scale` on `@Column` only drives DDL generation, and this project runs
`ddl-auto: validate` with Flyway disabled (`project_flyway_disabled_ddl_validate`) — so the live
column decides the scale Hibernate returns.

### Three mechanisms remain, all consistent with the observed payload

| | Mechanism | Nature | How to confirm |
|---|---|---|---|
| **M1** | No `bank_cert_info` row has `SEQ_NO = 1` for this tenant — the Shinhan cert carries a different `SEQ_NO`, so the accounts point at a seq that isn't there. | **ISSUE** — data linkage | `seq_no` of the Shinhan cert row ≠ `1` |
| **M2** | A `SEQ_NO = 1` row exists, but its `BigDecimal` scale ≠ 0 (e.g. stored/returned as `1.0`), so `wantedSeqs.contains(...)` and the map key both miss. `BigDecimal` as a `HashMap` key + `equals` is scale-sensitive. | **BUG (backend)** — `wecms-api` | `scale(seq_no) <> 0` in Postgres |
| **M3** | The `SEQ_NO = 1` row is found, but `CERT_INFO_CON`, `CERT_INFO_DETL_CON`, `CERT_INFO_DETL_CON2` **and** `NXISAS_GB_SEQ_NO` are all NULL in the DB (a half-created credential). | **ISSUE** — data | those four columns are NULL in your `select *` |

### The query that settles it (I cannot run it — see below)

```sql
-- 1) which seq does Shinhan's credential actually carry, and at what scale?
select seq_no,
       scale(seq_no)          as seq_scale,
       bank_cd,
       cert_info_con,
       (cert_info_detl_con  is not null) as has_password,
       (cert_info_detl_con2 is not null) as has_detl2,
       nxisas_gb_seq_no
from   bank_cert_info
where  biz_key = 'VN_VNM0004_000001'
order  by seq_no;

-- 2) what do the Shinhan accounts point at?
select distinct bank_cert_seq
from   acct_mstr
where  biz_key = 'VN_VNM0004_000001'
  and  bank_cd = '11704088';
```

Read it as:

- **no `seq_no = 1` in result 1** → **M1**. The accounts' `BANK_CERT_SEQ = 1` is stale/foreign.
  Cure: re-register the four Shinhan accounts through Settings → Login Credentials → Shinhan →
  Select Bank Accounts, which rewrites `BANK_CERT_SEQ` to the real seq
  (`AccountRegistrationService:164`).
- **`seq_no = 1` present with `seq_scale <> 0`** → **M2**, a backend defect. Cure in code: compare
  by value (`compareTo == 0`), or key the map on `Long` / `seqNo.longValueExact()`, or
  `stripTrailingZeros()` both sides. A data-side workaround also exists (re-store the seq at scale
  0) but the code should not depend on scale at all.
- **`seq_no = 1`, `seq_scale = 0`, `bank_cd = '11704088'`, and `cert_info_con` NULL** → **M3**, a
  half-written credential row; re-save it through Settings → Login Credentials.

**I could not run this myself:** both Postgres MCP servers (`postgres_dev_server_jexframe`,
`postgres_dev_server_refactor`) disconnected during this session, so I have no DB access. Every
statement above about the DB is therefore a *prediction from the code + your payload*, not a
verified reading — which is exactly the distinction I got wrong the first time.

## Separate latent BUG found while reading the join — B3 (cross-bank cert attach)

`loadBankCerts` queries `findByBizKeyOrderBySeqNoAsc(bizKey)` — **`bank_cd` is never part of the
lookup**, and `:209` matches on `SEQ_NO` alone. So if `SEQ_NO = 1` in this tenant belongs to a
*different* bank (say Vietcom), a Shinhan account pointing at seq 1 would silently be projected
with **Vietcom's login ID and password**.

That is worse than the current symptom: instead of a disabled button, the engine would attempt a
**Shinhan login using Vietcom credentials** — a guaranteed authentication failure against the bank,
and therefore a direct contributor to the 3-strike lockout risk you raised earlier. It has not
fired here (the fields came back null, so nothing matched), but the guard is missing.

Recommended (backend, needs its own `wecms-api` record): filter the cert by
`biz_key + seq_no + bank_cd`, or assert `cert.getBankCd().equals(a.getBankCd())` before projecting
and treat a mismatch as no-cert.

## CONFIRMED FINDING (2026-08-19) — M1, and the reporter's hypothesis is the mechanism

The reporter's `bank_cert_info` query for `biz_key='VN_VNM0004_000001'` returns 17 rows whose
`seq_no` runs **2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18** — with
`bank_cd = 11704088` (Shinhan) at **`seq_no = 18`**, `has_password = [v]`,
`nxisas_gb_seq_no = 0`.

**There is no `seq_no = 1`.** The four Shinhan accounts carry `BANK_CERT_SEQ = 1` (visible in the
`/source-accounts` payload). So the lookup at `OwnAccountTransferService:209` misses because the
row it points at **no longer exists**.

That also closes the other two candidates:

| | Verdict | Evidence |
|---|---|---|
| **M1** — accounts point at a deleted seq | **CONFIRMED** | `seq_no` list starts at 2; accounts hold `1` |
| **M2** — `BigDecimal` scale mismatch | **RULED OUT** | every row reports `seq_scale = 0` |
| **M3** — half-written credential row | **RULED OUT** | every row has `has_password = [v]`; Shinhan seq 18 also has `nxisas_gb_seq_no = 0` |

### The reporter's hypothesis — verified in code

> *"user deleted information in page Login Credentials … system will delete UserName/Password from
> the table but the account No not delete from table."*

Exactly right, and both halves are verifiable:

- `BankCredentialService:77-79` — `delete(seqNo)` is `repository.delete(loadOrThrow(seqNo))`.
  It removes the `BANK_CERT_INFO` row **and touches nothing in `ACCT_MSTR`**.
- `grep -rn "setBankCertSeq(null)"` across `src/main/java` → **no hits anywhere**. Nothing in the
  codebase ever clears the linkage.

So the full sequence that produced this screen:

```
1. Register Shinhan (WEBCASH01 / password)      → BANK_CERT_INFO.SEQ_NO = 1
   Account Picker saves the scraped accounts     → ACCT_MSTR.BANK_CERT_SEQ = 1
                                                    (700022499445, 700022964690, …)
2. Delete that credential in Settings            → BANK_CERT_INFO seq 1 REMOVED
                                                 → ACCT_MSTR.BANK_CERT_SEQ still = 1  (dangling)
3. Register Shinhan again later                  → new row gets SEQ_NO = 18
                                                 → accounts were NOT re-linked (still 1)
4. Own Account Transfer loads                    → certBySeq.get(1) → miss → cert = null
                                                 → all 5 cert fields null
                                                 → hasSavedBankCert = false
                                                 → Transfer disabled + "credentials were deleted"
```

### Therefore the current behaviour is CORRECT — B1 is withdrawn for this state

The gate is right (the transfer needs a bank login, and no usable credential resolves for these
accounts), and the message is **accurate**: the credential these accounts point at *was* deleted,
and the cure it names — register Login Credentials again — is the right instruction.

**B1 (message wording) is withdrawn as a defect for this case.** It survives only as a narrow
nicety for the two states this screen can also reach (never-linked accounts, half-written row),
where "were deleted" would be the wrong history. Low value; not worth a change on its own.

### Actionable cure for the reporter — re-saving the credential is NOT enough

`AccountRegistrationService:164` / `:195` writes `BANK_CERT_SEQ` **only for the accounts passed in
`req.accounts()`** — i.e. only the accounts ticked in the **Select Bank Accounts** step. The
Shinhan credential already exists at seq 18, so:

> Settings → Login Credentials → Shinhan (11704088) → **complete the Select Bank Accounts step**,
> ticking 700022499445 / 700022964690 / 703012202658 / 703012365769.

That rewrites their `BANK_CERT_SEQ` from `1` → `18` and the Transfer button re-enables. Saving or
editing the credential row alone will never re-link existing accounts.

### Remaining findings (unchanged in substance, re-prioritised)

> **Status update — ISSUE-1 and B3 are both FIXED (2026-08-19), B2 is fixed on the frontend.** This
> audit is preserved as the point-in-time investigation; the findings below are its original text and
> are **not** edited to read as resolved. What happened after it:
>
> | Finding | Outcome |
> |---|---|
> | **ISSUE-1** — delete leaves a dangling `BANK_CERT_SEQ` | **FIXED** in `wecms-api` — both delete endpoints now clear the linkage in the same transaction. The reported rows were already dangling, so they still need the Account-Picker re-run. |
> | **B3** — cross-bank cert attach | **FIXED** in `wecms-api` — `BANK_CD` equality guard on cert resolution; a cross-bank cert is treated as no-cert. |
> | **B2** — bank-level gate vs per-account linkage | **FIXED** in `wecms-web` — per-account predicate. |
> | **B1** — tooltip wording | withdrawn, still open as low-priority copy work. |
>
> Backend record: `wecms-api/docs/bugs/bank-credential-delete-leaves-dangling-acct-linkage-2026-08-19.md`.
> Frontend record: [../bugs/own-account-transfer-credential-gate-per-account-parity-2026-08-19.md](../bugs/own-account-transfer-credential-gate-per-account-parity-2026-08-19.md).
> An audit reaching `COMPLETE` never meant the defects were fixed — this box is where that separation
> is recorded.

- **ISSUE-1 (backend) — the delete path leaves a dangling `BANK_CERT_SEQ`.** After step 2 the DB
  holds a pointer to a row that does not exist. Clearing `ACCT_MSTR.BANK_CERT_SEQ` for that bank's
  accounts when a credential is deleted would make the state honest (`NULL` = not linked) and would
  make the UI's three states distinguishable in data rather than only by inference. Backend-owned,
  needs its own `wecms-api` record.
- **B3 (backend) — cross-bank cert attach.** `loadBankCerts` resolves by `biz_key + SEQ_NO` only;
  `bank_cd` is never checked (`OwnAccountTransferService:209`, repo call at `:905`). `SEQ_NO` is
  **tenant-global** — this tenant's 17 rows share one sequence across 17 different banks — so a
  dangling pointer landing on a number later occupied by *another bank's* credential would silently
  project that bank's login ID + password onto these Shinhan accounts. The engine would then attempt
  a **Shinhan login with another bank's credentials**: a guaranteed authentication failure and a
  direct contributor to the 3-strike lockout risk. Not firing today (nothing matches seq 1), but the
  guard is missing and ISSUE-1 is what would create the collision. **Fix regardless of ISSUE-1:**
  match on `biz_key + seq_no + bank_cd`, or assert `cert.bankCd == account.bankCd` before projecting.
- **B2 (frontend) — bank-level gate vs per-account linkage.** `banksWithCredentials` is keyed by
  `BANK_CD`, so one linked account enables Transfer for **every** account of that bank, and the
  composer's per-row `hasSavedBankCert` pre-flight then blocks with a different message. Not visible
  in this case (all four Shinhan accounts share the same stale seq), but it is a real inconsistency:
  the row gate should use `hasSavedBankCert(row)`.

## Final Classification

| Item | Class | Owner |
|---|---|---|
| Observed symptom (disabled button + tooltip) | **NO DEFECT** — correct response to a deleted credential | — |
| Accounts still pointing at a deleted `SEQ_NO` | **ISSUE** (data state, produced by ISSUE-1) | data / cured by re-running the Account Picker |
| ISSUE-1 — delete leaves dangling `BANK_CERT_SEQ` | **ISSUE** | `wecms-api` |
| B3 — cert resolved without `bank_cd` | **BUG** (lockout hazard) | `wecms-api` |
| B2 — bank-level row gate | **BUG** (minor, consistency) | `wecms-web` |
| B1 — tooltip wording | **WITHDRAWN** for this state | — |

## Verification status

- Code: verified by reading `OwnAccountTransferService` (`:193-211`, `:838-912`),
  `AccountRegistrationService` (`:120-200`), `BankCredentialService` (`:77-79`), plus the two entity
  mappings and a repo-wide `setBankCertSeq(null)` grep.
- Data: verified from the reporter's own `bank_cert_info` result and the `/source-accounts` payload.
  **I still have no DB access this session** (both Postgres MCP servers disconnected) — every DB
  statement above is read from the reporter's output, not queried by me.
- Nothing was implemented. No source file was modified by this audit.
