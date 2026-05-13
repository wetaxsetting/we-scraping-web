"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiCallError } from "@/lib/api/banking";
import {
    bulkDeleteContacts,
    contactFileDownloadUrl,
    createContact,
    deleteContact,
    deleteContactFile,
    fetchContact,
    fetchContactBanks,
    fetchContacts,
    type FetchContactsParams,
    listContactFiles,
    lookupContactRecipient,
    updateContact,
    uploadContactFile,
} from "@/lib/api/contacts";
import type {
    ApiContactBankRow,
    ApiContactDetail,
    ApiContactFileRow,
    ApiContactLookupRecipientRequest,
    ApiContactRow,
} from "@/lib/types/api";

import { toContactRow, toCreateRequest, toUpdateRequest } from "./mappers";
import type { ContactFormValues, ContactRow } from "./types";

/**
 * Shared list-fetch hook for the Contacts panel. Holds the page
 * state (search, location filter, page index, page size), runs the
 * filtered + paginated GET, and maps the flat backend rows into
 * the in-memory shape the table consumes.
 *
 * <p>Single fetch on (params, refresh-token) change; previous results
 * stay rendered while a new fetch is in flight so the table doesn't
 * flash empty between requests. Errors are surfaced via
 * {@link UseContactsListState#error} (camelCase `{ code, message }`)
 * — the panel decides whether to render an inline empty state,
 * dispatch the shared error dialog, or both.
 */
export type UseContactsListState = {
    rows: ContactRow[];
    /** Raw wire rows — exposed so the panel can look up a row by
     *  `trco_key` when opening the Edit dialog without a second
     *  network call for the slim list shape. The full detail still
     *  comes from {@link fetchContact}. */
    rawRows: ApiContactRow[];
    totalCount: number;
    /** True while the FIRST fetch is in flight. */
    initialLoading: boolean;
    /** True while ANY fetch is in flight. */
    fetching: boolean;
    error: { code: string; message: string } | null;
    /** Imperative refetch — e.g. after a successful mutation. */
    refetch: () => Promise<void>;
};

export function useContactsList(params: FetchContactsParams): UseContactsListState {
    const [rawRows, setRawRows] = useState<ApiContactRow[]>([]);
    const [rows, setRows] = useState<ContactRow[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [initialLoading, setInitialLoading] = useState(true);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState<UseContactsListState["error"]>(null);

    const run = useCallback(async () => {
        setFetching(true);
        setError(null);
        try {
            const res = await fetchContacts(params);
            const list = res.rows ?? [];
            setRawRows(list);
            setRows(list.map(toContactRow));
            setTotalCount(res.total_count ?? 0);
        } catch (e: unknown) {
            const ex = e as ApiCallError;
            setError({ code: ex.code ?? "NETWORK", message: ex.message ?? "Network error" });
        } finally {
            setInitialLoading(false);
            setFetching(false);
        }
    }, [params]);

    useEffect(() => {
        void run();
    }, [run]);

    const refetch = useCallback(async () => {
        await run();
    }, [run]);

    return { rows, rawRows, totalCount, initialLoading, fetching, error, refetch };
}

/* =================================================================
 *  Mutations
 * ================================================================= */

export type ContactsMutationsState = {
    submitting: boolean;
    error: { code: string; message: string } | null;
    /** Lazy detail fetch — Edit dialog seeds RHF on open. */
    loadDetail: (trcoKey: string) => Promise<ApiContactDetail>;
    create: (values: ContactFormValues) => Promise<ApiContactDetail>;
    update: (trcoKey: string, values: ContactFormValues) => Promise<ApiContactDetail>;
    remove: (trcoKey: string) => Promise<void>;
    removeMany: (trcoKeys: string[]) => Promise<void>;
    /** Loads the NAPAS + CITAD bank list for the picker autocomplete. */
    loadBanks: () => Promise<ApiContactBankRow[]>;
    /** Calls the Lookup Recipient stub — returns the resolved name. */
    lookupRecipient: (req: ApiContactLookupRecipientRequest) => Promise<string>;
    /** List attachments for one contact. */
    listFiles: (trcoKey: string) => Promise<ApiContactFileRow[]>;
    /** Upload one attachment (multipart). Server caps at 10 MB + the
     *  legacy extension allow-list; the upload thrown error carries
     *  the backend code (e.g. `WBE_CONTACTS_FILE_TOO_LARGE`). */
    uploadFile: (trcoKey: string, file: File) => Promise<ApiContactFileRow>;
    /** Hard-delete one attachment (DB row + physical file). */
    deleteFile: (trcoKey: string, fileId: string) => Promise<void>;
    /** Compose the download URL for the shared `lib/file.ts
     *  downloadFile` helper. */
    fileDownloadUrl: (trcoKey: string, fileId: string) => string;
    clearError: () => void;
};

/**
 * Local mutation hook — wraps the writes, exposes submitting +
 * error state, and lets the caller `clearError()` between dialog
 * opens. The hook never refetches on its own; the parent component
 * calls {@link useContactsList}'s `refetch()` after a successful
 * mutation so side-effects stay explicit.
 */
export function useContactsMutations(): ContactsMutationsState {
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<ContactsMutationsState["error"]>(null);

    const wrap = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
        setSubmitting(true);
        setError(null);
        try {
            return await fn();
        } catch (e: unknown) {
            const ex = e as ApiCallError;
            const payload = { code: ex.code ?? "NETWORK", message: ex.message ?? "Network error" };
            setError(payload);
            throw e;
        } finally {
            setSubmitting(false);
        }
    }, []);

    const loadDetail = useCallback((trcoKey: string) => wrap(() => fetchContact(trcoKey)), [wrap]);

    const create = useCallback(
        (values: ContactFormValues) => wrap(() => createContact(toCreateRequest(values))),
        [wrap],
    );

    const update = useCallback(
        (trcoKey: string, values: ContactFormValues) =>
            wrap(() => updateContact(trcoKey, toUpdateRequest(values))),
        [wrap],
    );

    const remove = useCallback((trcoKey: string) => wrap(() => deleteContact(trcoKey)), [wrap]);

    const removeMany = useCallback(
        (trcoKeys: string[]) => wrap(() => bulkDeleteContacts({ trco_keys: trcoKeys })),
        [wrap],
    );

    const loadBanks = useCallback(
        () => wrap(() => fetchContactBanks().then((res) => res.rows ?? [])),
        [wrap],
    );

    const lookupRecipient = useCallback(
        (req: ApiContactLookupRecipientRequest) =>
            wrap(() => lookupContactRecipient(req).then((res) => res.recipient_name ?? "")),
        [wrap],
    );

    const listFiles = useCallback(
        (trcoKey: string) =>
            wrap(() => listContactFiles(trcoKey).then((res) => res.rows ?? [])),
        [wrap],
    );

    const uploadFile = useCallback(
        (trcoKey: string, file: File) => wrap(() => uploadContactFile(trcoKey, file)),
        [wrap],
    );

    const deleteFile = useCallback(
        (trcoKey: string, fileId: string) => wrap(() => deleteContactFile(trcoKey, fileId)),
        [wrap],
    );

    const fileDownloadUrl = useCallback(
        (trcoKey: string, fileId: string) => contactFileDownloadUrl(trcoKey, fileId),
        [],
    );

    const clearError = useCallback(() => setError(null), []);

    return {
        submitting,
        error,
        loadDetail,
        create,
        update,
        remove,
        removeMany,
        loadBanks,
        lookupRecipient,
        listFiles,
        uploadFile,
        deleteFile,
        fileDownloadUrl,
        clearError,
    };
}
