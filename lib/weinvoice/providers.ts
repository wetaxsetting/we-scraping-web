/*
 * Provider (NCC) catalogue — 138 entries, UI Spec v1.0 (136 GDT list + 2 added).
 * The catalogue itself is binding spec data. The lookup helpers below are a
 * MOCK-era implementation: only providers whose lookup page accepts the code
 * in the URL get a direct deep link; every other provider opens its generic
 * lookup page (§3.4). No captcha is ever bypassed.
 */

export type Provider = {
    stt: number;
    taxId: string;
    name: string;
    fullName: string;
    web: string;
    lookupUrl: string;
    captchaUrl?: string;
    altLookupUrls?: string[];

    verify?: string;
};

export const PROVIDERS: Provider[] = [
    { "stt": 1, "taxId": "0314743623", "name": "Vĩnh Hy", "fullName": "Công ty TNHH Công nghệ Vĩnh Hy", "web": "http://ehoadondientu.com", "lookupUrl": "https://ehoadondientu.com/Tra-cuu" },
    { "stt": 2, "taxId": "0104128565", "name": "FPT", "fullName": "Công ty TNHH Hệ thống thông tin FPT", "web": "https://einvoice.fpt.com.vn", "lookupUrl": "https://tracuuhoadon.fpt.com.vn/" },
    { "stt": 3, "taxId": "0102519041", "name": "EFY iHoadon", "fullName": "Công ty Cổ phần Công nghệ tin học EFY Việt Nam", "web": "https://ihoadon.vn", "lookupUrl": "https://ihoadon.vn/kiem-tra/?lang=vn" },
    { "stt": 4, "taxId": "0105987432", "name": "EasyInvoice", "fullName": "Công ty Cổ phần Đầu tư công nghệ và thương mại Softdreams", "web": "https://easyinvoice.vn", "lookupUrl": "https://tracuu.easyinvoice.vn/", "captchaUrl": "https://tracuu.easyinvoice.vn/Captcha/Show" },
    { "stt": 5, "taxId": "0302999571", "name": "einvoice.lcs.com.vn", "fullName": "Công ty TNHH L.C.S", "web": "https://einvoice.lcs.com.vn", "lookupUrl": "https://eip.lcssoft.com.vn/desktop/#/login", "verify": "Link tra cứu trỏ tới trang đăng nhập" },
    { "stt": 6, "taxId": "0313963672", "name": "kkvat.com.vn", "fullName": "Công ty TNHH Soft Ware KK VAT", "web": "http://kkvat.com.vn/thongtin", "lookupUrl": "https://tracuuhoadon.kkvat.com.vn/" },
    { "stt": 7, "taxId": "0105232093", "name": "CyberBill", "fullName": "Công ty Cổ phần CyberLotus", "web": "https://cyberbill.vn", "lookupUrl": "https://hotro.xcyber.vn/ho-tro/tra-cuu", "altLookupUrls": ["https://tracuuhoadon2.xcyber.vn/#/tracuuhoadon/tracuu"] },
    { "stt": 8, "taxId": "0311942758", "name": "ngogiaphat.vn", "fullName": "Công ty TNHH Giải pháp công nghệ Ngô Gia Phát", "web": "http://www.ngogiaphat.vn", "lookupUrl": "https://tracuuonline.ngogiaphat.vn/Search.aspx" },
    { "stt": 9, "taxId": "0302712571", "name": "Mắt Bão", "fullName": "Công ty Cổ phần Mắt Bão", "web": "https://matbao.in", "lookupUrl": "https://matbao.in/tra-cuu-hoa-don" },
    { "stt": 10, "taxId": "0103930279", "name": "Nacencomm", "fullName": "Công ty Cổ phần công nghệ thẻ Nacencomm", "web": "https://www.nacencomm.com.vn/dich-vu-chi-tiet/hoa-don-dien-tu", "lookupUrl": "https://hoadon78.nacencomm.vn/tracuuhd.aspx" },
    { "stt": 11, "taxId": "0105844836", "name": "Megabiz vInvoice", "fullName": "Công ty Cổ phần Megabiz Việt Nam", "web": "https://vinvoice.vn", "lookupUrl": "https://tracuu.vinvoice.vn/", "captchaUrl": "https://tracuu.vinvoice.vn/Captcha/Show" },
    { "stt": 12, "taxId": "0312483391", "name": "azinvoice.com", "fullName": "Công ty TNHH Công nghệ LCD Việt Nam", "web": "https://azinvoice.com", "lookupUrl": "https://azinvoice.vn/#/search-xml" },
    { "stt": 13, "taxId": "0101243150", "name": "MISA", "fullName": "Công ty Cổ phần MISA", "web": "https://www.meinvoice.vn/", "lookupUrl": "https://www.meinvoice.vn/tra-cuu/" },
    { "stt": 14, "taxId": "0106026495", "name": "M-Invoice", "fullName": "Công ty TNHH Hóa đơn điện tử M-INVOICE", "web": "https://minvoice.vn/", "lookupUrl": "https://tracuuhoadon.minvoice.com.vn/tra-cuu-hoa-don" },
    { "stt": 15, "taxId": "0313906508", "name": "nguyenminhvat.vn", "fullName": "Công ty Cổ phần Phát triển công nghệ Nguyễn Minh", "web": "https://www.nguyenminhvat.vn", "lookupUrl": "https://www.nguyenminhvat.vn" },
    { "stt": 16, "taxId": "0101300842", "name": "Thái Sơn", "fullName": "Công ty TNHH Phát triển công nghệ Thái Sơn", "web": "https://www.einvoice.vn", "lookupUrl": "https://tracuutvan.einvoice.com.vn/" },
    { "stt": 17, "taxId": "0306784030", "name": "ehoadon.online", "fullName": "Công ty TNHH Máy tính và truyền thông công nghệ kết nối", "web": "https://ehoadon.online", "lookupUrl": "https://ehoadon.online/einvoice/lookup" },
    { "stt": 18, "taxId": "0200638946", "name": "oinvoice.vn", "fullName": "Công ty Cổ phần công nghệ số và in đồ họa", "web": "https://oinvoice.vn", "lookupUrl": "https://oinvoice.vn/tracuu/" },
    { "stt": 19, "taxId": "0312303803", "name": "wininvoice.vn", "fullName": "Công ty TNHH Win Tech Solution", "web": "https://wininvoice.vn", "lookupUrl": "https://tracuu.wininvoice.vn/", "verify": "Dùng chung link tra cứu với: Công ty Cổ phần Công nghệ Trường Minh Thịnh" },
    { "stt": 20, "taxId": "0100109106", "name": "Viettel", "fullName": "Tập đoàn Công nghiệp - Viễn thông quân đội", "web": "https://viettel.vn/s-invoice", "lookupUrl": "https://vinvoice.viettel.vn/utilities/invoice-search" },
    { "stt": 21, "taxId": "0102454468", "name": "Tax24", "fullName": "Công ty Cổ phần Công nghệ thông tin Đông Nam Á", "web": "https://tax24.com.vn/thuedientu/san-pham-dich-vu/hoa-don-dien-tu.", "lookupUrl": "https://tax24.com.vn/thuedientu/san-pham-dich-vu/hoa-don-dien-tu", "captchaUrl": "https://tax24.com.vn/einvoice/servlet/ImageServlet" },
    { "stt": 22, "taxId": "0105937449", "name": "NewInvoice", "fullName": "Công ty Cổ phần hóa đơn điện tử New-Invoice", "web": "https://newinvoice.com.vn", "lookupUrl": "https://newinvoice.com.vn/tra-cuu/" },
    { "stt": 23, "taxId": "0108516079", "name": "3asoft.vn", "fullName": "Công ty Cổ phần Giải pháp phần mềm 3A", "web": "http://3asoft.vn", "lookupUrl": "http://hddt.3asoft.vn/" },
    { "stt": 24, "taxId": "0100686209", "name": "MobiFone", "fullName": "Tổng công ty Viễn thông Mobifone", "web": "https://itc.mobifone.vn/giai_phap/mobifone-invoice", "lookupUrl": "http://tracuuhoadon.mobifoneinvoice.vn/" },
    { "stt": 25, "taxId": "0101360697", "name": "BKAV", "fullName": "Công ty Cổ phần BKAV", "web": "https://van.ehoadon.vn", "lookupUrl": "https://van.ehoadon.vn/TCHD" },
    { "stt": 26, "taxId": "0101162173", "name": "asiainvoice.vn", "fullName": "Công ty Cổ phần phát triển phần mềm ASIA", "web": "https://asiainvoice.vn", "lookupUrl": "https://asiainvoice.vn/tra-cuu/", "captchaUrl": "https://asiainvoice.vn/tra-cuu/GetCaptcha" },
    { "stt": 27, "taxId": "0401486901", "name": "vin-hoadon.com", "fullName": "Công ty Cổ phần thương mại Visnam", "web": "https://vin-hoadon.com", "lookupUrl": "https://tracuu.vin-hoadon.com/", "captchaUrl": "https://tracuu.vin-hoadon.com/api/services/hddt/TraCuuHoaDon/RefreshCaptcha" },
    { "stt": 28, "taxId": "0200784873", "name": "dinhvibachkhoa.vn", "fullName": "Công ty Cổ phần Thiết bị điện - Điện tử Bách Khoa", "web": "https://dinhvibachkhoa.vn", "lookupUrl": "https://hoadonbachkhoa.pmbk.vn/tra-cuu-hoa-don" },
    { "stt": 29, "taxId": "0100684378", "name": "VNPT", "fullName": "Tập Đoàn Bưu chính viễn thông Việt Nam", "web": "https://vnpt-invoice.com.vn/", "lookupUrl": "https://vnpt-invoice.com.vn/", "captchaUrl": "https://gateway-hst.vnpt-invoice.com.vn/admin/api/share/get-captcha?width=120&height=40" },
    { "stt": 30, "taxId": "0106713804", "name": "HILO", "fullName": "Công ty Cổ phần dịch vụ T-VAN HILO", "web": "https://hiloinvoice.vn", "lookupUrl": "https://tracuuhddt78.hilo.com.vn/" },
    { "stt": 31, "taxId": "0314209362", "name": "hoadondientuvat.com", "fullName": "Công ty Cổ phần Minh Khang Group", "web": "http://hoadondientuvat.com/Thong-tin", "lookupUrl": "https://hoadondientuvat.com/Tracuu.aspx" },
    { "stt": 32, "taxId": "0101352495", "name": "VNInvoice", "fullName": "Công ty Cổ phần Giải pháp hóa đơn điện tử Việt Nam", "web": "https://www.vninvoice.vn", "lookupUrl": "https://tracuu.v50.vninvoice.vn/", "verify": "Dùng chung link tra cứu với: Công ty Cổ phần tích hợp công nghệ VNISC" },
    { "stt": 33, "taxId": "0102182292", "name": "VNPAY", "fullName": "Công ty Cổ phần giải pháp thanh toán Việt Nam", "web": "https://www.vnpay.vn", "lookupUrl": "https://portal.vnpayinvoice.vn/" },
    { "stt": 34, "taxId": "0106870211", "name": "VietInvoice", "fullName": "Công ty Cổ phần ICORP", "web": "https://vietinvoice.vn", "lookupUrl": "https://tracuu.vietinvoice.vn/#/" },
    { "stt": 35, "taxId": "0104614692", "name": "hoadontvan.com", "fullName": "Công ty Cổ phần đầu tư và công nghệ idocNet", "web": "https://hoadontvan.com", "lookupUrl": "https://hoadontvan.com/TraCuu" },
    { "stt": 36, "taxId": "0309612872", "name": "smartsign.com.vn", "fullName": "Công ty Cổ phần chữ ký số VI NA", "web": "https://www.smartsign.com.vn", "lookupUrl": "https://tracuuhd.smartsign.com.vn/" },
    { "stt": 37, "taxId": "0309478306", "name": "TS24", "fullName": "Công ty Cổ phần TS24", "web": "https://www.xuathoadon.vn/", "lookupUrl": "https://tracuu.xuathoadon.vn/" },
    { "stt": 38, "taxId": "0315298333", "name": "tctinvoice.com", "fullName": "Công ty TNHH Hóa đơn điện tử TCT", "web": "https://www.tctinvoice.com", "lookupUrl": "https://www.tctinvoice.com" },
    { "stt": 39, "taxId": "0303609305", "name": "ihoadondientu.com", "fullName": "Công ty TNHH Tin học Tia lửa Việt", "web": "https://ihoadondientu.com", "lookupUrl": "https://ihoadondientu.com/Tra-cuu" },
    { "stt": 40, "taxId": "0100727825", "name": "Fast", "fullName": "Công ty Cổ phần phần mềm quản lý doanh nghiệp", "web": "https://www.fast.com.vn", "lookupUrl": "https://invoice.fast.com.vn/tra-cuu-hoa-don-dien-tu/", "verify": "Dùng chung link tra cứu với: Công ty Cổ phần giải pháp First Trust" },
    { "stt": 41, "taxId": "0315467091", "name": "acconline.vn", "fullName": "Công ty TNHH ACCONLINE.VN", "web": "https://acconline.vn", "lookupUrl": "https://acconline.vn/vn/tra-cuu-hoa-don.htm" },
    { "stt": 42, "taxId": "0315638251", "name": "htinvoice.com.vn", "fullName": "Công ty Cổ phần công nghệ hóa đơn điện tử HT", "web": "http://htinvoice.com.vn", "lookupUrl": "https://laphoadon.htinvoice.vn/TraCuu" },
    { "stt": 43, "taxId": "0105958921", "name": "cloudinvoice.vn", "fullName": "Công ty Cổ phần công nghệ ITT", "web": "https://cloudinvoice.vn", "lookupUrl": "https://tracuu.cloudinvoice.vn/" },
    { "stt": 44, "taxId": "0302431595", "name": "hoadon30s.vn", "fullName": "Công ty TNHH PA Việt Nam", "web": "https://hoadon30s.vn", "lookupUrl": "https://tracuu.hoadon30s.vn/" },
    { "stt": 45, "taxId": "0103018807", "name": "vnisc.com.vn", "fullName": "Công ty Cổ phần tích hợp công nghệ VNISC", "web": "https://vnisc.com.vn", "lookupUrl": "https://tracuu.v50.vninvoice.vn/", "verify": "Dùng chung link tra cứu với: Công ty Cổ phần Giải pháp hóa đơn điện tử Việt Nam" },
    { "stt": 46, "taxId": "0106820789", "name": "hoadondientuvn.info", "fullName": "Công ty TNHH Giải pháp hóa đơn điện tử My – Invoice", "web": "https://hoadondientuvn.info", "lookupUrl": "https://tracuu.hoadondientuvn.info/#/tracuuhoadon/tracuu" },
    { "stt": 47, "taxId": "0310151055", "name": "safeinvoice.vn", "fullName": "Công ty Cổ phần Chứng số An toàn", "web": "https://www.SAFEinvoice.vn", "lookupUrl": "https://www.safecert.com.vn/search_certificate", "verify": "Link là tra cứu chứng thư số, không phải hoá đơn" },
    { "stt": 48, "taxId": "0303430876", "name": "spc-technology.com", "fullName": "Công ty Cổ phần công nghệ San Phú", "web": "https://www.spc-technology.com", "lookupUrl": "https://dailychukyso.com.vn/mst/tools/read-xml.php", "verify": "Link là công cụ đọc XML của bên thứ ba, không phải cổng tra cứu" },
    { "stt": 49, "taxId": "0301452923", "name": "hoadondientu.lienson.vn", "fullName": "Công ty TNHH Giấy vi tính Liên Sơn", "web": "https://hoadondientu.lienson.vn", "lookupUrl": "https://tracuu.lienson.vn/#/tracuuhoadon/tracuu" },
    { "stt": 50, "taxId": "0314185087", "name": "onlinevina.com.vn", "fullName": "Công ty TNHH Thương Mại dịch vụ Online VI NA", "web": "https://onlinevina.com.vn", "lookupUrl": "https://hoadon.onlinevina.com.vn/invoice" },
    { "stt": 51, "taxId": "0100687474", "name": "hoadondientu-ptp.vn", "fullName": "Công ty Cổ phần dịch vụ viễn thông và in Bưu điện", "web": "https://hoadondientu-ptp.vn", "lookupUrl": "https://hoadondientu-ptp.vn/tra-cuu/" },
    { "stt": 52, "taxId": "0400462489", "name": "e-invoicetuanchau.com", "fullName": "Công ty TNHH Tuần Châu", "web": "http://e-invoicetuanchau.com", "lookupUrl": "https://e-invoicetuanchau.com/Tra-cuu" },
    { "stt": 53, "taxId": "3500456910", "name": "hoadonminhthuvungtau.com", "fullName": "Công ty TNHH Minh Thư", "web": "https://hoadonminhthuvungtau.com", "lookupUrl": "https://hoadonminhthuvungtau.com/Tra-cuu" },
    { "stt": 54, "taxId": "0104908371", "name": "acman.vn", "fullName": "Công ty Cổ phần phát triển công nghệ ACMAN", "web": "https://www.acman.vn/hoa-don-dien-tu.html", "lookupUrl": "https://hoadondientu.acman.vn/tra-cuu/hoa-don.html" },
    { "stt": 55, "taxId": "0315191291", "name": "hoadonsovn.net", "fullName": "Công ty TNHH Tư vấn thương mại Trí Việt Luật", "web": "https://hoadonsovn.net", "lookupUrl": "https://hoadonsovn.evat.vn" },
    { "stt": 56, "taxId": "0313844107", "name": "voice.hoadondientu.net.vn", "fullName": "Công ty TNHH Đầu tư Hòn Ngọc Việt", "web": "http://voice.hoadondientu.net.vn", "lookupUrl": "http://voice.hoadondientu.net.vn/tra-cuu" },
    { "stt": 57, "taxId": "0311622035", "name": "congtyinhoadon.com", "fullName": "Công ty TNHH Dịch vụ Trí Việt Luật", "web": "http://congtyinhoadon.com", "lookupUrl": "https://tvl.evat.vn/" },
    { "stt": 58, "taxId": "0106361479", "name": "ahoadon.com", "fullName": "Công ty Cổ phần truyền số liệu Việt Nam", "web": "https://ahoadon.com", "lookupUrl": "https://ahoadon.com" },
    { "stt": 59, "taxId": "0312270160", "name": "ameinvoice.com.vn", "fullName": "Công ty TNHH NC9 Việt Nam", "web": "http://ameinvoice.com.vn", "lookupUrl": "https://ameinvoice.vn/invoice-inquiry/" },
    { "stt": 60, "taxId": "0104493085", "name": "fts.com.vn", "fullName": "Công ty Cổ phần giải pháp First Trust", "web": "https://www.fts.com.vn/phan-mem-hoa-don-dien-tu/", "lookupUrl": "https://invoice.fast.com.vn/tra-cuu-hoa-don-dien-tu/", "verify": "Dùng chung link tra cứu với: Công ty Cổ phần phần mềm quản lý doanh nghiệp" },
    { "stt": 61, "taxId": "0101289966", "name": "hoadon.biz", "fullName": "Công ty TNHH Phần mềm Nhân Hòa", "web": "https://hoadon.biz", "lookupUrl": "https://tracuu.e-hoadon.cloud/" },
    { "stt": 62, "taxId": "0303211948", "name": "ketoanvlc.com", "fullName": "Công ty TNHH Kế toán và tư vấn V.L.C", "web": "https://ketoanvlc.com", "lookupUrl": "https://vlc.evat.vn/" },
    { "stt": 63, "taxId": "0101622374", "name": "tamvietgroup.vn", "fullName": "Công ty Cổ phần Công nghệ và giải pháp Tâm Việt", "web": "http://tamvietgroup.vn", "lookupUrl": "http://tamvietgroup.vn" },
    { "stt": 64, "taxId": "0310768095", "name": "hoadondientu.link", "fullName": "Công ty TNHH Dịch vụ phần mềm AVSE", "web": "http://hoadondientu.link", "lookupUrl": "https://hoadondientu.link/tracuutt78" },
    { "stt": 65, "taxId": "0312961577", "name": "tracuuhoadon.benthanhvoice.vn", "fullName": "Công ty TNHH MTV in Bến Thành", "web": "http://tracuuhoadon.benthanhvoice.vn", "lookupUrl": "https://tracuuhoadon.benthanhvoice.vn/" },
    { "stt": 66, "taxId": "0313950909", "name": "koffi.vn", "fullName": "Công ty TNHH ZAMO", "web": "https://koffi.vn", "lookupUrl": "https://koffi.vn/outbound/lookup-invoice" },
    { "stt": 67, "taxId": "0311928954", "name": "hddt.vietinfo.tech", "fullName": "Công ty Cổ phần công nghệ VIETINFO", "web": "https://hddt.vietinfo.tech", "lookupUrl": "https://tracuuhoadon.vietinfo.tech/" },
    { "stt": 68, "taxId": "0103770970", "name": "bitware.vn", "fullName": "Công ty Cổ phần phát triển phần mềm và công nghệ Bitware", "web": "http://www.bitware.vn/services/hoa-don-dien-tu/", "lookupUrl": "https://www.bitware.vn/tracuuhoadon/" },
    { "stt": 69, "taxId": "0305142231", "name": "rosysoft.vn", "fullName": "Công ty Cổ phần phần mềm Rosy", "web": "https://rosysoft.vn", "lookupUrl": "https://rosysoft.vn" },
    { "stt": 70, "taxId": "3702037020", "name": "trandinhtung.evat.vn", "fullName": "Công ty TNHH MTV thương mại dịch vụ Trần Đình Tùng", "web": "https://trandinhtung.evat.vn", "lookupUrl": "https://trandinhtung.evat.vn/" },
    { "stt": 71, "taxId": "0101925883", "name": "CMC", "fullName": "Công ty TNHH Tổng công ty Công nghệ và Giải pháp CMC", "web": "https://store.cmcts.com.vn", "lookupUrl": "https://cinvoice.cmctelecom.vn/" },
    { "stt": 72, "taxId": "0316642395", "name": "phuongnam.evat.vn", "fullName": "Công ty TNHH Công nghệ và tư vấn Phương Nam", "web": "https://phuongnam.evat.vn/log", "lookupUrl": "https://phuongnam.evat.vn/" },
    { "stt": 73, "taxId": "0315194912", "name": "ttltax.com", "fullName": "Công ty TNHH Dịch vụ kế toán - Tư vấn thuế TTL", "web": "https://ttltax.com", "lookupUrl": "https://tracuu.ttltax.com/" },
    { "stt": 74, "taxId": "0315983667", "name": "hoadondientuvietnam.vn", "fullName": "Công ty Cô phần Công nghệ Phát triển hóa đơn điện tử Việt Nam", "web": "http://hoadondientuvietnam.vn", "lookupUrl": "http://hoadondientuvietnam.vn" },
    { "stt": 75, "taxId": "0310926922", "name": "invoice.ehcm.vn", "fullName": "Công ty TNHH Phần mềm kế toán và dịch vụ thủ tục thuế Sài Gòn", "web": "https://invoice.ehcm.vn", "lookupUrl": "https://invoice.ehcm.vn/#TraCuu" },
    { "stt": 76, "taxId": "0101010702", "name": "thanglongsoft.com", "fullName": "Công ty Cổ phần Phần mềm Thăng Long", "web": "http://thanglongsoft.com/index.php/linh-v-c-kinh-doanh/493-l-nh-va-c-kinh-doanh/493-1-l-nh-va-c-kinh-doanh", "lookupUrl": "http://thanglongsoft.com/index.php/linh-v-c-kinh-doanh/493-l-nh-va-c-kinh-doanh/493-1-l-nh-va-c-kinh-doanh" },
    { "stt": 77, "taxId": "0102720409", "name": "tigtax.vn", "fullName": "Công ty Cổ phần Hóa đơn điện tử TIG Thăng Long", "web": "http://tigtax.vn", "lookupUrl": "http://tigtax.vn" },
    { "stt": 78, "taxId": "0314058603", "name": "vdsg-invoice.vn", "fullName": "Công ty TNHH Viễn thông Đông Sài Gòn", "web": "https://www.vdsg-invoice.vn", "lookupUrl": "https://www.vdsg-invoice.vn/Account/Login", "verify": "Link tra cứu trỏ tới trang đăng nhập" },
    { "stt": 79, "taxId": "0301448733", "name": "Lạc Việt", "fullName": "Công ty Cổ phần Tin học Lạc Việt", "web": "https://accnet.vn/hoa-don-dien-tu", "lookupUrl": "https://accnet.vn/tra-cuu-hoa-don-dien-tu" },
    { "stt": 80, "taxId": "0313253288", "name": "autoinvoice.vn", "fullName": "Công ty Cổ phần Công nghệ TADU", "web": "https://autoinvoice.vn", "lookupUrl": "https://tracuu.autoinvoice.vn/" },
    { "stt": 81, "taxId": "0309889835", "name": "unit.com.vn", "fullName": "Công ty Cổ phần Công nghệ UNIT", "web": "https://unit.com.vn/", "lookupUrl": "https://unit.com.vn/" },
    { "stt": 82, "taxId": "0202029650", "name": "hoadondientu.pmbk.vn", "fullName": "Công ty Cổ phần phát triển và ứng dụng phần mềm Bách Khoa", "web": "https://hoadondientu.pmbk.vn", "lookupUrl": "https://hdbk.pmbk.vn/tra-cuu-hoa-don" },
    { "stt": 83, "taxId": "0108971656", "name": "MyInvoice", "fullName": "Công ty Cổ phần My Software", "web": "https://mysoftware.vn", "lookupUrl": "https://tracuu.myinvoice.vn/#/" },
    { "stt": 84, "taxId": "0312942260", "name": "ihoadondientu.net", "fullName": "Công ty TNHH Công nghệ HT Sài Gòn", "web": "http://ihoadondientu.net", "lookupUrl": "https://ihoadondientu.net/Tracuu.aspx" },
    { "stt": 85, "taxId": "1201496252", "name": "WeTax", "fullName": "Công ty TNHH WEBCASH Việt Nam", "web": "https://einvoice.webcashvietnam.com/", "lookupUrl": "https://wetax.com.vn/tra-cuu" },
    { "stt": 86, "taxId": "0303549303", "name": "e-invoices.vn", "fullName": "Công ty TNHH Phần mềm và Tư vấn Kim Tự Tháp", "web": "https://e-invoices.vn/", "lookupUrl": "https://e-invoices.vn/User/Search" },
    { "stt": 87, "taxId": "0311914694", "name": "brightbrain.vn", "fullName": "Công ty TNHH Phần mềm BRB", "web": "http://brightbrain.vn/hoa-don-dien-tu/", "lookupUrl": "http://brightbrain.vn/hoa-don-dien-tu/" },
    { "stt": 88, "taxId": "0312617990", "name": "cloudteam.vn", "fullName": "Công ty TNHH Nhóm Mây", "web": "https://www.cloudteam.vn", "lookupUrl": "https://chanel-eportal.cloudteam.vn/" },
    { "stt": 89, "taxId": "0109282176", "name": "vininvoice.vn", "fullName": "Công ty Cổ phần Hóa đơn điện tử VININVOICE", "web": "https://vininvoice.vn", "lookupUrl": "https://tracuu.vininvoice.vn/#/" },
    { "stt": 90, "taxId": "0102723181", "name": "hoadonct.gov.vn", "fullName": "Trung tâm Tin học và Công nghệ số", "web": "http://hoadonct.gov.vn", "lookupUrl": "http://hoadonct.gov.vn" },
    { "stt": 91, "taxId": "0106858609", "name": "VETC", "fullName": "Công ty Cổ phần VETC", "web": "https://vetc.com.vn", "lookupUrl": "https://tracuuhoadon.vetc.com.vn/" },
    { "stt": 92, "taxId": "0315151651", "name": "pvssolution.com", "fullName": "Công ty TNHH Phần mềm PVS", "web": "https://pvssolution.com/", "lookupUrl": "https://invoice.pvssolution.com/" },
    { "stt": 93, "taxId": "0310151739", "name": "news.yoinvoice.vn", "fullName": "Công ty Cổ phần Dịch vụ Thương mại Việt Nam trực tuyến", "web": "https://news.yoinvoice.vn", "lookupUrl": "https://news.yoinvoice.vn" },
    { "stt": 94, "taxId": "0312575123", "name": "ecount.com", "fullName": "Công ty TNHH Ecount Việt Nam", "web": "https://ecount.com", "lookupUrl": "https://ecount.com" },
    { "stt": 95, "taxId": "0107732197", "name": "atis.com.vn", "fullName": "Công ty Cổ phần ATIS", "web": "https://atis.com.vn/hoa-don-dien-tu", "lookupUrl": "https://tracuuhoadon.atis.com.vn/" },
    { "stt": 96, "taxId": "0101659906", "name": "kaike.vn", "fullName": "Công ty Cổ phần GMO-Z.com RUNSYSTEM", "web": "https://kaike.vn/hoa-don-dien-tu", "lookupUrl": "https://tracuu.kaike.vn/" },
    { "stt": 97, "taxId": "0103019524", "name": "aits.vn", "fullName": "Công ty Cổ phần Tin học - Viễn thông Hàng không", "web": "https://aits.vn/", "lookupUrl": "https://einvoice.aits.vn/" },
    { "stt": 98, "taxId": "0316114998", "name": "Bizzi", "fullName": "Công ty TNHH Bizzi VietNam", "web": "https://bizzi.vn/", "lookupUrl": "https://tchd.bizzi.vn/" },
    { "stt": 99, "taxId": "0316636497", "name": "beetek.vn", "fullName": "Công ty Cổ phần Công nghệ BEE", "web": "http://beetek.vn/", "lookupUrl": "http://beetek.vn/" },
    { "stt": 100, "taxId": "0106249501", "name": "mont-e.com", "fullName": "Công ty Cổ phần MONT-E", "web": "https://mont-e.com/", "lookupUrl": "https://mont-e.com/" },
    { "stt": 101, "taxId": "0201802839", "name": "homecasta.vn", "fullName": "Công ty TNHH Tư vấn và Dịch vụ Home Casta", "web": "https://homecasta.vn", "lookupUrl": "https://tracuu.homecasta.vn/#/" },
    { "stt": 102, "taxId": "4601328480", "name": "sonphat.vn", "fullName": "Công ty CP Tư vấn và Chuyển giao công nghệ Sơn Phát", "web": "https://sonphat.vn", "lookupUrl": "https://tracuuhoadon.sonphat.vn/" },
    { "stt": 103, "taxId": "0104359717", "name": "KiotViet", "fullName": "Công ty Cổ phần công nghệ KIOTVIET", "web": "https://hoadondientu.kiotviet.vn", "lookupUrl": "https://tracuuhoadon.kiotviet.vn/" },
    { "stt": 104, "taxId": "0312662961", "name": "Haravan", "fullName": "Công ty Cổ phần công nghệ HARAVAN", "web": "https://haravan.com/pages/giai-phap-xuat-hoa-don-dien-tu", "lookupUrl": "https://e-invoices.haravan.app/" },
    { "stt": 105, "taxId": "0104789847", "name": "iPOS", "fullName": "Công ty Cổ phần IPOS.VN", "web": "https://ipos.vn/", "lookupUrl": "https://tracuuhoadon.ipos.vn/" },
    { "stt": 106, "taxId": "0110333410", "name": "intrustdss.vn", "fullName": "Công ty Cổ phần Dịch vụ Chữ ký số INTRUST", "web": "https://intrustdss.vn/san-pham/chi-tiet/4", "lookupUrl": "https://lookupeinvoice.intrustdss.vn/", "verify": "Dùng chung link tra cứu với: Công ty Cổ phần SCHOOL TECH" },
    { "stt": 107, "taxId": "0317509886", "name": "yoyoin.yoyoschool.vn", "fullName": "Công ty Cổ phần SCHOOL TECH", "web": "https://yoyoin.yoyoschool.vn", "lookupUrl": "https://lookupeinvoice.intrustdss.vn/", "verify": "Dùng chung link tra cứu với: Công ty Cổ phần Dịch vụ Chữ ký số INTRUST" },
    { "stt": 108, "taxId": "0103243195", "name": "Sapo", "fullName": "Công ty Cổ phần Công nghệ Sapo", "web": "https://www.sapo.vn/blog/sapo-invoice", "lookupUrl": "https://www.sapo.vn/tra-cuu-sapo-invoice.html" },
    { "stt": 109, "taxId": "0109039397", "name": "pos.pancake.vn", "fullName": "Công ty TNHH Pancake Việt Nam", "web": "https://pos.pancake.vn/e-invoice", "lookupUrl": "https://tracuu.pancake.vn/" },
    { "stt": 110, "taxId": "0109045760", "name": "netacom.vn", "fullName": "Công ty Cổ phần Technology Convergence Corporation", "web": "https://netacom.vn/neta-einvoice.html", "lookupUrl": "https://0109045760hd.easyinvoice.vn/Search/Index" },
    { "stt": 111, "taxId": "0111090707", "name": "hoadon.igas.vn", "fullName": "Công ty Cổ phần Giải pháp số IGAS", "web": "https://hoadon.igas.vn", "lookupUrl": "https://tracuu.igas.vn/" },
    { "stt": 112, "taxId": "0109996406", "name": "invoi.vn", "fullName": "Công ty TNHH OG Technologies", "web": "https://invoi.vn", "lookupUrl": "https://invoi.vn" },
    { "stt": 113, "taxId": "0318511655", "name": "ttc.t-hoadon.vn", "fullName": "Công ty Cổ phần giải pháp doanh nghiệp TTC", "web": "https://ttc.t-hoadon.vn", "lookupUrl": "https://tracuu.t-hoadon.vn/" },
    { "stt": 114, "taxId": "0109193102", "name": "invoice.iamsoftware.com.vn", "fullName": "Công ty Cổ phần phần mềm IAM Việt Nam", "web": "https://invoice.iamsoftware.com.vn", "lookupUrl": "https://tracuu.iamsoftware.com.vn/" },
    { "stt": 115, "taxId": "0109959309", "name": "sfin.vn", "fullName": "Công ty Cổ phần Công nghệ thông minh SFIN", "web": "https://sfin.vn/", "lookupUrl": "https://sfin.vn/" },
    { "stt": 116, "taxId": "0301463315", "name": "smartinvoice.vn", "fullName": "Công ty TNHH Truyền hình cáp SaigonTourist", "web": "https://smartinvoice.vn", "lookupUrl": "https://tracuu-hddt.sctv.vn/" },
    { "stt": 117, "taxId": "0305289153", "name": "mmhoadon.vn", "fullName": "Công ty Cổ phần Dịch vụ Di động Trực tuyến", "web": "https://mmhoadon.vn", "lookupUrl": "https://tracuu.mmhoadon.vn/" },
    { "stt": 118, "taxId": "0111245245", "name": "gohoadon.vn", "fullName": "Công ty Cổ phần Công nghệ Go Việt Nam", "web": "https://gohoadon.vn", "lookupUrl": "https://tracuu.gohoadon.vn/" },
    { "stt": 119, "taxId": "0110784036", "name": "taxnet.vn", "fullName": "Công ty TNHH Công nghệ và Dịch vụ thuế TAXNET", "web": "https://taxnet.vn", "lookupUrl": "https://tracuuhoadon.taxnet.vn/" },
    { "stt": 120, "taxId": "0110585520", "name": "hoadon.aibat.vn", "fullName": "Công ty Cổ phần Công nghệ AIBAT", "web": "https://hoadon.aibat.vn", "lookupUrl": "https://hoadon.aibat.vn" },
    { "stt": 121, "taxId": "0108824877", "name": "dangky.nhanh.vn", "fullName": "Công ty Cổ phần Nhanh.VN", "web": "https://dangky.nhanh.vn/xuat_hoa_don_dien_tu", "lookupUrl": "https://dangky.nhanh.vn/xuat_hoa_don_dien_tu" },
    { "stt": 122, "taxId": "0106166781", "name": "nc-ca.com.vn", "fullName": "Công ty Cổ phần Công nghệ NCCA", "web": "https://nc-ca.com.vn/", "lookupUrl": "https://hddt.hddt-nc.vn/" },
    { "stt": 123, "taxId": "0108190282", "name": "vuhai.co", "fullName": "Công ty Cổ phần Ứng dụng Công nghệ Vũ Hải", "web": "https://vuhai.co", "lookupUrl": "https://hoadon.vuhai.co/" },
    { "stt": 124, "taxId": "0311174986", "name": "wiinvoice.vn", "fullName": "Công ty Cổ phần Công nghệ Trường Minh Thịnh", "web": "https://wiinvoice.vn/", "lookupUrl": "https://tracuu.wininvoice.vn/", "verify": "Dùng chung link tra cứu với: Công ty TNHH Win Tech Solution" },
    { "stt": 125, "taxId": "0316794479", "name": "xinvoice.vn", "fullName": "Công ty TNHH Casso", "web": "https://xinvoice.vn", "lookupUrl": "https://xinvoice.vn" },
    { "stt": 126, "taxId": "0108269133", "name": "epayjsc.com", "fullName": "Công ty Cổ phần Dịch vụ EPAY", "web": "https://www.epayjsc.com", "lookupUrl": "https://tracuuhoadon.epayjsc.com/" },
    { "stt": 127, "taxId": "0316887099", "name": "1invoice.vn", "fullName": "Công ty Cổ phần Giải pháp ATOM", "web": "https://1invoice.vn", "lookupUrl": "https://tracuuhoadon.1invoice.vn/tra-cuu-hoa-don" },
    { "stt": 128, "taxId": "1602159776", "name": "bado.vn", "fullName": "Công ty TNHH Dịch vụ và Giải pháp Phần mềm Bado", "web": "https://bado.vn/hoa-don-dien-tu", "lookupUrl": "https://tracuu.bado.vn/" },
    { "stt": 129, "taxId": "0102595740", "name": "VNPost", "fullName": "Tổng Công ty Bưu điện Việt Nam", "web": "https://vietnampost.vn", "lookupUrl": "https://tracuuhoadon.vnpost.vn/" },
    { "stt": 130, "taxId": "0110400071", "name": "hoadon.ontik.vn", "fullName": "Công ty CP Giải pháp số ONTIK", "web": "https://hoadon.ontik.vn", "lookupUrl": "https://hoadon.ontik.vn/" },
    { "stt": 131, "taxId": "0313994173", "name": "trustedbilling.mobile-id.vn", "fullName": "Công ty CP Công nghệ và dịch vụ MOBILE-ID", "web": "https://trustedbilling.mobile-id.vn/", "lookupUrl": "https://trustedbilling.mobile-id.vn/invoice-inquiry/?language=vi" },
    { "stt": 132, "taxId": "0111488368", "name": "suninvoice.vn", "fullName": "Công ty Cổ phần Sun-Invoice Việt Nam", "web": "https://Suninvoice.vn", "lookupUrl": "https://tracuu.suninvoice.vn/" },
    { "stt": 133, "taxId": "0108933234", "name": "salework.net", "fullName": "Công ty Cổ phần ESBT", "web": "https://salework.net/", "lookupUrl": "https://salework.net/" },
    { "stt": 134, "taxId": "0307633556", "name": "winvoice.vn", "fullName": "Công ty TNHH Tư vấn – Thương mại Khánh Linh", "web": "https://winvoice.vn", "lookupUrl": "https://winvoice.vn/tra-cuu" },
    { "stt": 135, "taxId": "0111423385", "name": "limibiz.vn", "fullName": "Công ty TNHH LIMI Tech", "web": "https://limibiz.vn/", "lookupUrl": "https://limibiz.vn/" },
    { "stt": 136, "taxId": "0305795054", "name": "PVOIL", "fullName": "Tổng Công ty Dầu Việt Nam - CTCP (PVOIL)", "web": "https://hoadon.pvoil.vn/", "lookupUrl": "https://hoadon.pvoil.vn/", "captchaUrl": "https://hoadon.pvoil.vn/Captcha/Show" },

    { "stt": 137, "taxId": "0102331762", "name": "VNISC", "fullName": "Công ty cổ phần tích hợp công nghệ VNISC", "web": "https://invoice.abcsys.vn", "lookupUrl": "https://invoice.abcsys.vn/Invoice/Search", "verify": "Link điền sẵn mã tra cứu (?ID=<mã>); người dùng tự nhập mã xác nhận (captcha số) rồi bấm Tìm kiếm" },

    { "stt": 138, "taxId": "0315382923", "name": "SES", "fullName": "SES Group (sesgroup.vn) — tên pháp nhân cần xác nhận", "web": "https://sesgroup.vn", "lookupUrl": "https://hoadon78.sesgroup.vn/hddt/tracuuhd", "verify": "Trang tra cứu cần 3 ô: MST người mua + Số hoá đơn + Mã số bí mật (SecureKey trong XML)" },
];

