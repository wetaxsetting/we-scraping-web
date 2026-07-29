"use client";

import { Plus } from "lucide-react";
import { useCallback, useState } from "react";

import DataTableShell from "@/components/shared/DataTableShell";
import PageActionButtons from "@/components/shared/PageActionButtons";
import PageLayout from "@/components/shared/PageLayout";
import Pagination from "@/components/shared/Pagination";
import SearchInput from "@/components/shared/SearchInput";
import TableHeaderCell from "@/components/shared/TableHeaderCell";
import {
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDialog } from "@/components/shared/dialog";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { deleteVatDeclaration, fetchVatDeclarations, lockVatDeclaration, unlockVatDeclaration } from "@/lib/api/addon";
import { toTaxFilingRow } from "@/lib/api/mappers";
import { useApiData } from "@/lib/api/useApiData";
import { useServerPagination } from "@/hooks/useServerPagination";
import NewVatDeclarationDialog from "./NewVatDeclarationDialog";
import TaxFilingDropdown from "./TaxFilingDropdown";
import TaxFilingStatusBadge from "./TaxFilingStatusBadge";
import VatDeclarationFormPage from "./VatDeclarationFormPage";
import { YEAR_OPTIONS } from "./mockData";
import type { TaxFilingRow, TaxFilingStatusFilter } from "./types";

function formatNumber(n: number): string {
  return n.toLocaleString("vi-VN", { maximumFractionDigits: 0 }) + " đ";
}

const STATUS_FILTERS: { value: TaxFilingStatusFilter; labelKey: string }[] = [
  { value: "all", labelKey: "tax_filing.filter.all_status" },
  { value: "confirmed", labelKey: "tax_filing.filter.confirmed" },
  { value: "draft", labelKey: "tax_filing.filter.draft" },
];

const CalendarIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 18 18"
    fill="none"
    aria-hidden
  >
    <path
      d="M12 9H9.75C9.55109 9 9.36032 9.07902 9.21967 9.21967C9.07902 9.36032 9 9.55109 9 9.75V12C9 12.1989 9.07902 12.3897 9.21967 12.5303C9.36032 12.671 9.55109 12.75 9.75 12.75H12C12.1989 12.75 12.3897 12.671 12.5303 12.5303C12.671 12.3897 12.75 12.1989 12.75 12V9.75C12.75 9.55109 12.671 9.36032 12.5303 9.21967C12.3897 9.07902 12.1989 9 12 9ZM12 1.5V2.25H6V1.5C6 1.30109 5.92098 1.11032 5.78033 0.96967C5.63968 0.829018 5.44891 0.75 5.25 0.75C5.05109 0.75 4.86032 0.829018 4.71967 0.96967C4.57902 1.11032 4.5 1.30109 4.5 1.5V2.25H3.75C3.5534 2.2501 3.35875 2.28902 3.17722 2.36452C2.9957 2.44003 2.83087 2.55065 2.6922 2.69001C2.55353 2.82938 2.44375 2.99476 2.36915 3.17666C2.29455 3.35856 2.25661 3.5534 2.2575 3.75L2.25 14.25C2.25 14.6478 2.40804 15.0294 2.68934 15.3107C2.97064 15.592 3.35218 15.75 3.75 15.75H14.25C14.6475 15.7488 15.0283 15.5904 15.3093 15.3093C15.5904 15.0283 15.7488 14.6475 15.75 14.25V3.75C15.7488 3.35254 15.5904 2.9717 15.3093 2.69065C15.0283 2.4096 14.6475 2.25119 14.25 2.25H13.5V1.5C13.5 1.30109 13.421 1.11032 13.2803 0.96967C13.1397 0.829018 12.9489 0.75 12.75 0.75C12.5511 0.75 12.3603 0.829018 12.2197 0.96967C12.079 1.11032 12 1.30109 12 1.5V1.5ZM13.5 14.25H4.5C4.30109 14.25 4.11032 14.171 3.96967 14.0303C3.82902 13.8897 3.75 13.6989 3.75 13.5V6H14.25V13.5C14.25 13.6989 14.171 13.8897 14.0303 14.0303C13.8897 14.171 13.6989 14.25 13.5 14.25Z"
      fill="#525252"
    />
  </svg>
);

