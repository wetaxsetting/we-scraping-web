# ELECTRONIC APPROVAL SYSTEM DESIGN (e-Sign)

**Legal research & design document – Model · Process · Functions**
Version: 1.0 · Date: 02/07/2026

---

## Table of Contents

1. Overview & objectives
2. Vietnamese legal basis (research findings)
3. Document classification & signing requirements by law
4. Proposed e-Sign model (architecture)
5. Business process (Process)
6. Function catalog (Functions)
7. Data Model
8. Security, integrity & compliant retention
9. Implementation roadmap
10. References

---

## 1. Overview & objectives

The e-Sign system is software for electronic approval and signing of documents, replacing the traditional paper-based sign/route process with a fully digitized approval flow that carries legal value equivalent to paper documents.

**Main objectives:**

- Digitize the entire document lifecycle: creation → routing for signature → multi-level approval → electronic/digital signing → archival.
- Ensure the **legal validity** of electronic documents under the Law on E-Transactions 2023 and the Accounting Law 2015.
- Ensure **integrity** (tamper-proof after signing) and **non-repudiation**.
- Ensure **compliant retention periods** under Decree 174/2016/ND-CP (5 years / 10 years / permanent).
- Support multiple document types: accounting documents, internal documents, payment requests.

**Document scope:**

- *Accounting documents:* Accounting vouchers, Receipt vouchers, Payment vouchers, Goods receipt/issue notes, Financial statements, Statements, Payment orders.
- *Other internal documents:* Stock-count sheets, Quotations, Purchase requests, Advance requests, Acceptance minutes.
- *Special approvals:* Payment Requests.

---

## 2. Vietnamese legal basis (research findings)

### 2.1. Law on E-Transactions 2023 (Law No. 20/2023/QH15)

Effective from **01/07/2024**, replacing the 2005 Law on E-Transactions. This is the foundational legal framework for all electronic transactions, including electronic signing.

**Principle of legal validity (critical for e-Sign):** An electronic signature **shall not be denied legal validity solely because it is in electronic form**. A secure specialized electronic signature or a digital signature has **legal value equivalent to a handwritten signature** on a paper document.

**Classification of electronic signatures by scope of use** (Article 22):

| Type | Description | Application in e-Sign |
|------|-------------|------------------------|
| **Specialized electronic signature** | Created and used internally by an organization for its own activities. If it meets safety conditions, it is called a *secure specialized electronic signature*. | Signing internal documents, in-organization approvals |
| **Public digital signature** | Provided by a trust service provider (public CA) and secured by a public digital signature certificate. | Signing externally-facing documents, invoices, contracts, reports submitted to state agencies |
| **Public-duty specialized digital signature** | Used in public-duty activities, secured by a public-duty specialized certificate. | Applicable to the state agency sector |

**Conditions for an electronic/digital signature to be considered secure:**

- Authenticates the signer and confirms the signer's approval of the data message.
- The signature-creation data is uniquely linked to the signer in the context in which it is used.
- The signer maintains sole control of the signature-creation data at the time of signing.
- Any change to the data message after signing can be detected (for digital signatures, a certificate must accompany it).

### 2.2. Decree 23/2025/ND-CP on electronic signatures and trust services

Effective from **10/04/2025**, replacing Decree 130/2018/ND-CP. It provides detailed rules on electronic signatures and **trust services**.

**Three trust services** to note when designing e-Sign:

1. **Timestamping service:** attaches a trustworthy time mark to a data message — used to prove the exact signing time and prevent backdating.
2. **Data message certification service:** confirms the integrity of a data message.
3. **Public digital signature certification service:** provided by public CAs.

The Decree requires a **digital signature certificate** to contain: issuer information, subject information, certificate number, validity period, public key, scope of use, and legal liability limits. → e-Sign must store and be able to verify these fields when validating a signature.

### 2.3. Accounting Law 2015 (Law No. 88/2015/QH13)

Directly governs the **accounting documents** group.

- **Article 17 – Electronic documents:** An accounting document in electronic data form is deemed lawful when it bears an **electronic signature** as prescribed by law. An electronic document must ensure information integrity from the moment of creation and can be printed on paper or looked up when needed.
- **Article 19 – Signing accounting documents:** A document must have **complete signatures per the titles** prescribed. Signatures must be made by an authorized person or their delegate; **signing is prohibited before the content** for which the signer is responsible has been fully recorded. For cash-disbursement documents, approval from the authorized person and the chief accountant's signature are required before execution. (Paper documents: sign with non-fading ink, no red ink/pencil — this provision translates into digital-signature controls in the electronic environment.)
- **Article 41 – Retention of accounting records:** Accounting records must be retained fully and safely for the prescribed period; electronic documents may be stored on electronic media but must ensure safety, confidentiality, and retrievability.

