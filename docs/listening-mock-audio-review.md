# Listening Mock: kiểm tra vòng đời audio

Ngày đối chiếu: 31/10/2026. Nhánh: `feat/fe-student-flow`.

**Trạng thái: chưa hoàn thành yêu cầu bảo đảm chỉ nghe một lượt.** Phần này
giữ cơ chế localStorage hiện tại, sửa lỗi đồng bộ sự kiện trong
`listening-player.tsx`, bổ sung kiểm tra và ghi nhận nội dung cần thống nhất
với BE. Không sửa API, database hoặc Admin.

## Căn cứ nghiệp vụ

Nguồn: `MÔ TẢ NGHIỆP VỤ HỆ THỐNG IELTS READING & LISTENING (2).pdf`:

- Mục 10, trang 13–14: audio policy phải quy định pause, replay, seek, số lượt,
  reload và mất kết nối; ví dụ Mock có `pause = false`, `seek = false`,
  `replay = false`.
- Mục 13, trang 16: tiếp tục attempt phải khôi phục trạng thái và timer dựa
  trên server, không reset timer khi refresh.
- Hợp đồng Attempt, trang 68: API trả attempt/content/answers/flags/preload;
  chưa mô tả trạng thái hoặc endpoint quản lý lượt nghe.

PDF chưa chốt reload audio phải tiếp tục từ checkpoint hay từ vị trí tính
theo thời gian server. Không coi hành vi FE hiện tại là quyết định nghiệp vụ
đã được thống nhất.

## Ba tình huống cần xác nhận

Các kết quả dưới đây dùng settings Mock hiện có:
`allow_pause = false`, `allow_seek = false`, `allow_replay = false`,
`max_plays = 1`.

| Tình huống | Hành vi hiện tại được kiểm tra ở mức component |
| --- | --- |
| Reload giữa bài có phát lại từ đầu không? | Khi cache còn hợp lệ, player khôi phục `time` đã lưu sau `loadedmetadata`; tiếp tục nghe không tăng lượt từ 1 lên 2. `?start=1` yêu cầu tự tiếp tục sau `canplay`; nếu browser chặn autoplay thì cần bấm Phát. |
| Chuyển section rồi quay lại có nghe lại được không? | Không qua điều hướng câu hỏi: khi `allow_seek = false`, audio chạy độc lập với section đang xem. Quay về tab section cũ không đổi nguồn audio hoặc reset vị trí. Audio đã hết được đánh dấu rồi chuyển sang section tiếp theo. |
| Audio kết thúc có bị khóa đúng không? | `onEnded` lưu `ended = true`. Section trung gian chuyển sang audio tiếp theo; section cuối khóa nút phát lại, kể cả sau remount nếu cache còn nguyên. |

Checkpoint được ghi trong `timeupdate`, không phải đồng hồ server. Khoảng
thời gian đóng tab hoặc chờ autoplay không được cộng vào vị trí audio.
Reload còn phụ thuộc metadata, seek, buffer và autoplay của browser thật.

## Test được bổ sung

File: `src/features/student/listening-player.test.ts`.

- Sự kiện reset về 0 trước metadata không được ghi đè checkpoint resume.
- Sự kiện khi đổi nguồn không được sao chép trạng thái đã kết thúc sang
  section mới.
- Reload/remount giữa bài giữ vị trí và giữ một lượt nghe.
- Resume với `?start=1` tiếp tục tại checkpoint.
- Chuyển tab câu hỏi rồi quay lại không tải hoặc phát lại audio.
- Kết thúc section tự sang audio tiếp theo; về câu hỏi cũ không mở lại audio.
- Reload khôi phục con trỏ audio độc lập với tab câu hỏi đang xem.
- Mất con trỏ section vẫn bỏ qua audio có cache `ended = true`.
- Audio cuối khóa phát lại trước và sau remount.
- Bỏ qua sự kiện `ended` cũ nếu audio hiện tại chưa thực sự kết thúc.
- Xóa localStorage rồi remount mở lại được audio: **xác nhận lỗ hổng hiện tại**.
- Sửa cache về `time = 0`, `plays = 0`, `ended = false` rồi remount cũng mở
  lại được audio: **xác nhận lỗ hổng hiện tại**.