const IconLock = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden
  >
    <path
      d="M11.3333 15.1667H4.66665C1.72665 15.1667 0.833313 14.2733 0.833313 11.3333V10C0.833313 7.06001 1.72665 6.16667 4.66665 6.16667H11.3333C14.2733 6.16667 15.1666 7.06001 15.1666 10V11.3333C15.1666 14.2733 14.2733 15.1667 11.3333 15.1667ZM4.66665 7.16667C2.27998 7.16667 1.83331 7.62001 1.83331 10V11.3333C1.83331 13.7133 2.27998 14.1667 4.66665 14.1667H11.3333C13.72 14.1667 14.1666 13.7133 14.1666 11.3333V10C14.1666 7.62001 13.72 7.16667 11.3333 7.16667H4.66665Z"
      fill="#292D32"
    />
    <path
      d="M4 7.16666C3.72667 7.16666 3.5 6.94 3.5 6.66666V5.33333C3.5 3.39999 3.96667 0.833328 8 0.833328C10.9867 0.833328 12.5 2.11999 12.5 4.66666C12.5 4.93999 12.2733 5.16666 12 5.16666C11.7267 5.16666 11.5 4.93999 11.5 4.66666C11.5 3.34666 11.1 1.83333 8 1.83333C5.09333 1.83333 4.5 3.23333 4.5 5.33333V6.66666C4.5 6.94 4.27333 7.16666 4 7.16666Z"
      fill="#292D32"
    />
    <path
      d="M7.99998 12.8333C6.80665 12.8333 5.83331 11.86 5.83331 10.6667C5.83331 9.47333 6.80665 8.5 7.99998 8.5C9.19331 8.5 10.1666 9.47333 10.1666 10.6667C10.1666 11.86 9.19331 12.8333 7.99998 12.8333ZM7.99998 9.5C7.35998 9.5 6.83331 10.0267 6.83331 10.6667C6.83331 11.3067 7.35998 11.8333 7.99998 11.8333C8.63998 11.8333 9.16665 11.3067 9.16665 10.6667C9.16665 10.0267 8.63998 9.5 7.99998 9.5Z"
      fill="#292D32"
    />
  </svg>
);