### 2.4. Decree 174/2016/ND-CP – Retention periods for accounting documents

| Group | Minimum period | Typical document types |
|-------|----------------|-------------------------|
| Group 1 | **5 years** | Documents not directly used to record books/prepare financial statements: receipt/payment vouchers, goods receipt/issue notes not filed in the accounting set; day-to-day management documents |
| Group 2 | **10 years** | Documents directly used to record books and prepare financial statements; accounting books; monthly/quarterly/annual financial statements; settlement reports; documents on fixed-asset liquidation; capital-change documents |
| Group 3 | **Permanent** | Records of historical value, of economic/security/defense significance; settlement reports of nationally important projects |

The period runs from the end of the annual accounting period (or from completion of the transaction/task, depending on type). → e-Sign must attach an automatic **retention policy** by document type.

### 2.5. Decree 123/2020/ND-CP – Electronic invoices and documents

Applies when the system involves electronic invoices and certain electronic documents (receipts, tax-withholding vouchers). It governs digital signatures on e-invoices, format, signing time, retention, and lookup. e-Sign needs the ability to integrate or synchronize with the e-invoice system.

---

## 3. Document classification & signing requirements by law

This table determines **which signature type applies to which document type** — the foundation of the model.

| Group | Document | Signature type (actual) | Timestamp | Retention |
|-------|----------|--------------------------|-----------|-----------|
| Accounting (Misa AMIS) | Receipt / Payment voucher | Digital sign · USB Token (company seal) | Yes | ≥ 5 years |
| Accounting (Misa AMIS) | Accounting voucher (journal entry) | Digital sign · USB Token | Yes | ≥ 10 years |
| Accounting (Misa AMIS) | Financial statements | Digital sign · USB Token (legal rep + chief accountant) | Mandatory | ≥ 10 years |
| Accounting (Misa AMIS) | Goods receipt/issue note | Digital sign · USB Token | Yes | ≥ 5 years |
| Payment (WeCMS) | Vendor/Expense/Oversea Payment, Payroll, payment order | Internal approval (account identity) | System log | ≥ 5–10 years |
| Internal / Others | Stock-count sheet, Quotation, Purchase/advance request | Internal approval (account identity) | System log | Per internal policy |
| Approval | Payment request (WeCMS) | Internal approval (account identity) | System log | Tied to the resulting voucher |

**Principles for choosing signature type (per actual design):**

- **Misa AMIS accounting documents:** the input is a PDF downloaded from Misa → uploaded into the internal e-Sign → digitally signed with **USB Token (company seal)** at the final step; the digital signature appears right at the signing position on the document.
- **WeCMS payment and Internal/Others documents:** **direct on-system approval** using internal account identity (no digital signature).
- **Legal recommendation:** for payment/externally-facing documents needing high legal value (payment orders, financial statements filed with tax authorities…), consider adding a **digital signature** (preferably a public digital signature from a licensed CA) at the final approval step.

---

## 4. Proposed e-Sign model (architecture)

### 4.1. Design principles

1. **Compliance by design:** each document type carries a preset configuration of signature type, timestamp, and retention period.
2. **Integrity & immutability:** after signing, the document is "sealed" with a hash + digital signature; any change is detectable.
3. **Non-repudiation:** signing log + timestamp + signer's certificate are stored permanently with the document.
4. **Segregation of duties:** creator ≠ approver ≠ final signer (especially for cash-disbursement documents).
5. **Flexible signing flow (workflow engine):** supports sequential, parallel, and conditional signing by amount threshold.

### 4.2. Architecture layers

```
+----------------------------------------------------------+
|  PRESENTATION LAYER (Web App / Mobile / Email approval)   |
+----------------------------------------------------------+
|  BUSINESS LAYER                                           |
|  - Document Service   - Workflow/Approval Engine          |
|  - Template Service   - Notification Service              |
+----------------------------------------------------------+
|  SIGNING & TRUST LAYER                                    |
|  - Signing Service (specialized e-sig / digital sig)      |
|  - HSM / USB Token / Remote Signing / SmartCA integration |
|  - Timestamp Service (TSA)   - Hash & Integrity Service   |
|  - Certificate Validation (OCSP/CRL)                      |
+----------------------------------------------------------+
|  DATA & STORAGE LAYER                                     |
|  - Document Store (WORM)  - Audit Log  - Metadata DB      |
|  - Retention & Archival (5/10 years/permanent)            |
+----------------------------------------------------------+
|  INTEGRATION LAYER: ERP/Accounting - E-invoice - Bank -   |
|  Public CA - LDAP/SSO - Email                             |
+----------------------------------------------------------+
```

