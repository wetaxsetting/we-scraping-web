import { NextResponse } from "next/server";
import * as xlsx from "xlsx";

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;
        
        if (!file) {
            return NextResponse.json({ message: "No file uploaded" }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        const workbook = xlsx.read(buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Read raw rows
        const rawRows = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1 });
        
        // Template data rows start from index 3 (4th row)
        const dataRows = rawRows.slice(3).filter(row => row.length > 0 && row.some(cell => cell !== undefined && cell !== null && cell !== ""));

        const previewRows = dataRows.map((row, index) => {
            // File columns:
            // 0: Beneficiary Code
            // 1: Transfer Currency
            // 2: Transfer Amount
            // 3: Fee Payer
            // 4: Memo
            // 5: Reporting Account

            const errors: any[] = [];
            
            // Basic validation
            if (!row[0]) errors.push({ field: "beneficiaryCode", message: "Beneficiary Code is required", code: "missing_field" });
            if (!row[1]) errors.push({ field: "currency", message: "Transfer Currency is required", code: "missing_field" });
            if (!row[2]) errors.push({ field: "amount", message: "Transfer Amount is required", code: "missing_field" });
            if (!row[3]) errors.push({ field: "feePayer", message: "Fee Payer is required", code: "missing_field" });

            return {
                row_index: index + 4,
                currency: row[1] || "",
                amount: row[2] ? String(row[2]) : "",
                feePayer: row[3] || "",
                beneficiaryCode: row[0] || "",
                // Mock beneficiary details that would normally be resolved by the backend using the beneficiaryCode
                beneficiaryName: row[0] ? `Name for ${row[0]}` : "",
                beneficiaryBankName: "Global Bank",
                bic: "GLOBUS33",
                beneficiaryAccountNo: "987654321",
                beneficiaryAddress: "123 Global St, NY",
                memo: row[4] || "",
                reportingAccount: row[5] || "",
                errors
            };
        });

        return NextResponse.json({
            total_count: previewRows.length,
            rows: previewRows
        });

    } catch (error) {
        console.error("Failed to parse excel file", error);
        return NextResponse.json({ message: "Failed to parse excel file" }, { status: 500 });
    }
}