const IconSupplemental = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden
  >
    <path
      d="M12.6668 15.1667C11.7335 15.1667 10.8601 14.76 10.2601 14.0467C10.2535 14.0333 10.2135 14 10.1801 13.9467C10.1068 13.8733 10.0201 13.74 9.9468 13.6133C9.65346 13.14 9.49347 12.58 9.49347 11.9933C9.49347 11.02 9.9268 10.12 10.6801 9.52002C11.2401 9.07335 11.9468 8.82666 12.6601 8.82666C13.4335 8.82666 14.1468 9.09334 14.7201 9.59334C14.8001 9.64668 14.8935 9.74667 14.9801 9.84001C15.5201 10.4333 15.8201 11.1933 15.8201 11.9867C15.8201 12.5667 15.6601 13.1333 15.3601 13.62C15.2001 13.9 14.9801 14.1533 14.7268 14.3667C14.1868 14.8867 13.4468 15.1667 12.6668 15.1667ZM12.6668 9.83333C12.1735 9.83333 11.7068 9.99998 11.3135 10.3133C10.8001 10.72 10.5001 11.34 10.5001 12C10.5001 12.3933 10.6068 12.78 10.8135 13.1133C10.8668 13.2067 10.9201 13.28 10.9801 13.3534C10.9935 13.3667 11.0335 13.4067 11.0668 13.46C11.4335 13.8933 12.0335 14.1733 12.6668 14.1733C13.1935 14.1733 13.7001 13.98 14.0868 13.6333C14.2601 13.4867 14.4068 13.3133 14.5135 13.1267C14.7268 12.7867 14.8335 12.4 14.8335 12.0067C14.8335 11.4667 14.6268 10.94 14.2535 10.5333C14.2068 10.48 14.1535 10.4267 14.1001 10.3867C13.6801 10.0133 13.1935 9.83333 12.6668 9.83333Z"
      fill="#292D32"
    />
    <path
      d="M13.66 12.4867H11.6667C11.3934 12.4867 11.1667 12.26 11.1667 11.9867C11.1667 11.7133 11.3934 11.4867 11.6667 11.4867H13.66C13.9334 11.4867 14.16 11.7133 14.16 11.9867C14.16 12.26 13.94 12.4867 13.66 12.4867Z"
      fill="#292D32"
    />
    <path
      d="M12.6667 13.5067C12.3934 13.5067 12.1667 13.28 12.1667 13.0067V11.0133C12.1667 10.74 12.3934 10.5133 12.6667 10.5133C12.94 10.5133 13.1667 10.74 13.1667 11.0133V13.0067C13.1667 13.2867 12.94 13.5067 12.6667 13.5067Z"
      fill="#292D32"
    />
    <path
      d="M7.99991 8.86657C7.91324 8.86657 7.82657 8.84659 7.74657 8.79992L1.85991 5.39326C1.61991 5.25326 1.53991 4.94658 1.67991 4.70658C1.81991 4.46658 2.12657 4.38657 2.35991 4.52657L7.99325 7.78658L13.5932 4.54658C13.8332 4.40658 14.1399 4.49326 14.2732 4.7266C14.4132 4.9666 14.3266 5.27324 14.0932 5.41324L8.24657 8.79992C8.17324 8.83992 8.08658 8.86657 7.99991 8.86657Z"
      fill="#292D32"
    />
    <path
      d="M8 14.9065C7.72667 14.9065 7.5 14.6799 7.5 14.4065V8.35986C7.5 8.08653 7.72667 7.85986 8 7.85986C8.27333 7.85986 8.5 8.08653 8.5 8.35986V14.4065C8.5 14.6799 8.27333 14.9065 8 14.9065Z"
      fill="#292D32"
    />
    <path
      d="M7.99994 15.1666C7.41327 15.1666 6.8266 15.0399 6.37327 14.7799L2.81327 12.8066C1.84661 12.2733 1.08661 10.9866 1.08661 9.87996V6.1066C1.08661 4.99993 1.84661 3.71997 2.81327 3.17997L6.37327 1.20662C7.27994 0.693284 8.7066 0.693284 9.61993 1.20662L13.1799 3.17997C14.1466 3.7133 14.9066 4.99993 14.9066 6.1066V9.87996C14.9066 9.94662 14.9066 9.99994 14.8933 10.0666C14.8599 10.2399 14.7333 10.3866 14.5666 10.4399C14.3999 10.4999 14.2133 10.46 14.0733 10.3466C13.3066 9.67997 12.1199 9.65329 11.3133 10.3C10.7999 10.7066 10.4999 11.3266 10.4999 11.9866C10.4999 12.3799 10.6066 12.7666 10.8133 13.1C10.8666 13.1933 10.9199 13.2666 10.9799 13.34C11.0799 13.4533 11.1199 13.6066 11.0933 13.7533C11.0666 13.9 10.9733 14.0266 10.8399 14.1L9.61993 14.7733C9.1666 15.0399 8.58661 15.1666 7.99994 15.1666ZM7.99994 1.83329C7.58661 1.83329 7.16661 1.91996 6.86661 2.08662L3.30661 4.05997C2.65994 4.4133 2.09993 5.37327 2.09993 6.1066V9.87996C2.09993 10.6133 2.66661 11.5733 3.30661 11.9266L6.86661 13.8999C7.47327 14.2399 8.53328 14.2399 9.13994 13.8999L9.88661 13.4866C9.63994 13.0399 9.5066 12.5199 9.5066 11.9866C9.5066 11.0133 9.93993 10.1133 10.6933 9.5133C11.5999 8.78663 12.8999 8.63327 13.9133 9.0666V6.0933C13.9133 5.35996 13.3466 4.39996 12.7066 4.04662L9.14661 2.07328C8.83327 1.91994 8.41327 1.83329 7.99994 1.83329Z"
      fill="#292D32"
    />
  </svg>
);