### 4.3. Core components

- **Workflow/Approval Engine:** defines and executes multi-level approval flows, routing by document type and amount threshold.
- **Signing Service:** abstracts multiple signing methods — digital signature via USB Token, HSM, remote signing (SmartCA), internal specialized electronic signature.
- **Timestamp Service:** attaches a trustworthy timestamp (per Decree 23/2025) to each signing action.
- **Integrity Service:** computes the hash (SHA-256) at signing time, packages per signing standard (PAdES for PDF, XAdES for XML/financial statements).
- **Retention Manager:** automatically applies retention periods and alerts when disposal/permanent-archival is due.
- **Audit Log:** immutable append-only record of all actions.

### 4.4. Signing & sealing formats

- PDF/A documents → signed with the **PAdES** standard (signature embedded and visible in the PDF).
- Financial statements, XML invoices → signed with the **XAdES** standard.
- Each signature includes: signer's certificate, timestamp, document hash → forming an "evidence package" stored with the document.

---

## 5. Business process (Process)

### 5.1. Document lifecycle (State Machine)

```
DRAFT
   | submit
   v
PENDING_APPROVAL ----reject----> REJECTED
   | approve (all levels)             | revise
   v                                  v
APPROVED <----------------------- DRAFT
   | sign
   v
SIGNING ----all signatures----> SIGNED (sealed)
                                    | archive
                                    v
                                ARCHIVED ----due----> DISPOSED/PERMANENT
```

Sub-states: `RECALLED` (withdrawn before signing), `CANCELLED`, `EXPIRED` (approval expired).

### 5.2. End-to-End process

1. **Creation:** The creator selects a document template → fills data / pulls data from ERP → the system assigns a document code, type, and signing configuration.
2. **Routing:** The creator submits → the Workflow Engine determines the approval flow by document type + threshold.
3. **Multi-level approval:** Each approver is notified → reviews → Approve / Reject / Request revision. Each action is logged and (if configured) approval-signed.
4. **Electronic signing:** After full approval, move to signing. Authorized signers sign digitally/electronically by title (Article 19, Accounting Law). The system computes the hash → signs → attaches a timestamp → validates the certificate (OCSP/CRL).
5. **Sealing & completion:** Package the evidence, lock immutably, generate a PDF/A with a visible signature.
6. **Archival:** Move to the WORM store, attach a retention period per Decree 174/2016.
7. **Lookup & verification:** Users/auditors look up, download the original, and re-verify the signature & integrity at any time.

### 5.3. Threshold-based approval (example: Payment Request / Payment voucher)

| Threshold | Approval flow (sequential) |
|-----------|----------------------------|
| < 10 million | Creator → Department Head → Payment Accountant (signs) |
| 10–100 million | Creator → Department Head → Chief Accountant (digital sign) → Treasurer |
| > 100 million | Creator → Department Head → Chief Accountant → **Director/Legal Representative (public digital sign)** → Treasurer |

**Segregation-of-duties constraint:** the voucher creator cannot simultaneously be the disbursement approver or the chief-accountant signer.

### 5.4. Specialized process: Financial statements

Prepare financial statements (from ERP/accounting software) → General Accountant reviews → Chief Accountant digitally signs → Legal Representative signs with public digital signature → attach timestamp → publish signed statements (PDF/A + XML) → retain for at least 10 years → ready for tax/audit submission.

### 5.5. Exception handling

- **Rejection:** returned to the creator with reasons; back to DRAFT.
- **Signing delegation:** when the signer is absent, configure a time-bound delegate (record who delegated to whom).
- **Recall:** allowed only before signing; after signing, only a new adjusting/cancellation document can be issued (the signed original is never edited — preserving integrity).

---

## 6. Function catalog (Functions)

### 6.1. Administration & master data
- F01. Manage users, departments, titles.
- F02. Role-based access control (RBAC): create / approve / sign / view / administer.
- F03. Manage signing delegation with time limits.
- F04. Manage document types and legal configuration (signature type, timestamp, retention).

### 6.2. Templates & documents
- F05. Design document templates with data zones and signature zones.
- F06. Create documents manually / from ERP / by file import.
- F07. Automatic numbering & coding by document type.
- F08. Attach supporting documents (contracts, quotations, images...).
- F09. Convert to PDF/A archival standard.

### 6.3. Workflow & approval
- F10. Design approval flows (drag-and-drop), sequential/parallel/conditional.
- F11. Route by document type & amount threshold.
- F12. Segregation-of-duties constraints.
- F13. Approve / Reject / Request revision, with comments.
- F14. Recall, cancel, extend approval.
- F15. Reminders, notifications (email/app/SMS), escalation on overdue.

