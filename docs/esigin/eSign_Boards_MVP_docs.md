# e-Sign Boards MVP — Tài liệu sản phẩm
**Webcash Vietnam · module "Boards" (e-Sign)**

File nguồn: `eSign_Boards_MVP.html` — một file HTML/CSS/JS duy nhất, chạy hoàn toàn trên trình duyệt, không cần server hay cài đặt.

---

## 1. Giới thiệu

e-Sign Boards là module quản lý **luồng phê duyệt & ký số nội bộ** (approval workflow) cho các chứng từ kế toán/tài chính, tích hợp trong hệ thống Webcash (cạnh các module Sales, Expenses, Banking, Payroll, Reports).

Ý tưởng cốt lõi: mỗi loại chứng từ (thanh toán NCC, phiếu thu/chi, báo giá...) được gắn với một **Workflow Template** — định nghĩa sẵn form nhập liệu, số cấp duyệt, ai duyệt cấp nào, có cần ký số không, và các bước tự động (giao việc, gửi email) trước/sau khi duyệt. Người dùng chỉ cần chọn template, điền form, gửi đi; hệ thống tự đẩy chứng từ qua từng cấp duyệt cho tới khi hoàn tất, ghi lại toàn bộ lịch sử vào **Audit Log** không thể sửa/xoá.

**Đây là bản MVP demo**: toàn bộ dữ liệu (user, chứng từ, template, log...) được khởi tạo sẵn trong JavaScript và chỉ tồn tại trong phiên làm việc hiện tại của trình duyệt — tải lại trang hoặc bấm "Reset dữ liệu demo" sẽ đưa mọi thứ về trạng thái ban đầu. Xem mục 7 để biết rõ những gì là mô phỏng (chưa có backend thật).

---

## 2. Các khái niệm cốt lõi

| Khái niệm | Giải thích |
|---|---|
| **Nguồn (Lane)** | Chứng từ đến từ 1 trong 3 nguồn: **WeCMS**, **Misa AMIS**, **Others** (đặt tên "General" khi tạo yêu cầu). Mỗi nguồn có bộ template riêng. |
| **Workflow Template** | Bản thiết kế luồng cho 1 loại chứng từ: Form nhập liệu → 1 hoặc nhiều cấp Duyệt/Ký số → (tuỳ chọn) Task/Email tự động → Kết thúc. Trạng thái: **Draft** (đang soạn), **Active** (đang dùng để tạo chứng từ mới), **Inactive** (tạm ngưng). |
| **Request (Yêu cầu phê duyệt)** | Một chứng từ cụ thể được tạo ra từ 1 template. Trạng thái: **Draft** (chưa gửi) → **Approved/Signed** (đang chạy qua các cấp, hoặc đã xong hết) → có thể **Rejected** (bị từ chối ở bất kỳ cấp nào, hoặc bị Admin Thu hồi). |
| **Cấp duyệt (Step)** | Mỗi cấp có 1 hoặc nhiều người duyệt + 1 quy tắc hoàn tất nếu nhiều người: **Unanimous** (tất cả phải duyệt), **Any** (chỉ cần 1 người), **Majority** (quá bán). Phương thức là **Duyệt nội bộ** hoặc **Ký số** (USB Token/HSM — mô phỏng). |
| **Task / Email (tự động)** | Khối chạy tự động khi luồng đi tới, không cần ai thao tác (ví dụ: gửi mail thông báo kế toán sau khi duyệt xong). |
| **Ủy quyền (Delegation)** | 1 người có thể ủy quyền xử lý các phiếu đang chờ mình duyệt cho người khác trong 1 khoảng ngày (khi vắng mặt). Người nhận ủy quyền thấy các phiếu này ở mục "Nhận ủy quyền"; log ghi rõ "xử lý thay cho ai". |
| **Hoàn tác (Undo)** | Đưa 1 cấp duyệt/từ chối đã xử lý xong về lại trạng thái chờ duyệt. **Chỉ Admin** được quyền này. |
| **Thu hồi (Revoke)** | Huỷ hiệu lực 1 chứng từ **đã ký số xong** (chuyển thẳng sang Rejected). **Chỉ Admin**, và chỉ khi template cho phép. |
| **Audit Log** | Nhật ký append-only: mọi hành động tạo/gửi/duyệt/ký/từ chối/hoàn tác/thu hồi đều được ghi lại, không sửa hay xoá được. |
| **Entitlements (phân quyền)** | Ma trận quyền truy cập theo từng user cho từng mục menu (Boards, Banking, Payment, Add-on, Settings...), quản lý trong Settings > Users. Chỉ Admin được chỉnh. |