const IconEdit = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden
  >
    <path
      d="M9.99998 15.1667H5.99998C2.37998 15.1667 0.833313 13.62 0.833313 10V6C0.833313 2.38 2.37998 0.833336 5.99998 0.833336H7.33331C7.60665 0.833336 7.83331 1.06 7.83331 1.33334C7.83331 1.60667 7.60665 1.83334 7.33331 1.83334H5.99998C2.92665 1.83334 1.83331 2.92667 1.83331 6V10C1.83331 13.0733 2.92665 14.1667 5.99998 14.1667H9.99998C13.0733 14.1667 14.1666 13.0733 14.1666 10V8.66667C14.1666 8.39334 14.3933 8.16667 14.6666 8.16667C14.94 8.16667 15.1666 8.39334 15.1666 8.66667V10C15.1666 13.62 13.62 15.1667 9.99998 15.1667Z"
      fill="#292D32"
    />
    <path
      d="M5.66664 11.7933C5.25997 11.7933 4.88664 11.6467 4.61331 11.38C4.28664 11.0533 4.14664 10.58 4.21997 10.08L4.50664 8.07333C4.55997 7.68667 4.81331 7.18667 5.08664 6.91333L10.34 1.66C11.6666 0.333334 13.0133 0.333334 14.34 1.66C15.0666 2.38667 15.3933 3.12667 15.3266 3.86667C15.2666 4.46667 14.9466 5.05333 14.34 5.65333L9.08664 10.9067C8.81331 11.18 8.31331 11.4333 7.92664 11.4867L5.91997 11.7733C5.83331 11.7933 5.74664 11.7933 5.66664 11.7933ZM11.0466 2.36667L5.7933 7.62C5.66664 7.74667 5.51997 8.04 5.4933 8.21333L5.20664 10.22C5.17997 10.4133 5.21997 10.5733 5.31997 10.6733C5.41997 10.7733 5.57997 10.8133 5.7733 10.7867L7.77997 10.5C7.95331 10.4733 8.25331 10.3267 8.37331 10.2L13.6266 4.94667C14.06 4.51333 14.2866 4.12667 14.32 3.76667C14.36 3.33333 14.1333 2.87333 13.6266 2.36C12.56 1.29333 11.8266 1.59333 11.0466 2.36667Z"
      fill="#292D32"
    />
    <path
      d="M13.2334 6.55333C13.1867 6.55333 13.14 6.54667 13.1 6.53333C11.3467 6.04 9.95335 4.64667 9.46002 2.89333C9.38668 2.62667 9.54002 2.35333 9.80668 2.27333C10.0734 2.2 10.3467 2.35333 10.42 2.62C10.82 4.04 11.9467 5.16667 13.3667 5.56667C13.6333 5.64 13.7867 5.92 13.7134 6.18667C13.6534 6.41333 13.4534 6.55333 13.2334 6.55333Z"
      fill="#292D32"
    />
  </svg>
);