export type LookupCtx = { company?: string; sellerTaxId?: string; buyerTaxId?: string; number?: string };

function sesLink(secureKey: string, ctx: LookupCtx): string {
    const q = new URLSearchParams({ masobimat: secureKey, ...(ctx.buyerTaxId ? { mstnguoimua: ctx.buyerTaxId } : {}), ...(ctx.number ? { sohoadon: String(Number(ctx.number)) } : {}) });
    return `https://hoadon78.sesgroup.vn/hddt/tracuuhd?${q.toString()}`;
}
/** Providers whose public lookup page accepts the code as a URL parameter → open the original directly. */
const DEEP_LINK: Record<string, (code: string, ctx: LookupCtx) => string> = {
    "0101243150": (code) => `https://www.meinvoice.vn/tra-cuu/?sc=${encodeURIComponent(code)}`, // MISA
    "0315382923": sesLink, // SES
};

/** Providers whose lookup form needs the code typed in → UI copies the code to the clipboard first. */
const LOOKUP_ASSIST = new Set<string>(PROVIDERS.filter((p) => !DEEP_LINK[p.taxId]).map((p) => p.taxId));
export function needsCopyAssist(providerKey: string | undefined): boolean {
    return !!providerKey && LOOKUP_ASSIST.has(providerKey);
}