---

## 3. Bố cục tổng thể màn hình

- **Top bar**: logo, các tab module (Sales/Expenses/Banking/Payroll/Reports/**Boards** — đang active), nút đổi ngôn ngữ (VI/EN, icon địa cầu), Làm mới, Thông báo (chuông, có badge số lượng), Avatar (mở Cài đặt).
- **Sidebar trái**: 3 nhóm menu — **Approval Box** (My Request / To Approve / Done), **Workflow Template** (WeCMS / Other / MISA), **Audit Log**.
- **Khu vực chính**: tiêu đề trang + nút Add, bên dưới là nội dung theo màn hình đang chọn (thẻ KPI, bảng, bộ lọc, phân trang).
- Có 3 màn hình full-screen overlay riêng: **Chi tiết yêu cầu**, **Workflow Builder**, **Cài đặt (Settings)** — mở đè lên toàn bộ giao diện, đóng bằng nút X hoặc phím Esc (hiển thị gợi ý "Esc" ở góc phải).

---

## 4. Hướng dẫn từng màn hình

### 4.1 Approval Box (Hộp phê duyệt)

Sidebar có 2 mục chính, mỗi mục lại chia theo bộ lọc phụ:

- **My Request** (Yêu cầu của tôi): các chứng từ do chính mình tạo, đang còn xử lý (nháp hoặc chưa hoàn thành). Đã hoàn tất hoặc bị từ chối sẽ tự chuyển sang tab Done.
- **To Approve** (Chờ tôi xử lý): các chứng từ đang chờ mình duyệt/ký, chia 2 lớp lọc:
  - *Giao trực tiếp*: mình là người duyệt được chỉ định.
  - *Nhận ủy quyền*: mình đang duyệt thay cho người khác (do được ủy quyền).
- **Done** (Đã xử lý): lịch sử các chứng từ đã xong, chia 2 lớp lọc:
  - *Yêu cầu của tôi*: chứng từ mình tạo đã hoàn tất/bị từ chối.
  - *Tôi duyệt*: chứng từ mình từng xử lý (duyệt/ký/từ chối) ở bất kỳ cấp nào.

Phía trên bảng là các **thẻ KPI** (ALL, Nháp, Đã phê duyệt/Đã ký số, Bị từ chối...) — bấm vào để lọc nhanh theo trạng thái. Thanh công cụ có bộ lọc theo **Nguồn** và ô **tìm kiếm** (theo mã, tiêu đề, người tạo). Bảng hỗ trợ **sắp xếp** theo cột (bấm tiêu đề cột) và **phân trang** (10/25/50/100 dòng). Hover vào 1 dòng sẽ hiện icon "con mắt" nổi bên phải để mở nhanh **Chi tiết yêu cầu**.

### 4.2 Chi tiết yêu cầu (popup toàn màn hình)

Bố cục 2 cột:

- **Cột trái (chính)**: thông tin chung (workflow, loại chứng từ, số tiền, người tạo, ngày tạo, lưu trữ, số cấp duyệt, đang chờ ai duyệt), dữ liệu biểu mẫu đã nhập, thông tin chữ ký số (nếu đã ký — mô phỏng: người ký, thời điểm, provider VNPT-CA, serial, hash SHA-256, dấu thời gian TSA), và **luồng các cấp duyệt** dạng timeline (mỗi cấp hiện rõ ai duyệt, phương thức, trạng thái, thời điểm, ghi chú).
- **Cột phải**: feed **Comments** — gộp chung Audit Log liên quan đến chứng từ này và các bình luận tự do của người dùng, sắp xếp theo thời gian gần nhất, có ô nhập bình luận mới ở dưới.

Các nút hành động (hiện/ẩn tuỳ vai trò và trạng thái):

- **Phê duyệt / Ký số & Phê duyệt / Từ chối**: chỉ hiện nếu đang chờ chính mình (hoặc người mình đang duyệt thay) xử lý ở cấp hiện tại.
- **Gửi phê duyệt**: cho chứng từ đang Nháp, do chính người tạo.
- **✎ Chỉnh sửa**: cho chứng từ Nháp hoặc Bị từ chối, do chính người tạo — mở lại popup Tạo/Chỉnh sửa với dữ liệu cũ.
- **↩ Hoàn tác kết quả**: luôn hiển thị nếu có bước đã xử lý và template cho phép Undo, nhưng chỉ **Admin** bấm được — người khác thấy nút bị mờ (disabled) kèm tooltip giải thích.
- **⊘ Thu hồi (Revoke)**: chỉ hiện khi chứng từ đã **Ký số xong** và template cho phép Revoke; cũng chỉ **Admin** thao tác được, người khác thấy nút mờ.
- Nếu người tạo tự là người duyệt cấp hiện tại (vi phạm bất kiêm nhiệm), hệ thống cảnh báo và ẩn nút Phê duyệt/Ký số/Từ chối.

### 4.3 Tạo / Chỉnh sửa yêu cầu (popup)

Mở bằng nút **Add** ở góc phải trên cùng (khi đang ở Approval Box). Popup gần full-màn-hình, không đóng khi bấm ra ngoài (phải bấm nút Đóng hoặc Esc), gồm:

1. Chọn **Nguồn** (tab Others / Misa).
2. Chọn **Workflow Template** đang Active thuộc nguồn đó.
3. Nhập **Tiêu đề** + các **trường dữ liệu** do template định nghĩa (chữ, số tiền, ngày, danh sách chọn, đoạn văn, hoặc tệp đính kèm — nút "Chọn file" kiểu native, mô phỏng không upload thật).
4. Xem trước danh sách **Người phê duyệt** từng cấp (dạng chip tròn) — người duyệt đã được cố định sẵn từ lúc thiết kế template trong Workflow Builder, không chọn lại ở bước này.
5. **Lưu nháp** hoặc **Gửi phê duyệt** (validate các trường bắt buộc trước khi gửi).

### 4.4 Workflow Template (danh sách)

Bảng liệt kê tất cả template theo nguồn đang chọn ở sidebar (WeCMS/Other/MISA), có thẻ KPI theo trạng thái (Draft/Active/Inactive), tìm kiếm, sắp xếp cột.

- Cột cuối cùng **Active** (ghim phải khi cuộn ngang) là 1 công tắc bật/tắt nhanh giữa Active ⇄ Inactive (chỉ hiện với template không phải Draft).
- Chọn nhiều dòng (checkbox, cột đầu ghim trái) sẽ hiện **thanh hành động hàng loạt**, theo đúng quy tắc: chọn **toàn Nháp** → chỉ hiện nút **Xóa**; chọn **toàn Active/Inactive** → chỉ hiện **Kích hoạt/Ngưng sử dụng**; chọn **lẫn lộn** 2 nhóm → không hiện hành động nào, kèm dòng ghi chú giải thích cần bỏ chọn bớt.
- Nút **Add** ở góc trên mở popup đặt tên/nguồn/loại chứng từ, sau đó mở thẳng vào **Workflow Builder** để thiết kế luồng chi tiết.

### 4.5 Workflow Builder (thiết kế luồng — toàn màn hình)

Gồm 3 vùng:

- **Cột trái (palette)**: các khối có thể kéo-thả vào canvas — **Form** (khởi tạo, luôn có sẵn 1 khối duy nhất), **Approval** (duyệt nội bộ), **Sign** (ký số USB Token/HSM). Khối **Task** và **Email** không kéo thủ công mà tự có sẵn khi cấu hình (ghi chú "Tự động có sẵn trong luồng").
- **Canvas giữa**: kéo-thả khối, kéo dây nối từ chấm tròn cạnh khối, click nhãn dây để đổi Approve/Reject/Sign, kéo nhãn dây thả vào khối Duyệt/Ký để tạo **nhánh Undo/Revoke** riêng (nhãn này tự "nhấp nháy" 3 giây khi vừa thêm khối Duyệt/Ký mới để gợi ý người dùng). Có zoom, bám lưới (snap), Delete để xoá khối chọn.
- **Cột phải (cấu hình khối đang chọn)**:
  - Khối **Form**: bộ thiết kế trường dữ liệu (field designer) — mỗi trường chọn Loại trước (text/số tiền/ngày/danh sách chọn/đoạn văn/tệp), rồi Tên trường, rồi tick Bắt buộc; nút xoá trường là icon X tròn góc phải; nút "+ Thêm trường" full-width viền nét đứt.
  - Khối **Approval/Sign**: thanh trượt (slider) chọn **số cấp duyệt** 1–5 (chọn >1 sẽ tự tách thành nhiều cấp tuần tự), chọn **người duyệt** từng cấp, **quy tắc hoàn tất** khi 1 cấp có nhiều người, SLA (phút).

Thanh công cụ trên cùng: đếm tổng số cấp duyệt, **Hoàn tác** (undo thao tác thiết kế) → **Xem trước form** → **Lưu nháp** → **Submit** (lưu chính thức, chuyển Active).

Lưu ý: chỉ template đang **Active** mới bị khoá không cho sửa (chỉ xem); **Draft** và **Inactive** vẫn mở Builder chỉnh sửa được bình thường.

### 4.6 Audit Log

Bảng nhật ký append-only toàn hệ thống: thời gian, người thực hiện, hành động, đối tượng (mã chứng từ), chi tiết. Không có thao tác sửa/xoá trên màn hình này — đúng bản chất "chỉ ghi thêm".

### 4.7 Cài đặt (Settings — overlay toàn màn hình)

Mở bằng avatar góc phải top bar. Sidebar riêng có: Purpose, VAS Account, Contacts, Login Credentials, Bank Account, Preference (đều là placeholder mô phỏng), **Users**, **Ủy quyền**, Transaction History, Firm Banking... và nút **"Reset dữ liệu demo"** ở cuối.

- **Users (User Management)**: danh sách user bên trái (tìm kiếm theo tên/email), chọn 1 user để xem panel bên phải với 2 tab:
  - *Info*: họ tên, chức vụ, vai trò (User/Admin), nút **"Đăng nhập với người dùng này (demo)"** để đổi vai trò đang thao tác trong toàn app.
  - *Entitlements*: cây phân quyền chi tiết theo từng module (Boards, Banking, Payment, Add-on Service, Settings...) — chỉ **Admin** mới bật/tắt được, User khác sẽ thấy khoá kèm ghi chú.
- **Ủy quyền (Delegation)**: mỗi user tự thiết lập uỷ quyền phê duyệt của mình cho người khác trong 1 khoảng ngày (Từ ngày – Đến ngày), xem trạng thái Đang hiệu lực/Sắp tới/Hết hạn, có thể Thu hồi bất kỳ lúc nào.

### 4.8 Thông báo (Notification panel)

Mở bằng icon chuông ở top bar (có chấm đỏ báo số lượng chưa xem). Trượt ra từ bên phải, chia 2 nhóm: **Chờ bạn xử lý** (các phiếu đang chờ mình duyệt/ký) và **Cập nhật gần đây** (log liên quan tới các phiếu mình theo dõi). Bấm 1 dòng thông báo sẽ mở thẳng Chi tiết yêu cầu tương ứng.

---

## 5. Luồng nghiệp vụ chính (User Flow)

1. **Thiết kế luồng**: Admin/người quản trị vào Workflow Template → Add → đặt tên/nguồn/loại chứng từ → mở Workflow Builder → kéo-thả các khối Approval/Sign, cấu hình số cấp + người duyệt + quy tắc, thiết kế Form (các trường nhập liệu) → Lưu nháp hoặc Submit (Active).
2. **Tạo chứng từ**: User vào Approval Box → Add → chọn nguồn + template đang Active → điền form → Lưu nháp (chưa vào luồng) hoặc Gửi phê duyệt (bắt đầu chạy qua các cấp).
3. **Tự động hoá đầu/cuối luồng**: nếu template có khối Task/Email ở đầu hoặc cuối, hệ thống tự chạy ngay khi luồng đi tới (không cần người thao tác), rồi mới dừng lại chờ người duyệt ở cấp Approval/Sign gần nhất.
4. **Phê duyệt từng cấp**: người duyệt được chỉ định thấy chứng từ ở "To Approve" → mở Chi tiết → Phê duyệt/Ký số/Từ chối. Nếu 1 cấp có nhiều người duyệt, hệ thống tự tính đủ điều kiện qua cấp theo quy tắc (Unanimous/Any/Majority); nếu chưa đủ, phiếu vẫn ở lại chờ những người còn lại.
5. **Ủy quyền khi vắng mặt**: nếu người duyệt cấu hình Ủy quyền cho người khác (Settings > Ủy quyền), người được ủy quyền sẽ thấy phiếu ở "Nhận ủy quyền" và xử lý thay; Audit Log ghi rõ "(xử lý thay cho <tên>)".
6. **Hoàn tất**: khi cấp cuối cùng được duyệt/ký xong, chứng từ chuyển hẳn sang Done với trạng thái Approved/Signed.
7. **Sửa sai (Admin)**: nếu cần đưa 1 bước đã duyệt/từ chối quay lại chờ xử lý, Admin bấm **Hoàn tác**; nếu cần huỷ hẳn hiệu lực 1 chứng từ đã ký số, Admin bấm **Thu hồi** (chuyển Rejected).
8. **Theo dõi & trao đổi**: mọi hành động được ghi vào Audit Log; người liên quan có thể trao đổi qua **Comments** ngay trong màn hình Chi tiết yêu cầu — cả hai hiển thị chung 1 dòng thời gian.

---

## 6. Tài khoản demo có sẵn

| ID | Tên | Chức vụ | Vai trò | Rank |
|---|---|---|---|---|
| u1 | An Nguyễn | Nhân viên kế toán | User | 1 |
| u2 | Bình Trần | Trưởng bộ phận | User | 2 *(đăng nhập mặc định khi mở app)* |
| u3 | Chi Lê | Kế toán trưởng | **Admin** | 3 |
| u4 | Dũng Phạm | Giám đốc / ĐDPL | User | 4 |

Đổi vai trò để test các quyền khác nhau (đặc biệt là Undo/Revoke/Entitlements — chỉ Admin thao tác được): Settings (avatar góc phải) → Users → chọn user → "Đăng nhập với người dùng này (demo)".

---

## 7. Lưu ý quan trọng trước khi dùng / demo (giới hạn của bản MVP)

- Đây là **prototype chạy hoàn toàn phía client**, không có server/database thật — mọi dữ liệu (chứng từ, template, log, ủy quyền...) chỉ nằm trong bộ nhớ trình duyệt của phiên hiện tại. Tải lại trang hoặc bấm "Reset dữ liệu demo" sẽ nạp lại đúng bộ dữ liệu mẫu ban đầu, mọi chỉnh sửa trong phiên trước sẽ mất.
- Các thao tác sau chỉ **mô phỏng** (hiện thông báo toast, không có hiệu lực thật): tải file đính kèm lên server, ký số qua USB Token/HSM, gửi email thật, xuất Excel, in ấn, các mục "Purpose/VAS Account/Contacts/Login Credentials/Bank Account/Preference/ERP/Firm Banking" trong Settings.
- "Đăng nhập" chỉ là chuyển đổi vai trò giả lập trong demo, không có cơ chế xác thực (authentication) thật.
- Gói dùng thử giới hạn tối đa 5 người dùng — nút "Thêm người dùng" chỉ hiện thông báo mô phỏng, chưa tạo được user mới thật.
- **Vấn đề logic đã biết, chưa xử lý**: khi 1 cấp duyệt có nhiều người và Admin bấm **Hoàn tác (Undo)**, toàn bộ phiếu đã duyệt của **tất cả** người trong cấp đó bị xoá về "chưa duyệt" cùng lúc, thay vì chỉ xoá phiếu của người xử lý gần nhất. Cần lưu ý khi demo các luồng có cấp duyệt nhiều người.

---

## 8. Gợi ý kịch bản demo nhanh (5 phút)

1. Mở app (mặc định đăng nhập **Bình Trần** — User). Vào **Workflow Template > WeCMS**, xem danh sách template có sẵn (t1, t6, t9...).
2. Vào **Approval Box > My Request**, bấm **Add**, chọn nguồn **Misa**, chọn 1 template Active, điền form mẫu, bấm **Gửi phê duyệt** — quan sát toast báo mã chứng từ mới.
3. Chuyển sang tab **To Approve**, mở chi tiết chứng từ vừa tạo (nếu người duyệt cấp 1 trùng với user đang đăng nhập ở template demo) → bấm **Phê duyệt** → xem luồng tự chuyển cấp, feed Comments cập nhật.
4. Vào **Settings > Users**, chuyển sang **Chi Lê (Admin)** để thấy khác biệt: nút Hoàn tác/Thu hồi trong Chi tiết yêu cầu chuyển từ mờ sang bấm được; vào tab Entitlements để xem/chỉnh phân quyền.
5. Quay lại **Workflow Template**, thử tick chọn 1 dòng Draft và 1 dòng Active cùng lúc — quan sát thanh hành động hàng loạt báo "chọn lẫn" và ẩn hết nút, minh hoạ đúng quy tắc nghiệp vụ.
6. Mở **Workflow Builder** của 1 template Draft/Inactive để xem cách kéo-thả khối, cấu hình slider số cấp duyệt, thiết kế field cho Form.
