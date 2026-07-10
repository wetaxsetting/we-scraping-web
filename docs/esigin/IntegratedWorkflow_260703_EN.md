# INTEGRATED e-Sign WORKFLOW — WEBCASH VIETNAM

A document unifying **Webcash's existing model** (Misa AMIS · Internal documents · WeCMS + Workflow Template builder) with the **legal compliance layer** researched (Law on E-Transactions 2023, Decree 23/2025, Accounting Law 2015, Decree 174/2016).

Version 1.0 · 02/07/2026

> **Annotation convention used in this document:**
> 🟦 = component **already existing** in the Webcash model · 🟩 = layer **added for legal compliance**.

---

## 1. Overall integrated architecture (3 sources → e-Sign Core)

```mermaid
flowchart TB
    subgraph SRC["🟦 DOCUMENT SOURCES (existing)"]
        A1["Misa AMIS<br/>Goods receipt/issue, Acct vouchers,<br/>Financial statements (PL/BS/CF), books"]
        A2["Internal documents<br/>Quotations, FA/tools liquidation,<br/>minutes, decisions"]
        A3["WeCMS<br/>Internal Transfer, Vendor Payment,<br/>Expense/Oversea Payment, Payroll"]
    end

    A1 --> P1["Lock data & export PDF"]
    A2 --> P2["Export PDF file"]
    A3 --> P3["Preview & Request Approval"]

    P1 --> CORE
    P2 --> CORE
    P3 --> CORE

    subgraph CORE["e-Sign CORE"]
        direction TB
        C0["🟦 Select Voucher/Transaction Type"]
        C1["🟩 Auto-apply legal config:<br/>signature type · timestamp · retention class"]
        C2["🟦 Upload e-Sign / normalize PDF-A"]
        C0 --> C1 --> C2
    end

    CORE --> WF["Workflow Engine<br/>(runs per Workflow Template)"]
    WF --> ARCH["🟦+🟩 WORM storage<br/>+ Retention 5/10 yrs/permanent"]
```

**Key integration point:** right after the *Select Voucher/Transaction Type* step (existing), the system **auto-attaches the legal configuration** (🟩) — deciding the signature type, whether a timestamp is required, and the retention period — based on the document type. This configuration comes from the **Workflow Template** (section 4).

---

## 2. Integrated End-to-End workflow (following Webcash's role lanes)

```mermaid
flowchart TD
    START([Document from Misa/Internal/WeCMS]) --> L1

    subgraph LANE1["🟦 DOCUMENT CREATOR"]
        L1["Login Web/App"] --> L2["Select Voucher Type"]
        L2 --> L3["🟩 System assigns: signature type,<br/>timestamp, retention class"]
        L3 --> L4["Upload e-Sign"]
        L4 --> L5["Preview & Request Approval"]
    end

    L5 --> M0{"🟩 Check segregation of duties<br/>(creator != approver/signer)"}
    M0 -- Violation --> MX["Block & alert"]
    M0 -- Valid --> L6["... Intermediate levels if any"]

    L6 --> LANE2

    subgraph LANE2["🟦 CHIEF ACCOUNTANT - Approve"]
        K1["Login Web/App"] --> K2["Preview"]
        K2 --> K3["Approve<br/>(internal account identity,<br/>batch approval)"]
    end

    K3 --> DEC{"Result?"}
    DEC -- Reject --> RJ["🟦 Reject<br/>Update reason"]
    RJ --> ENDX["End - cancelled but<br/>🟩 history + audit log retained"]

    DEC -- Approve --> LANE3

    subgraph LANE3["🟦 DIRECTOR / LEGAL REPRESENTATIVE - Digital sign"]
        G1["Login Web/App"] --> G2["Preview"]
        G2 --> G3["Digital sign<br/>USB Token / HSM / Cloud CA"]
    end

    G3 --> SIGN["🟩 Secure signing sub-process<br/>(see section 3)"]
    SIGN --> ARCH["🟦 Archive<br/>🟩 original .pdf/.xml, WORM,<br/>>=10 years or per retention class"]
    ARCH --> ENDOK([Complete])
```

**Mapping Webcash concepts ↔ legal:**

| Webcash step (existing) | Legal nature (added) |
|-------------------------|----------------------|
| Chief accountant "clicks approve, internal account identity" | Secure specialized electronic signature (authenticates signer + approval) |
| Director "digital sign USB Token/HSM/Cloud CA" | Digital signature — legal value equivalent to handwritten signature + seal |
| "Archive original file >= 10 years" | Article 41 Accounting Law + Decree 174/2016 → classify 5/10 years/permanent |
| "Reject still retains history" | Immutable audit log (non-repudiation) |

---

## 3. Sub-process — Secure digital signing (adds compliance to the "Digital sign" step)

```mermaid
sequenceDiagram
    participant GD as 🟦 Director/Legal Rep
    participant App as e-Sign App
    participant Sign as 🟩 Signing Service
    participant CA as 🟩 CA (OCSP/CRL)
    participant TSA as 🟩 Timestamp (TSA)
    participant Store as 🟦 WORM Store

    GD->>App: Digitally sign document set (USB Token/HSM/Cloud CA)
    App->>Sign: Send document + certificate
    Sign->>Sign: Compute SHA-256 hash
    Sign->>CA: Check certificate validity
    CA-->>Sign: Valid
    Sign->>Sign: Digitally sign on hash
    Sign->>TSA: Request timestamp (Decree 23/2025)
    TSA-->>Sign: Trustworthy time token
    Sign->>Sign: Seal PAdES (PDF) / XAdES (XML)<br/>+ package evidence
    Sign-->>App: Signed & sealed document
    App->>Store: Store original + evidence package
    Store-->>GD: Complete - show visual signature
```