export const WININVOICE_FORM_FIELDS = { code: "private_code", company: "cmpn_key" };

export function parseLookupInput(raw: string): string {
    const v = raw.trim();
    const m = v.match(/[?&](?:sc|mtc|matracuu|private_code|code|key)=([^&#\s]+)/i);
    return (m ? decodeURIComponent(m[1]) : v).trim();
}

export function lookupCodeFromFileName(name: string, symbol: string, number: string): string {
    const base = name.replace(/\.[^.]+$/, "");
    const skip = new Set([symbol.toUpperCase(), number, String(Number(number))]);
    const tokens = base.split(/[_\-\s.]+/).filter((t) => /^[A-Za-z0-9]{8,}$/.test(t) && /[A-Za-z]/.test(t) && /\d/.test(t) && !skip.has(t.toUpperCase()));
    return tokens.at(-1) ?? "";
}

const TONES: Record<string, [string, string, string]> = {
    "0101243150": ["#fff4e8", "#a94f00", "#f5c48f"], // MISA — orange
    "0101360697": ["#fdecec", "#c62828", "#f2a7a7"], // BKAV — red
    "0100684378": ["#e8f1fc", "#0060b9", "#a9c8ee"], // VNPT — blue
    "0100109106": ["#fdebf1", "#c2185b", "#f1a9c3"], // Viettel — pink
};
export function providerTone(taxId: string | undefined): { background: string; color: string; borderColor: string } {
    const t = (taxId && TONES[taxId]) || ["#e9f7ef", "#1e7b45", "#a8dcbd"];
    return { background: t[0], color: t[1], borderColor: t[2] };
}

export function supportsDeepLink(providerKey: string | undefined): boolean {
    return !!providerKey && !!DEEP_LINK[providerKey];
}

export const AUTO_PDF_PROVIDERS = new Set<string>();

export function canAutoFetch(providerKey: string | undefined, lookupCode: string | undefined): boolean {
    return !!providerKey && !!lookupCode && AUTO_PDF_PROVIDERS.has(providerKey);
}

export function originalInvoiceUrl(providerKey: string | undefined, lookupCode: string | undefined, ctx: LookupCtx = {}): { url: string; direct: boolean } | null {
    if (!providerKey || !lookupCode) return null;
    const link = DEEP_LINK[providerKey];
    return link ? { url: link(lookupCode, ctx), direct: true } : null;
}

const BY_TAX = new Map(PROVIDERS.map((p) => [p.taxId, p]));
const BY_NAME = new Map(PROVIDERS.map((p) => [p.name.toLowerCase(), p]));

export function findProvider(key: string | undefined | null): Provider | undefined {
    if (!key) return undefined;
    const k = key.trim();
    return BY_TAX.get(k) ?? BY_TAX.get(k.split("-")[0]) ?? BY_NAME.get(k.toLowerCase());
}
