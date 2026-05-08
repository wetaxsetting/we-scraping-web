/**
 * DICTIONARY_VAN — VAN response-code dictionary, ported verbatim from
 * legacy {@code WECMS DEV/WECMS_ETC/xml/code/DICTIONARY_VAN/CD_*.xml}
 * (69 entries pulled 2026-05-08).
 *
 * <p><b>Provenance.</b> Each entry corresponds to a single XML file
 * named {@code CD_<code>.xml} under the legacy ETC dictionary tree.
 * The XML schema is one {@code <C_<code>>} element with EN / KO / VI
 * children, each carrying a {@code <name><![CDATA[...]]></name>}
 * message — matching the three locales the workspace officially
 * supports (en / ko / vi).
 *
 * <p><b>Why a static TS module rather than a per-locale JSON.</b>
 * The data is reference content (response-code → localized message),
 * not user-facing UI copy. Inlining 69 × 3 = 207 string entries into
 * the main {@code locales/{en,ko,vi}.json} would balloon the i18n
 * core for a single feature; the workspace pattern keeps reference
 * data in a typed module and the UI layer pulls translations through
 * a dedicated lookup function. See {@link import("./dictionaryVan").lookupVanMessage}.
 *
 * <p><b>Do not edit by hand.</b> If the legacy ETC dictionary changes,
 * re-extract via the bash one-liner documented in the feature spec
 * ({@code docs/refactor-wecms/features/settings/firm-banking-history.md}
 * § DICTIONARY_VAN port). Trailing whitespace and EN-as-VI duplications
 * are preserved verbatim — they exist in the legacy XML and the live
 * JEX system reads them as-is.
 */

import type { Locale } from "@/lib/i18n";

/**
 * One dictionary entry — one row in the legacy XML. The shape covers
 * the three workspace-supported locales ({@code en} / {@code ko} /
 * {@code vi}) verbatim from the legacy {@code <EN>} / {@code <KO>} /
 * {@code <VI>} blocks.
 */
export type DictionaryVanEntry = {
    /** Response code as it appears in {@code TB_FIRM_TRAN.RS_CD} —
     *  4-character VAN gateway code (`0000`, `1030`, `FB01`, `G999`). */
    code: string;
    /** Sequence number from the legacy XML's {@code seq=""} attribute.
     *  Preserved for traceability; not used by the lookup. */
    seq: number;
    /** English message — `<EN><name>` from the legacy XML. */
    en: string;
    /** Korean message — `<KO><name>` from the legacy XML. */
    ko: string;
    /** Vietnamese message — `<VI><name>` from the legacy XML.
     *  Some legacy entries duplicate the EN string into the VI slot
     *  (e.g. CD_0030 / CD_0031 / CD_0049 / CD_1018 / CD_1030 / CD_9999).
     *  Preserved verbatim — fixing the data is a content task on the
     *  legacy XML side. */
    vi: string;
};

/**
 * 69-entry dictionary keyed by VAN response code. Codes match the
 * filename suffix in the legacy {@code CD_<code>.xml} files exactly,
 * including the FB / G prefixes. Order mirrors the alphabetical
 * filename order from the legacy directory listing.
 */
