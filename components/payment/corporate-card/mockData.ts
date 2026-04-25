import type { ResultStatus } from "@/components/payment/shared/types";

export type CardTransactionRow = {
    id: string;
    dateTime: string;
    cardNumber: string;
    merchant: string;
    category: string;
    currency: string;
    amount: string;
    status: ResultStatus;
};

export const cardTransactionRows: CardTransactionRow[] = [
    {
        id: "1",
        dateTime: "30-Jan-2025 14:23",
        cardNumber: "**** **** **** 8412",
        merchant: "Highlands Coffee",
        category: "Entertainment",
        currency: "VND",
        amount: "245.000",
        status: "success",
    },
    {
        id: "2",
        dateTime: "30-Jan-2025 09:51",
        cardNumber: "**** **** **** 8412",
        merchant: "Grab Vietnam",
        category: "Travel",
        currency: "VND",
        amount: "180.000",
        status: "success",
    },
    {
        id: "3",
        dateTime: "29-Jan-2025 18:14",
        cardNumber: "**** **** **** 6190",
        merchant: "AEON Mall Tan Phu",
        category: "Supplies",
        currency: "VND",
        amount: "1.450.000",
        status: "success",
    },
    {
        id: "4",
        dateTime: "29-Jan-2025 12:08",
        cardNumber: "**** **** **** 6190",
        merchant: "Pizza 4P's",
        category: "Entertainment",
        currency: "VND",
        amount: "780.000",
        status: "pending",
    },
    {
        id: "5",
        dateTime: "28-Jan-2025 22:35",
        cardNumber: "**** **** **** 8412",
        merchant: "Apple Services",
        category: "Software",
        currency: "USD",
        amount: "9.99",
        status: "success",
    },
    {
        id: "6",
        dateTime: "28-Jan-2025 16:02",
        cardNumber: "**** **** **** 6190",
        merchant: "Vinmart",
        category: "Supplies",
        currency: "VND",
        amount: "320.000",
        status: "failed",
    },
    {
        id: "7",
        dateTime: "27-Jan-2025 10:44",
        cardNumber: "**** **** **** 8412",
        merchant: "Vietnam Airlines",
        category: "Travel",
        currency: "VND",
        amount: "4.200.000",
        status: "cancelled",
    },
];