const IconDelete = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden
  >
    <path
      d="M14 4.48667C13.9867 4.48667 13.9667 4.48667 13.9467 4.48667C10.42 4.13334 6.9 4 3.41334 4.35334L2.05334 4.48667C1.77334 4.51334 1.52667 4.31334 1.5 4.03334C1.47334 3.75334 1.67334 3.51334 1.94667 3.48667L3.30667 3.35334C6.85334 2.99334 10.4467 3.13334 14.0467 3.48667C14.32 3.51334 14.52 3.76 14.4933 4.03334C14.4733 4.29334 14.2533 4.48667 14 4.48667Z"
      fill="#F3404A"
    />
    <path
      d="M5.66669 3.81333C5.64003 3.81333 5.61336 3.81333 5.58003 3.80667C5.31336 3.76 5.12669 3.5 5.17336 3.23333L5.32003 2.36C5.42669 1.72 5.57336 0.833332 7.12669 0.833332H8.87336C10.4334 0.833332 10.58 1.75333 10.68 2.36667L10.8267 3.23333C10.8734 3.50667 10.6867 3.76667 10.42 3.80667C10.1467 3.85333 9.88669 3.66667 9.84669 3.4L9.70003 2.53333C9.60669 1.95333 9.58669 1.84 8.88003 1.84H7.13336C6.42669 1.84 6.41336 1.93333 6.31336 2.52667L6.16003 3.39333C6.12003 3.64 5.90669 3.81333 5.66669 3.81333Z"
      fill="#F3404A"
    />
    <path
      d="M10.14 15.1667H5.85997C3.53331 15.1667 3.43997 13.88 3.36664 12.84L2.93331 6.12667C2.91331 5.85333 3.12664 5.61333 3.39997 5.59333C3.67997 5.58 3.91331 5.78667 3.93331 6.06L4.36664 12.7733C4.43997 13.7867 4.46664 14.1667 5.85997 14.1667H10.14C11.54 14.1667 11.5666 13.7867 11.6333 12.7733L12.0666 6.06C12.0866 5.78667 12.3266 5.58 12.6 5.59333C12.8733 5.61333 13.0866 5.84667 13.0666 6.12667L12.6333 12.84C12.56 13.88 12.4666 15.1667 10.14 15.1667Z"
      fill="#F3404A"
    />
    <path
      d="M9.10666 11.5H6.88666C6.61332 11.5 6.38666 11.2733 6.38666 11C6.38666 10.7267 6.61332 10.5 6.88666 10.5H9.10666C9.37999 10.5 9.60666 10.7267 9.60666 11C9.60666 11.2733 9.37999 11.5 9.10666 11.5Z"
      fill="#F3404A"
    />
    <path
      d="M9.66665 8.83333H6.33331C6.05998 8.83333 5.83331 8.60667 5.83331 8.33333C5.83331 8.06 6.05998 7.83333 6.33331 7.83333H9.66665C9.93998 7.83333 10.1666 8.06 10.1666 8.33333C10.1666 8.60667 9.93998 8.83333 9.66665 8.83333Z"
      fill="#F3404A"
    />
  </svg>
);