Hai test regression đầu đã thất bại trên code cũ: checkpoint 38 giây bị
ghi thành 0; section mới nhận nhầm `ended = true`. Sau khi sửa, chúng pass.
Hai test về localStorage tái hiện bypass, không phải bằng chứng yêu cầu
chống bypass đã đạt.

Kết quả sau sửa: **12/12 test component pass**.

## Lỗi đồng bộ đã sửa

Chrome với audio WAV thật đã tái hiện: sau khi Section 1 kết thúc, Section 2
có thể bị lưu thành `{ time: 0, plays: 1, ended: true }`, không phát và bị
khóa ngay. Sự kiện `timeupdate` khi reset nguồn đến trước effect khôi phục,
làm trạng thái section trước bị ghi vào key section mới. Cùng loại sự kiện
cũng có thể xóa checkpoint khi tải lại audio.

Player hiện kiểm tra key cache đang hoạt động và chờ metadata được khôi
phục trước khi xử lý playback/progress. Sự kiện `ended` chỉ được chấp nhận
khi media hiện tại thực sự kết thúc; lỗi `play()` của nguồn cũ không cập
nhật thông báo nguồn mới. Cơ chế lưu cục bộ và rule pause/seek/replay vẫn
giữ nguyên.

Chạy riêng phần này:

```powershell
node node_modules/vitest/vitest.mjs run src/features/student/listening-player.test.ts
```

## Phạm vi kiểm chứng

Test mount component React trong JSDOM và mô phỏng API/sự kiện media.
Remount giữ storage đại diện cho vòng đời component khi reload; không thay
thế reload cả trang trên browser thật.

Đã kiểm tra thêm component thật trên Chrome headless với hai WAV fixture
9 giây và 4 giây, context học viên giả lập, không kết nối API/BE:

- Reload cả trang: vị trí trước reload khoảng 2,099 giây, sau resume khoảng
  2,120 giây, checkpoint lưu 1,993 giây; vẫn một lượt.
- Chuyển tab câu hỏi rồi quay lại: nguồn audio và lượt nghe giữ nguyên.
- Native `ended`: Section 1 sang Section 2 và audio Section 2 phát được;
  quay về câu hỏi Section 1 không mở lại audio cũ.
- Audio cuối khóa phát lại trước và sau reload.
- Xóa localStorage rồi reload: phát lại Section 1 từ đầu được. **Bypass đã
  được xác nhận trên browser thật.**

Đã xem ảnh player độc lập ở 1280×800 và 390×844; viewport 390 px không có
tràn ngang. Đây là kiểm tra player, chưa phải kiểm thử toàn bộ giao diện
Student/Admin.

Chưa kiểm tra với dữ liệu/auth/API/BE thật, media R2 thật, mạng đứt/kết nối
lại, timer hết giờ hoặc nhiều tab/thiết bị trong phần này.

## Nội dung cần thống nhất với BE

Đây là đề xuất để thống nhất, chưa phải API hoặc schema đã triển khai.

1. Chọn rule reload/mất mạng: tiếp tục từ checkpoint hay theo timeline server;
   quy định trường hợp autoplay bị chặn và thời gian người dùng rời trang.
2. Nếu cần chống reset localStorage, BE phải là nguồn trạng thái theo
   `attempt_id` và `section_id`: lượt đã dùng, trạng thái đã bắt đầu/đã kết
   thúc và dữ liệu phục hồi. FE tải lại trạng thái từ BE khi mở attempt.
3. BE kiểm tra chủ attempt, thời hạn và thứ tự section; cập nhật lượt bắt đầu
   một cách nguyên tử, có idempotency để retry không trừ thêm lượt. Chốt rule
   nhiều tab/thiết bị và không tin riêng `plays`/`ended` do client gửi lên.
4. Chốt cơ chế cấp và kiểm soát truy cập media cùng mức chống bypass mong
   muốn. Hiện `src/server/media/urls.ts` tạo URL public, `expires_at = null`;
   lưu lượt ở DB hoặc dùng signed URL đơn thuần chưa ngăn phát lại file đã tải.
5. Sau khi có contract, bổ sung integration/E2E cho reload, clear/tamper
   storage, reconnect, hết giờ, retry, section cũ và nhiều phiên đồng thời.

Không đánh dấu audio Mock hoàn thành hoặc dùng kết quả test component để
kết luận đã có kiểm soát lượt nghe phía server.