> The four 🟩 steps (hash → OCSP/CRL → timestamp → PAdES/XAdES) are exactly the "inserted" part so that Webcash's *Digital sign* step meets the safety conditions of the 2023 E-Transactions Law.

---

## 4. Integrated Workflow Template Builder (upgrade of Webcash's "Workflow" diagram)

```mermaid
flowchart TD
    subgraph EXIST["🟦 EXISTING COMPONENTS"]
        AP["Approver<br/>Employee ID, Name, Position"]
        AL["Approval Line<br/>Configure nested approval"]
        SM["Signing Method<br/>1) Internal approval (account identity)<br/>2) Enterprise digital sign (USB/HSM/Cloud CA)"]
        TT["Transaction/Request Type<br/>WeCMS · Misa AMIS · Others"]
    end

    subgraph NEW["🟩 ADDED COMPONENTS (compliance)"]
        SG["Segregation of Duties<br/>creator != approver != signer"]
        RC["Retention Class<br/>5 years / 10 years / permanent"]
        TS["Timestamp required?<br/>(FS, payment = Yes)"]
        ST["Legal Signature Type<br/>mapped by Transaction Type"]
    end

    AP --> AL
    SM --> AL
    SG --> AL
    AL -- "Drag & Drop" --> BUILD
    TT --> ST --> BUILD
    TT --> RC --> BUILD
    TT --> TS --> BUILD
    BUILD["Create Workflow Template"]
    BUILD --> OUT["🟩 Template = approval flow + legal config<br/>auto-applied when creating documents"]
```

**Idea:** keep Webcash's drag-and-drop mechanism (Approval Line + Transaction Type → Create Template), but each **Transaction Type** now carries three legal attributes (signature type, retention class, timestamp requirement) and a **segregation-of-duties** constraint. The template thus defines both *who approves* and *how it is signed & how long it is retained to be lawful*.

---

## 5. Integrated mapping — Transaction Type → Legal configuration

| Source | Transaction/Voucher Type | Signing Method (Webcash) | 🟩 Legal signature type | 🟩 Timestamp | 🟩 Retention |
|--------|--------------------------|---------------------------|--------------------------|--------------|--------------|
| Misa AMIS | Financial statements (PL/BS/CF) | USB Token digital sign | Digital sign · USB Token (company seal) | Mandatory | >= 10 years |
| Misa AMIS | Accounting vouchers, books | USB Token digital sign | Digital sign · USB Token | Yes | >= 10 years |
| Misa AMIS | Goods receipt/issue note | USB Token digital sign | Digital sign · USB Token | Yes | >= 5 years |
| Internal / Others | Quotation | Internal approval | Internal approval (account identity) | System log | Internal policy |
| Internal / Others | FA/tools liquidation | Internal approval | Internal approval (account identity) | System log | >= 10 years |
| WeCMS | Internal Transfer | Internal approval | Internal approval (account identity) | System log | Per resulting acct voucher |
| WeCMS | Vendor / Expense Payment | Internal approval | Internal approval (account identity) | System log | >= 5 years |
| WeCMS | Oversea Payment | Internal approval | Internal approval (account identity) | System log | >= 10 years |
| WeCMS | Payroll | Internal approval | Internal approval (account identity) | System log | >= 5 years |

> **In practice:** only **Misa AMIS** digitally signs with a USB Token (company seal) at the final step — the digital signature appears at the signing position; **WeCMS and Internal/Others** use direct approval via internal account identity only. *Recommendation:* if digital-signature legal value is needed for payment/externally-facing documents, add a digital-signing step at the final approval level.

---

## 6. Integrated WeCMS flow (keep 2 approval lanes + insert compliance)

```mermaid
flowchart TD
    W0([WeCMS document]) --> W1

    subgraph U1["🟦 USER - Approve"]
        W1["Login Web/App"] --> W2["Preview"]
        W2 --> W3["Approve<br/>(internal identity, Attach files)"]
    end

    W3 --> W4["... Intermediate levels if any"]
    W4 --> U2

    subgraph U2["🟦 FINAL APPROVER"]
        F1["Login Web/App"] --> F2["Preview<br/>(review attached files)"]
        F2 --> F3["Approve / Digital sign"]
    end

    F3 --> F4["🟩 Secure signing: OCSP + TSA + seal"]
    F4 --> F5["🟦 Archive<br/>Download · Print with approver info"]
    F5 --> F6["🟩 WORM + Retention class + Audit log"]
    F6 --> WEND([Complete])
```

---

## 7. Integration summary

What is **kept** from Webcash: 3 document sources, the role lanes (Creator / Chief Accountant / Director / User / Final Approver), 2 signing methods (internal approval vs enterprise digital sign), the Reject-with-history mechanism, and the drag-and-drop Workflow Template.

What is **added for legal compliance** (🟩):

- Auto-assign **legal configuration** by Transaction Type at document creation.
- **Segregation of duties** (creator ≠ approver ≠ signer) — mandatory for cash-disbursement documents.
- Insert **hash → OCSP/CRL → TSA timestamp → PAdES/XAdES sealing** into the digital-signing step.
- Classify **retention 5/10 years/permanent** instead of a single blanket ">=10 years".
- **Immutable audit log** for all actions, including Reject.

> This document is for design purposes and does not replace legal advice. Review with legal/audit experts and choose a licensed CA before implementation.
