const API = "http://localhost:3000/api";

const params = new URLSearchParams(window.location.search);

const maSuatChieu = params.get("MaSuatChieu");

const thongTinSuatChieu = document.getElementById("thongTinSuatChieu");

const danhSachKhachHang = document.getElementById("danhSachKhachHang");

async function loadChiTietKhachHang() {
  try {
    if (!maSuatChieu) {
      danhSachKhachHang.innerHTML = `
                <div class="alert alert-danger">
                    Không xác định được suất chiếu!
                </div>
            `;

      return;
    }

    const response = await fetch(
      `${API}/admin/chitietkhachhang/${maSuatChieu}`,
    );

    if (!response.ok) {
      const data = await response.json();

      throw new Error(data.message || "Không thể lấy thông tin khách hàng");
    }

    const data = await response.json();

    console.log("Chi tiết khách hàng:", data);

    hienThiThongTinSuatChieu(data);

    hienThiKhachHang(data);
  } catch (error) {
    console.error(error);

    danhSachKhachHang.innerHTML = `
            <div class="alert alert-danger">
                ${error.message}
            </div>
        `;
  }
}

/* ===============================
   HIỂN THỊ THÔNG TIN SUẤT CHIẾU
================================ */

function hienThiThongTinSuatChieu(data) {
  if (!data || data.length === 0) {
    thongTinSuatChieu.innerHTML = "";

    return;
  }

  const suat = data[0];

  thongTinSuatChieu.innerHTML = `

        <div class="thong-tin-phim">

            <div class="ten-phim">
                ${suat.TenPhim}
            </div>

            <p>
                <b>Ngày chiếu:</b>
                ${formatNgay(suat.NgayChieu)}
            </p>

            <p>
    <b>Giờ chiếu:</b>
    ${formatGio(suat.GioChieu)}
</p>

            <p>
                <b>Phòng:</b>
                ${suat.TenPhong}
            </p>

        </div>

    `;
}

/* ===============================
   HIỂN THỊ KHÁCH HÀNG
================================ */

function hienThiKhachHang(data) {
  if (!data || data.length === 0) {
    danhSachKhachHang.innerHTML = `

            <div class="empty">

                <h4>
                    Chưa có khách hàng đặt vé
                </h4>

                <p>
                    Suất chiếu này hiện chưa có người đặt vé.
                </p>

            </div>

        `;

    return;
  }

  danhSachKhachHang.innerHTML = "";

  data.forEach(function (khach, index) {
    const div = document.createElement("div");

    div.className = "khach-hang";

    let dichVuHTML = "";

    if (khach.DichVu) {
      dichVuHTML = `

                <div class="dich-vu">

                    <p>
                        <b>Dịch vụ:</b>
                    </p>

                    <p>
                        ${khach.DichVu}
                    </p>

                </div>

            `;
    } else {
      dichVuHTML = `

                <div class="dich-vu">

                    <p>
                        <b>Dịch vụ:</b>
                        Không sử dụng dịch vụ
                    </p>

                </div>

            `;
    }

    div.innerHTML = `

    <h4>
        Khách hàng ${index + 1}
    </h4>

    <div class="thong-tin">

        <p>
            <b>Họ tên:</b>
            ${khach.HoTen}
        </p>

        <p>
            <b>Số điện thoại:</b>
            ${khach.SoDienThoai}
        </p>

        <p>
            <b>Số ghế:</b>
            ${khach.Ghe || "Không có"}
        </p>

        <p>
            <b>Tổng tiền:</b>
            ${formatTien(khach.TongTien)}
        </p>

    </div>

    ${dichVuHTML}

    <div style="margin-top: 20px;">

        <button
            class="nut"
            onclick="xoaVe(${khach.MaDatVe})"
        >
            Xóa vé
        </button>

    </div>

`;

    danhSachKhachHang.appendChild(div);
  });
}

/* ===============================
   FORMAT NGÀY
================================ */

function formatNgay(ngay) {
  if (!ngay) {
    return "Chưa cập nhật";
  }

  const date = new Date(ngay);

  const day = String(date.getDate()).padStart(2, "0");

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

function formatGio(gio) {
  if (!gio) {
    return "Chưa cập nhật";
  }

  if (typeof gio === "string" && gio.includes(":")) {
    if (gio.includes("T")) {
      const date = new Date(gio);

      if (!isNaN(date.getTime())) {
        return (
          String(date.getUTCHours()).padStart(2, "0") +
          ":" +
          String(date.getUTCMinutes()).padStart(2, "0")
        );
      }
    }

    return gio.substring(0, 5);
  }

  return gio;
}

function formatTien(tien) {
  if (tien == null) {
    return "0 VNĐ";
  }

  return Number(tien).toLocaleString("vi-VN") + " VNĐ";
}
async function xoaVe(maDatVe) {
  const xacNhan = confirm(
    "Bạn có chắc chắn muốn xóa vé này không?\n\n" +
      "Sau khi xóa, ghế của khách sẽ được trả lại để người khác có thể đặt.",
  );

  if (!xacNhan) {
    return;
  }

  try {
    const response = await fetch(`${API}/admin/xoave/${maDatVe}`, {
      method: "DELETE",
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message || "Không thể xóa vé!");

      return;
    }

    alert("Xóa vé thành công!");

    loadChiTietKhachHang();
  } catch (error) {
    console.error("LỖI XÓA VÉ:", error);

    alert("Không thể kết nối Backend!");
  }
}
loadChiTietKhachHang();