### 6.4. Electronic signing & trust
- F16. Digital signing (USB Token, HSM, remote/SmartCA).
- F17. Secure specialized electronic signing (internal).
- F18. Batch signing of multiple documents.
- F19. Timestamping (TSA) per Decree 23/2025.
- F20. Compute & store integrity hash (SHA-256), package PAdES/XAdES.
- F21. Certificate validity check (OCSP/CRL) before signing.
- F22. Re-verify signature & integrity of signed documents.
- F23. Visual signature display on the PDF (seal, signature, time).

### 6.5. Archival & lookup
- F24. WORM archive (tamper-/deletion-proof).
- F25. Assign & enforce retention policy (5/10 years/permanent).
- F26. Alerts when disposal / permanent-transfer is due.
- F27. Advanced search (by type, number, signer, time, value).
- F28. Export, print, download the original + evidence package.

### 6.6. Control, compliance & reporting
- F29. Immutable audit log (append-only).
- F30. Reports on approval status, processing time, backlog.
- F31. KPI dashboard (average approval time, documents by status).
- F32. Compliance reports for audit/inspection.

### 6.7. Integration
- F33. API/Connector with accounting software/ERP (two-way).
- F34. E-invoice integration (Decree 123/2020).
- F35. Public CA & trust service integration.
- F36. Bank integration (payment orders/payments).
- F37. SSO/LDAP/Active Directory, multi-factor authentication (MFA).

---

## 7. Data Model (condensed)

| Entity | Key fields |
|--------|------------|
| **Document** | id, doc_code, doc_type, status, amount, created_by, created_at, retention_class, hash, current_version |
| **DocumentType** | id, name, group (ACCOUNTING/INTERNAL/APPROVAL), required_signature_type, need_timestamp, retention_years |
| **WorkflowInstance** | id, document_id, template_id, current_step, status |
| **ApprovalStep** | id, workflow_id, step_no, approver_id, role, action, comment, acted_at |
| **Signature** | id, document_id, signer_id, sig_type, certificate_info, timestamp, hash_signed, sig_format (PAdES/XAdES), sig_value |
| **Delegation** | id, from_user, to_user, scope, valid_from, valid_to |
| **AuditLog** | id, actor, action, object_id, ip, user_agent, at (append-only) |
| **RetentionPolicy** | doc_type, retention_years, disposal_action |

---

## 8. Security, integrity & compliant retention

- **Integrity:** SHA-256 hash at signing time; PAdES/XAdES sealing; any change invalidates the signature → detectable (meets the safety conditions of the 2023 E-Transactions Law & Article 17 of the Accounting Law).
- **Non-repudiation:** store the signer's certificate + trustworthy timestamp + audit log → prove who signed, what, and when.
- **Access control:** RBAC + MFA; encrypt data at-rest and in-transit (TLS).
- **WORM storage:** guarantees no editing/deletion within the statutory period; periodic backups, disaster recovery (DR) plan.
- **Automatic retention:** apply 5/10-year/permanent labels at creation by document type; disposal log with approval.
- **Retrievability & printing:** electronic documents must be printable and retrievable when requested by a competent authority (Article 17, Accounting Law).

---

## 9. Implementation roadmap (proposed)

| Phase | Content | Outcome |
|-------|---------|---------|
| Phase 1 – Foundation | User/template administration, workflow engine, internal signing (specialized e-sig) | Approve & sign internal documents (stock counts, quotations, requests) |
| Phase 2 – Digital signature & accounting | Public CA integration, timestamp, PAdES/XAdES, accounting documents | Receipt/payment vouchers, accounting vouchers, payment requests |
| Phase 3 – Integration & financial statements | ERP/invoice/bank integration, signing financial statements, WORM archive | Full operation, audit-ready |
| Phase 4 – Optimization | Batch signing, mobile, dashboard, remote signing | Improved experience & productivity |

---

## 10. References

- Law on E-Transactions 2023 (Law No. 20/2023/QH15) — effective 01/07/2024.
- Decree 23/2025/ND-CP on electronic signatures and trust services — effective 10/04/2025.
- Accounting Law 2015 (Law No. 88/2015/QH13) — Articles 17, 19, 41.
- Decree 174/2016/ND-CP guiding the Accounting Law — retention periods for accounting documents.
- Decree 123/2020/ND-CP on electronic invoices and documents.

> *Note: This document is a compilation for software design and does not replace formal legal advice. Before implementation, review with legal/audit experts and update to the latest legislation, and choose a Ministry-licensed digital-signature certification authority (CA).*