export default function TaxFilingPage() {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] =
    useState<TaxFilingStatusFilter>("all");
  const [yearFilter, setYearFilter] = useState("2026");
  const [keyword, setKeyword] = useState("");
  const pg = useServerPagination();
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [formPageOpen, setFormPageOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [checkedAnnexes, setCheckedAnnexes] = useState<Set<string>>(
    new Set(["bkbr", "bkmv"]),
  );
  const [activeDeclId, setActiveDeclId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const dialog = useDialog();

  const handleDelete = useCallback(
    (row: TaxFilingRow) => {
      dialog.open({
        type: "confirmation",
        title: t("dialog.confirmation"),
        description: t("tax_filing.delete_confirm", {
          period: row.filingPeriod,
        }),
        confirmText: t("dialog.yes"),
        cancelText: t("dialog.no"),
        onConfirm: async () => {
          try {
            await deleteVatDeclaration(row.declId);
            setRefreshKey((k) => k + 1);
            dialog.open({
              type: "success",
              title: t("dialog.success"),
              description: t("tax_filing.delete_success"),
            });
          } catch (err: unknown) {
            const e = err as { code?: string; message?: string };
            dialog.open({
              type: "error",
              title: t("dialog.error"),
              description: e?.message ?? t("common.error_unknown"),
              errorCode: e?.code ?? "WBE9999",
            });
          }
        },
      });
    },
    [dialog, t],
  );

  const handleLock = useCallback(
    (row: TaxFilingRow) => {
      dialog.open({
        type: "confirmation",
        title: t("dialog.confirmation"),
        description: t("tax_filing.lock_confirm", {
          period: row.filingPeriod,
        }),
        confirmText: t("dialog.yes"),
        cancelText: t("dialog.no"),
        onConfirm: async () => {
          try {
            await lockVatDeclaration(row.declId);
            setRefreshKey((k) => k + 1);
            dialog.open({
              type: "success",
              title: t("dialog.success"),
              description: t("tax_filing.lock_success"),
            });
          } catch (err: unknown) {
            const e = err as { code?: string; message?: string };
            // Backend blocks lock when the preceding period is still Draft /
            // not created — surface a localized message keyed on the code.
            const description =
              e?.code === "WBE_VAT_PREV_PERIOD_NOT_LOCKED"
                ? t("tax_filing.lock_prev_period_required")
                : (e?.message ?? t("common.error_unknown"));
            dialog.open({
              type: "error",
              title: t("dialog.error"),
              description,
              errorCode: e?.code ?? "WBE9999",
            });
          }
        },
      });
    },
    [dialog, t],
  );

  const handleUnlock = useCallback(
    (row: TaxFilingRow) => {
      dialog.open({
        type: "confirmation",
        title: t("dialog.confirmation"),
        description: t("tax_filing.unlock_confirm", { period: row.filingPeriod }),
        confirmText: t("dialog.yes"),
        cancelText: t("dialog.no"),
        onConfirm: async () => {
          try {
            await unlockVatDeclaration(row.declId);
            setRefreshKey((k) => k + 1);
            dialog.open({
              type: "success",
              title: t("dialog.success"),
              description: t("tax_filing.unlock_success"),
            });
          } catch (err: unknown) {
            const e = err as { code?: string; message?: string };
            dialog.open({
              type: "error",
              title: t("dialog.error"),
              description: e?.message ?? t("common.error_unknown"),
              errorCode: e?.code ?? "WBE9999",
            });
          }
        },
      });
    },
    [dialog, t],
  );

  const sttsWire =
    statusFilter === "all"
      ? undefined
      : statusFilter === "confirmed"
        ? "C"
        : "D";

  const { data: apiData } = useApiData(
    () =>
      fetchVatDeclarations({
        year: Number(yearFilter),
        status: sttsWire,
        keyword: keyword || undefined,
        page: pg.pageIndex,
        size: pg.pageSize,
      }),
    [yearFilter, sttsWire, keyword, pg.page, pg.pageSize, refreshKey],
  );

  const rows: TaxFilingRow[] = (apiData?.rows ?? []).map(toTaxFilingRow);
  const total = apiData?.total_count ?? 0;
  const shown = Math.min(pg.pageSize, rows.length);

  function handleNext(selected: Set<string>, declId: number) {
    setCheckedAnnexes(selected);
    setActiveDeclId(declId);
    setNewDialogOpen(false);
    setFormPageOpen(true);
  }

  return (
    <>
      <PageLayout>
        {/* Title row: [title + badge] on left, [toolbar + CTA] on right */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 pt-4 md:pt-6">
          <div className="flex items-center gap-3">
            <h1 className="text-wb-18 font-semibold tracking-wb-tight text-wb-dark">
              {t("tax_filing.title")}
            </h1>
            <span className="rounded-md border border-wb-ntrl-4 bg-wb-bg-sidebar px-2.5 py-1 text-wb-14 font-medium text-wb-ntrl-5">
              {t("tax_filing.circular")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <PageActionButtons showList showPrint showExcel />
            <button
              type="button"
              onClick={() => setNewDialogOpen(true)}
              className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-brand px-3 text-wb-14-tight font-medium text-white shadow-wb-brand-btn hover:bg-brand-hover"
            >
              <Plus className="size-4" />
              {t("tax_filing.action.new_declaration")}
            </button>
          </div>
        </div>

        {/* Filter row */}
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {/* Status dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setStatusDropdownOpen((o) => !o)}
              className="flex h-(--h-wb-filter-btn) min-w-[180px] items-center justify-between gap-2 rounded-md border border-wb-ntrl-4 bg-white px-3 text-wb-13 font-medium text-wb-ink hover:bg-black/[0.02]"
            >
              <span>
                {t(
                  STATUS_FILTERS.find((f) => f.value === statusFilter)
                    ?.labelKey ?? "tax_filing.filter.all_status",
                )}
              </span>
              <svg
                className="size-4 text-wb-ntrl-6"
                viewBox="0 0 16 16"
                fill="none"
              >
                <path
                  d="M4 6l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {statusDropdownOpen && (
              <div className="absolute top-full z-30 mt-1 w-full rounded-md border border-wb-ntrl-4 bg-white py-1 shadow-wb-card">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => {
                      setStatusFilter(f.value);
                      setStatusDropdownOpen(false);
                      pg.reset();
                    }}
                    className={cn(
                      "flex w-full items-center px-3 py-2 text-wb-13 font-medium hover:bg-wb-bg-sidebar",
                      statusFilter === f.value ? "text-brand" : "text-wb-ink",
                    )}
                  >
                    {t(f.labelKey)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Year picker — calendar icon OUTSIDE the dropdown, fits content */}
          <div className="flex items-center">
            <TaxFilingDropdown
              options={YEAR_OPTIONS}
              value={yearFilter}
              onChange={(v) => {
                setYearFilter(v);
                pg.reset();
              }}
              className="w-[80px]"
              hideChevron
            />
            <button
              type="button"
              aria-label={t("common.pick_year")}
              className="flex size-8 cursor-pointer items-center justify-center rounded-md text-wb-ntrl-6 hover:bg-black/5"
            >
              {CalendarIcon}
            </button>
          </div>

          <div className="ml-auto">
            <SearchInput
              value={keyword}
              onChange={(v) => {
                setKeyword(v);
                pg.reset();
              }}
              placeholder={t("common.search")}
            />
          </div>
        </div>

        <DataTableShell
          footerMode="paginationOnly"
          table={
            <table className="w-full min-w-[1460px] table-fixed border-collapse">
              <colgroup>
                <col className="w-[136px]" />
                <col className="w-[200px]" />
                <col className="w-[320px]" />
                <col className="w-[210px]" />
                <col className="w-[110px]" />
                <col className="w-[210px]" />
                <col className="w-[170px]" />
                <col className="w-[200px]" />
                <col className="w-[90px]" />
              </colgroup>
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="h-(--h-wb-table-head) border-b border-wb-table-border bg-wb-bg-sidebar hover:bg-wb-bg-sidebar">
                  <TableHeaderCell textSizeClass="text-wb-13">
                    {t("tax_filing.col.filing_period")}
                  </TableHeaderCell>
                  <TableHeaderCell textSizeClass="text-wb-13">
                    {t("tax_filing.col.applicable_circular")}
                  </TableHeaderCell>
                  <TableHeaderCell textSizeClass="text-wb-13">
                    {t("tax_filing.col.declaration_type")}
                  </TableHeaderCell>
                  <TableHeaderCell textSizeClass="text-wb-13">
                    {t("tax_filing.col.e_transaction_code")}
                  </TableHeaderCell>
                  <TableHeaderCell
                    align="center"
                    sortable={false}
                    textSizeClass="text-wb-13"
                  >
                    {t("tax_filing.col.status")}
                  </TableHeaderCell>
                  <TableHeaderCell align="right" textSizeClass="text-wb-13">
                    {t("tax_filing.col.prev_period_credit")}
                  </TableHeaderCell>
                  <TableHeaderCell align="right" textSizeClass="text-wb-13">
                    {t("tax_filing.col.tax_payable")}
                  </TableHeaderCell>
                  <TableHeaderCell align="right" textSizeClass="text-wb-13">
                    {t("tax_filing.col.carried_forward")}
                  </TableHeaderCell>
                  {/* Actions — sticky right */}
                  <TableHeaderCell
                    sortable={false}
                    align="right"
                    textSizeClass="text-wb-13"
                    className="sticky right-0 bg-wb-bg-sidebar shadow-[-1px_0_0_var(--color-wb-table-border)]"
                  >
                    {t("tax_filing.col.actions")}
                  </TableHeaderCell>
                </TableRow>
              </TableHeader>

              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="py-12 text-center text-wb-13 font-medium text-wb-ntrl-6"
                    >
                      {t("common.no_data")}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TaxFilingTableRow
                      key={row.id}
                      row={row}
                      t={t}
                      onRowClick={() => {
                        setActiveDeclId(row.declId);
                        setFormPageOpen(true);
                      }}
                      onEdit={() => {
                        setActiveDeclId(row.declId);
                        setFormPageOpen(true);
                      }}
                      onDelete={() => handleDelete(row)}
                      onLock={() => handleLock(row)}
                      onUnlock={() => handleUnlock(row)}
                    />
                  ))
                )}
              </TableBody>
            </table>
          }
          pagination={
            <Pagination
              page={pg.page}
              pageCount={Math.max(1, Math.ceil(total / pg.pageSize))}
              pageSize={pg.pageSize}
              totalLabel={`${shown} of ${total}`}
              onPageChange={pg.setPage}
              onPageSizeChange={pg.setPageSize}
              className="shrink-0"
            />
          }
        />
      </PageLayout>

      <NewVatDeclarationDialog
        open={newDialogOpen}
        onClose={() => setNewDialogOpen(false)}
        onNext={handleNext}
      />

      <VatDeclarationFormPage
        open={formPageOpen}
        onClose={() => {
          setFormPageOpen(false);
          setRefreshKey((k) => k + 1);
        }}
        checkedAnnexes={checkedAnnexes}
        declId={activeDeclId}
      />
    </>
  );
}