export const DICTIONARY_VAN: Readonly<Record<string, DictionaryVanEntry>> = Object.freeze({
    "0000": { code: "0000", seq: 1,  en: "Process is completed. ", ko: "정상적으로 처리가 완료되었습니다.", vi: "Toàn bộ tiến trình hoàn tất thành công." },
    "0001": { code: "0001", seq: 2,  en: "doesn’t exist. ", ko: "요청한 값이 존재하지 않아 처리할 수 없습니다.(요청 계좌번호 없을 경우 등)", vi: "Không tồn tại" },
    "0003": { code: "0003", seq: 3,  en: "Trnasaction not use Time", ko: "거래 가능상태가 아닙니다.  영업점 연락 주십시오.", vi: "Trạng thái giao dịch không thể thực hiện được. Vui lòng liên hệ chi nhánh" },
    "0004": { code: "0004", seq: 4,  en: " Resource busy .", ko: "처리중 Resource busy로 인한 거래 실패.", vi: "Giao dịch thất bại do lỗi Resource busy trong quá trình xử lý." },
    "0005": { code: "0005", seq: 5,  en: "Napas Other Bank has a Problem", ko: "나파스 타행 장애 또는 거래 중지 ", vi: "Ngừng giao dịch do lỗi ở hệ thống ngân hàng khác từ Napas" },
    "0006": { code: "0006", seq: 6,  en: "Lost connection to beneficiary bank. Please try again later.", ko: "수취은행 연결이 안됩니다. 잠시 후에 거래하여 주시기 바랍니다.", vi: "Mấtkết nối đến ngân hàng thụ hưởng. Vui lòng thử lại sau." },
    "0007": { code: "0007", seq: 7,  en: "The relevant date is not a business day.", ko: "해당 거래의 처리 요청일은 영업일이 아니라 처리할 수 없습니다.", vi: "Ngày thực hiện giao dịch không phải là ngày làm việc (Ngày nghỉ, ngày lễ….)" },
    "0008": { code: "0008", seq: 8,  en: "It is not available time to process.", ko: "거래 가능한 시간이 아니거나 Cut-Off시간(00:00~05) 입니다.", vi: "không có thời gian để xử lý" },
    "0010": { code: "0010", seq: 9,  en: "It is a duplicated Trx.", ko: "거래일련번호가 중복되어 처리할수 없습니다.", vi: "Là giao dịch bị trùng lặp" },
    "0012": { code: "0012", seq: 10, en: "Does not exist company number.", ko: "존재하지 않는 펌뱅킹 업체번호입니다.", vi: "Không tồn tại Mã doanh nghiệp này trên hệ thống Firmbanking" },
    "0014": { code: "0014", seq: 11, en: "Wrong Other Bank code Set.", ko: "존재하지 않는 나파스 타행코드값을 셋팅할경우", vi: "Trường hợp setting giá trị code không tồn tại khác ngân hàng Napas" },
    "0015": { code: "0015", seq: 12, en: "User ID is Not registered.", ko: "등록되지 않은 사용자입니다.", vi: "Id người dùng này chưa được đăng ký" },
    "0016": { code: "0016", seq: 13, en: "This account does not belong to this customer", ko: "해당고객의 계좌가 아닙니다.", vi: "Tài khoản này không thuộc về khách hàng này" },
    "0017": { code: "0017", seq: 14, en: "The application is passed the expiry date. ", ko: "만기일이 지난 업무구분 입니다. (FB 계약기간 만료 시)", vi: "Phân loại nghiệp vụ đã quá hạn" },
    "0018": { code: "0018", seq: 15, en: "User status is invalid. ", ko: "사용자 상태가 유효하지 않습니다. (은행 고객 정보 원장에서 휴면 고객이나 거래 중지 고객인 경우)", vi: "Trạng thái của người dùng không hợp lệ" },
    "0020": { code: "0020", seq: 16, en: "No withdrawal account.", ko: "출금계좌로 등록된 계좌가 없습니다. 출금계좌 등록 필요합니다.", vi: "Không có tài khoản rút tiền" },
    "0021": { code: "0021", seq: 17, en: "It is not a valid date format.", ko: "유효한 날짜 형식이 아닙니다.", vi: "Nó không phải là một định dạng ngày hợp lệ." },
    "0022": { code: "0022", seq: 18, en: "Please check the From date.", ko: "시작 날짜를 확인하세요.", vi: "Vui lòng kiểm tra ngày Từ." },
    "0023": { code: "0023", seq: 19, en: "Please check the To date.", ko: "종료 날짜를 확인하세요.", vi: "Vui lòng kiểm tra Đến ngày." },
    "0024": { code: "0024", seq: 20, en: "Currency is unavailable for transaction.", ko: "거래가능한 통화가 아닙니다. (VND, USD, JPY, EUR 외 통화)", vi: "Không hỗ trợ Đơn vị tiền tệ trong giao dịch này" },
    "0025": { code: "0025", seq: 21, en: "Currency of deposit account is different from Transfer currency.", ko: "당행 입금계좌의 통화와 이체통화가 상이합니다. ", vi: "Đơn vị tiền tệ của tài khoản gửi tiền, khác với đơn vị tiền đang chuyển" },
    "0026": { code: "0026", seq: 22, en: "Currency of withdrawal account is different from transfer currency.", ko: "출금계좌통화와 출금 요청 통화코드가 일치 하지 않습니다.", vi: "Đơn vị tiền tệ của tài khoản rút tiền khác so với đơn vị tiền tệ đang chuyển." },
    "0027": { code: "0027", seq: 23, en: "The currency codes of the withdrawal account and the deposit account are different.", ko: "출금 계좌와 입금 계좌의 통화 코드가 다릅니다.", vi: "Mã tiền tệ của tài khoản rút tiền và tài khoản tiền gửi khác nhau." },
    "0028": { code: "0028", seq: 24, en: "Insufficient balance.", ko: "거래 처리 잔액이 부족합니다.", vi: "Số dư không đủ để thực hiện giao dịch" },
    "0029": { code: "0029", seq: 25, en: "Invalid amount(Format error)", ko: "금액 필드 오류입니다.", vi: "Tổng số tiền giao dịch không khớp" },
    "0030": { code: "0030", seq: 26, en: "Enter Trx. amount ", ko: "거래금액을 입력하세요. ", vi: "Enter Trx. amount " },
    "0031": { code: "0031", seq: 27, en: "Deposit amount is less than the monthly installment amount ", ko: "입금금액이 월납입금액 미만입니다", vi: "Deposit amount is less than the monthly installment amount " },
    "0032": { code: "0032", seq: 28, en: "Transfer limit below 2,000 VND When it comes to napas transaction", ko: "NAPAS 이체 시 금액이 2천동 미만일 경우", vi: "Trường hợp khi chuyển khoản NAPAS với số tiền dưới 2.000 đồng " },
    "0033": { code: "0033", seq: 29, en: "Transfer limit above 500 million VND When it comes to napas transaction", ko: "NAPAS 이체 시 금액이 5억동 이상일 경우", vi: "Trường hợp khi chuyển khoản NAPAS với số tiền trên 500.000.000 đồng " },
    "0034": { code: "0034", seq: 30, en: "This is a canceled virtual account number.", ko: "취소된 가상 계좌 번호입니다.", vi: "Đây là số tài khoản ảo bị hủy." },
    "0035": { code: "0035", seq: 31, en: "The master account number of the virtual account number is different.", ko: "가상 계좌 번호의 마스터 계좌 번호가 다릅니다.", vi: "Số tài khoản chính của số tài khoản ảo khác nhau." },
    "0036": { code: "0036", seq: 32, en: "Invalid vietual account deposit condition and deposit amount", ko: "가상계좌 입금조건과 입금금액 불일치로 입금할 수 없습니다.", vi: "Invalid vietual account deposit condition and deposit amount" },
    "0037": { code: "0037", seq: 33, en: "Vritual account name and deposit request customer name do not match", ko: "가상계좌명과 입금요청 고객명이 불일치 합니다.", vi: "Vritual account name and deposit request customer name do not match" },
    "0038": { code: "0038", seq: 34, en: "Dut to Virtual account processing conditions, it is not a transactionable date", ko: "가상계좌 조건상 거래가능일자가 아닙니다.", vi: "Dut to Virtual account processing conditions, it is not a transactionable date" },
    "0039": { code: "0039", seq: 35, en: "Virtual account status is not normal", ko: "가상계좌 계좌상태가 정상이 아닙니다.", vi: "Virtual account status is not normal" },
    "0040": { code: "0040", seq: 36, en: "Account number is not entered.", ko: "계좌번호가 입력되지 않았습니다.", vi: "số tài khoản chưa được nhập" },
    "0042": { code: "0042", seq: 37, en: "It is not a time deposit account. Select another account.", ko: "정기예금 계좌가 아닙니다. 다른 계좌를 선택하세요.", vi: "Tài khoản được chọn không phải là 1 tài khoản gửi tiền có kỳ hạn, yêu cầu chọn 1 tài khoản khác." },
    "0043": { code: "0043", seq: 38, en: "Trx. between same accounts is not possible.", ko: "동일 계좌간에는 거래가 불가합니다", vi: "Không thể thực hiện giao dịch giữa một tài khoản (Tài khoản chuyển và tài khoản thụ hưởng không được trùng nhau)" },
    "0044": { code: "0044", seq: 39, en: "Confirm the account belongs to you.", ko: "고객소유계좌인지 확인하십시오. (펌서버 고객원장에 등록되지 않은 계좌)", vi: "Xác nhận tài khoản này thuộc về bạn" },
    "0045": { code: "0045", seq: 40, en: "Invalid Account", ko: "Invalid Account", vi: "Tài khoản không hợp lệ" },
    "0047": { code: "0047", seq: 41, en: "Refer to card issuer", ko: "수취 은행에서 입금 계좌나 카드에 제약이 있는 경우 (01, 15, 12, 57)", vi: "Tài khoản Thụ hưởng không hợp lệ (Sai tài khoản hoặc trạng thái tài khoản không hợp lệ)" },
    "0048": { code: "0048", seq: 42, en: "The deposit card number is missing", ko: "입금 카드 번호가 없습니다.", vi: "Số thẻ gửi tiền bị thiếu" },
    "0049": { code: "0049", seq: 43, en: "Card PIN activation is required", ko: "Card PIN activation is required", vi: "Cần phải kích hoạt mã PIN thẻ " },
    "0050": { code: "0050", seq: 44, en: "Transaction Restriction Card", ko: "Transaction Restriction Card", vi: "Thẻ này bị hạn chế giao dịch" },
    "0051": { code: "0051", seq: 45, en: "Lost Card", ko: "Lost Card", vi: "Thẻ này đã bị mất" },
    "0052": { code: "0052", seq: 46, en: "Stolen Card", ko: "Stolen Card", vi: "Thẻ này đã bị đánh cắp" },
    "0053": { code: "0053", seq: 47, en: "Expire Card", ko: "Expire Card", vi: "Thẻ bị hết hạn" },
    "0054": { code: "0054", seq: 48, en: "transaction is not possible.", ko: "거래가 불가능합니다. (출금 계좌 상태로 인한 에러, 사고 정지 등)", vi: "Giao dịch không thể được thực hiện" },
    "0058": { code: "0058", seq: 49, en: "The deposit account has been suspended.", ko: "입금 계좌가 정지되었습니다.", vi: "Tài khoản tiền gửi đã bị đình chỉ." },
    "0059": { code: "0059", seq: 50, en: "The withdrawal account has been suspended.", ko: "출금 계좌가 정지되었습니다.", vi: "Tài khoản rút tiền đã bị đình chỉ." },
    "0061": { code: "0061", seq: 51, en: "Suspected Fraud", ko: "Suspected Fraud", vi: "Nghi ngờ có dấu hiện gian lận trong giao dịch này" },
    "0062": { code: "0062", seq: 52, en: "The withdrawal account reported for an accident.", ko: "출금 계좌가 사고로 신고되었습니다.", vi: "Tài khoản rút tiền được báo cáo là có sự cố." },
    "0063": { code: "0063", seq: 53, en: "Limit exceeded", ko: "한도 초과입니다", vi: "Vượt quá hạn mức" },
    "0064": { code: "0064", seq: 54, en: "1 time transfer limit of user has been exceeded.", ko: "사용자의 1회 이체한도를 초과하였습니다.", vi: "Đã vượt quá giới hạn chuyển 1 lần của người dùng " },
    "0065": { code: "0065", seq: 55, en: "1 day transfer limit of user has been exceeded.", ko: "사용자의 1일 이체한도를 초과하였습니다.", vi: "Đã vượt quá giới hạn chuyển 1 ngày của người dùng" },
    "0066": { code: "0066", seq: 56, en: "1 month transfer limit has been exceeded.", ko: "사용자의 1개월 이체한도를 초과하였습니다.", vi: "Đã vượt quá giới hạn chuyển 1 tháng của người dùng" },
    "0067": { code: "0067", seq: 57, en: "Not registerd VND Transfer Limit", ko: "VND 이체한도가 등록되지 않았습니다.", vi: "Chưa đăng ký giới hạn chuyển tiền loại VND" },
    "0068": { code: "0068", seq: 58, en: "Not registerd USD Transfer Limit", ko: "USD 이체한도가 등록되지 않았습니다.", vi: "Chưa đăng ký giới hạn chuyển tiền loại USD" },
    "0069": { code: "0069", seq: 59, en: "Already paid to customer.", ko: "이미 입금처리 완료된 건입니다.", vi: "đã thanh toán cho khách hàng" },
    "0072": { code: "0072", seq: 60, en: "The bank code is invalid.", ko: "The bank code is invalid.", vi: "The bank code is invalid." },
    "0076": { code: "0076", seq: 61, en: "Invalid Account", ko: "Invalid Account", vi: "Tài khoản không hợp lệ" },
    "0999": { code: "0999", seq: 62, en: "Data cannot be found.", ko: "거래 처리 절차가 정상적이지 않습니다. (원거래 없이 응답거래가 있을 시)", vi: "Không tìm kiếm được dữ liệu" },
    "1018": { code: "1018", seq: 63, en: "Invalid card or Account number(no such number)", ko: "Invalid card or Account number(no such number)", vi: "Invalid card or Account number(no such number)" },
    "1030": { code: "1030", seq: 64, en: "Invalid card or Account number (no such number)", ko: "Invalid card or Account number (no such number)", vi: "Invalid card or Account number (no such number)" },
    "9999": { code: "9999", seq: 65, en: "Please check the private key", ko: "권한 부여 오류", vi: "Please check the private key" },
    "FB01": { code: "FB01", seq: 66, en: "The required field is omitted.", ko: "필수입력항목이 누락되었습니다. (Mandatory 값 없음)", vi: "Có những trường thông tin bắt buộc phải nhập vào, nhưng đang bị bỏ qua." },
    "FB02": { code: "FB02", seq: 67, en: "Input value is not valid.", ko: "입력값이 상호 정의된 유형값과 달라 처리할수 없습니다. (Type 틀림)", vi: "Giá trị Input nhập vào đang không hợp lệ" },
    "FB03": { code: "FB03", seq: 68, en: "Message Format Error", ko: "Message Format Error (전문 포맷이 맞지 않음, 적요에 특수 문자, 베트남어 등 있는 경우)", vi: "Lỗi về định dạng tin nhắn" },
    "G999": { code: "G999", seq: 69, en: "System error occurred during process", ko: "거래실패 하였습니다. 은행 담당자에게 연락 주십시오. (프로그램 에러, 내부 오류 등)", vi: "Xảy ra lỗi của hệ thống trong quá trình xử lý" },
});

/**
 * Locale-keyed projection over a single dictionary entry. Returns the
 * locale-appropriate string for the three workspace-supported locales
 * ({@code "EN"} / {@code "KO"} / {@code "VI"}). Falls through to EN as
 * a defensive default for any value the {@link Locale} type does not
 * already constrain.
 */
export function localizedMessage(entry: DictionaryVanEntry, locale: Locale): string {
    switch (locale) {
        case "KO": return entry.ko;
        case "VI": return entry.vi;
        case "EN":
        default:
            return entry.en;
    }
}
