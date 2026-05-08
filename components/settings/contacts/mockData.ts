import type { ContactRow } from "./types";

/**
 * Static mock for the Contacts panel — rows mirror the Figma frame
 * (9194:9683). `MOCK_TOTAL_COUNT` is sized to land on a `10 of 33`
 * pagination footer at the default page size of 10.
 *
 * Some rows ship with extra (Changed) addresses so the `+N` badge in
 * the Address column renders for the static UI. Replace with the
 * real `/api/v1/settings/contacts` call when the backend lands; the
 * row shape matches the expected UPPER_SNAKE → camelCase mapping.
 */
const VN_ADDRESS =
    "LK08-13, Khu phố 3, Phường 6, Thành phố Mỹ Tho, Tỉnh Tiền Giang, Việt Nam";
const VN_ADDRESS_OLD =
    "Khu phố 3, Phường 3, Thành phố Mỹ Tho, Tỉnh Tiền Giang, Việt Nam";
const VN_ADDRESS_OLDER =
    "Số 12, Đường Trần Hưng Đạo, Phường 1, Quận 5, Thành phố Hồ Chí Minh, Việt Nam";

export const mockContactsRows: ContactRow[] = [
    {
        id: "ct-1",
        contactCode: "C0002",
        contactName: "Silver Oak Technologies",
        location: "local",
        taxId: "4510000012-(614)",
        deposit: { bankName: "WOORI BANK", accountNo: "0001-00000569-16" },
        addresses: [VN_ADDRESS, VN_ADDRESS_OLD],
    },
    {
        id: "ct-2",
        contactCode: "C0002",
        contactName: "Emerald Valley",
        location: "local",
        taxId: "2000000033",
        deposit: { bankName: "VIETIN", accountNo: "0001-00000569-15" },
        addresses: [VN_ADDRESS, VN_ADDRESS_OLD],
    },
    {
        id: "ct-3",
        contactCode: "C0002",
        contactName: "Red Maple Enterprises",
        location: "local",
        taxId: "0002005531",
        deposit: { bankName: "WOORI BANK", accountNo: "0001-00000569-14" },
        addresses: [VN_ADDRESS],
    },
    {
        id: "ct-4",
        contactCode: "C0002",
        contactName: "Golden Peak Ventures",
        location: "local",
        taxId: "4302200013-(213)",
        deposit: { bankName: "WOORI BANK", accountNo: "0001-00000569-13" },
        addresses: [VN_ADDRESS],
    },
    {
        id: "ct-5",
        contactCode: "C0002",
        contactName: "Serenity Hills",
        location: "local",
        taxId: "1000006421",
        deposit: { bankName: "WOORI BANK", accountNo: "0001-00000569-12" },
        addresses: [VN_ADDRESS],
    },
    {
        id: "ct-6",
        contactCode: "C0002",
        contactName: "Crystal Lake Dynamics",
        location: "local",
        taxId: "0001230023",
        deposit: { bankName: "WOORI BANK", accountNo: "0001-00000569-11" },
        addresses: [VN_ADDRESS, VN_ADDRESS_OLD, VN_ADDRESS_OLDER],
    },
    {
        id: "ct-7",
        contactCode: "C0002",
        contactName: "Emerald City Consulting",
        location: "overseas",
        taxId: "4500000012",
        deposit: { bankName: "JONH MICAH", accountNo: "SHBKVNVXXXX" },
        addresses: [VN_ADDRESS],
    },
    {
        id: "ct-8",
        contactCode: "C0002",
        contactName: "Emerald City Consulting",
        location: "overseas",
        taxId: "4500000012",
        deposit: { bankName: "JONH MICAH", accountNo: "SHBKVNVXXXX" },
        addresses: [VN_ADDRESS],
    },
];

/**
 * Total record count surfaced in the pagination footer. With the
 * default page size of 10, the footer reads "10 of 33" while the mock
 * list itself only ships the 8 visible rows.
 */
export const MOCK_TOTAL_COUNT = 33;