function TaxFilingTableRow({
  row,
  t,
  onRowClick,
  onEdit,
  onDelete,
  onLock,
  onUnlock,
}: {
  row: TaxFilingRow;
  t: (k: string) => string;
  onRowClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onLock: () => void;
  onUnlock: () => void;
}) {
  return (
    <TableRow
      className="h-[var(--h-wb-table-row)] cursor-pointer border-b border-wb-table-border last:border-b-0 hover:bg-black/[0.02]"
      onClick={onRowClick}
    >
      <TableCell className="px-2.5 py-2.5 align-middle">
        <span className="block truncate text-wb-13 font-medium text-wb-ink">
          {row.filingPeriod}
        </span>
      </TableCell>
      <TableCell className="px-2.5 py-2.5 align-middle">
        <span className="block truncate text-wb-13 font-medium text-wb-ink">
          {row.applicableCircular ?? "—"}
        </span>
      </TableCell>
      <TableCell className="px-2.5 py-2.5 align-middle">
        <span className="block truncate text-wb-13 font-medium text-wb-ink">
          {row.declTypeName ?? "—"}
        </span>
      </TableCell>
      <TableCell className="px-2.5 py-2.5 align-middle">
        <span className="block truncate text-wb-13 font-medium text-brand">
          {!row.etaxCode ? (
            <span className="text-wb-ink">
              {t("tax_filing.col.not_submitted")}
            </span>
          ) : (
            row.etaxCode
          )}
        </span>
      </TableCell>
      <TableCell className="px-2.5 py-2.5 align-middle text-center">
        <TaxFilingStatusBadge status={row.status} />
      </TableCell>
      <TableCell className="px-2.5 py-2.5 align-middle text-right">
        <span className="text-wb-13 font-medium text-wb-ink">
          {row.prevPeriodCredit != null
            ? formatNumber(row.prevPeriodCredit)
            : "—"}
        </span>
      </TableCell>
      <TableCell className="px-2.5 py-2.5 align-middle text-right">
        <span className="text-wb-13 font-medium text-wb-ink">
          {formatNumber(row.taxPayable)}
        </span>
      </TableCell>
      <TableCell className="px-2.5 py-2.5 align-middle text-right">
        <span className="text-wb-13 font-medium text-wb-ink">
          {row.carriedForward != null ? formatNumber(row.carriedForward) : "—"}
        </span>
      </TableCell>
      {/* Actions — sticky right */}
      <TableCell
        className="sticky right-0 bg-white px-2.5 py-2.5 align-middle shadow-[-1px_0_0_var(--color-wb-table-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-end gap-1.5">
          {row.status === "confirmed" ? (
            <>
              <ActionButton
                icon={IconLock}
                label={t("tax_filing.action.unlock")}
                onClick={onUnlock}
              />
              <ActionButton
                icon={IconSupplemental}
                label={t("tax_filing.action.supplemental")}
                onClick={() => {}}
              />
            </>
          ) : row.status === "draft" ? (
            <>
              <ActionButton
                icon={IconEdit}
                label={t("tax_filing.action.edit")}
                onClick={onEdit}
              />
              <ActionButton
                icon={IconDelete}
                label={t("tax_filing.action.delete")}
                onClick={onDelete}
                variant="danger"
              />
            </>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  variant = "default",
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "flex p-1 cursor-pointer items-center justify-center rounded-[4px]",
        variant === "danger"
          ? "bg-white shadow-[0_0_0_1px_var(--color-wb-red-04)] hover:bg-wb-red-04/10"
          : "bg-white shadow-wb-btn hover:bg-black/[0.03]",
      )}
    >
      {icon}
    </button>
  );
}
