const API = "http://localhost:3000/api";

let maPhongDangSua = null;
let danhSachPhong = [];

async function loadPhong() {
  try {
    const response = await fetch(`${API}/phongchieu`);

    if (!response.ok) throw new Error("Lỗi tải phòng");

    danhSachPhong = await response.json();

    const container = document.getElementById("roomList");
    container.innerHTML = "";

    if (danhSachPhong.length === 0) {
      container.innerHTML = '<div class="empty">Chưa có phòng chiếu</div>';
      return;
    }

    danhSachPhong.forEach((phong) => {
      const div = document.createElement("div");

      div.className = "room";

      if (Number(phong.MaPhong) === maPhongDangSua) {
        div.classList.add("active");
      }

      const info = document.createElement("div");
      info.className = "room-info";

      const name = document.createElement("strong");
      name.textContent = phong.TenPhong;

      const detail = document.createElement("span");
      detail.textContent = `${phong.SoLuongGhe} ghế`;

      info.append(name, detail);

      const button = document.createElement("button");
      button.className = "secondary";
      button.textContent = "Chi tiết";

      button.addEventListener("click", () => {
        loadChiTiet(phong.MaPhong);
      });

      div.append(info, button);
      container.appendChild(div);
    });
  } catch (error) {
    console.error(error);
    alert("Không thể tải danh sách phòng!");
  }
}

function taoDongHang(tenHang = "", loaiGhe = "Thường", soLuong = 11) {
  const container = document.getElementById("hangGheContainer");

  const div = document.createElement("div");
  div.className = "row-item";

  div.innerHTML = `
    <div class="form-group">
      <label>Tên hàng</label>
      <input class="ten-hang" maxlength="2"
        value="${tenHang}" placeholder="A">
    </div>

    <div class="form-group">
      <label>Loại ghế</label>
      <select class="loai-ghe">
        <option value="Thường">Thường</option>
        <option value="VIP">VIP</option>
        <option value="Đôi">Đôi</option>
      </select>
    </div>

    <div class="form-group">
      <label>Số lượng ghế</label>
      <input class="so-luong" type="number" min="1"
        value="${soLuong}">
    </div>

    <button type="button" onclick="xoaHang(this)">
      Xóa
    </button>
  `;

  div.querySelector(".loai-ghe").value = loaiGhe;

  div.querySelectorAll("input, select").forEach((input) => {
    input.addEventListener("input", capNhatTongGhe);
    input.addEventListener("change", capNhatTongGhe);
  });

  container.appendChild(div);
  capNhatTongGhe();
}

function themHang() {
  const soHang = document.querySelectorAll(".row-item").length;

  const tenHang = String.fromCharCode(65 + soHang);

  taoDongHang(tenHang, "Thường", 11);
}

function xoaHang(button) {
  button.closest(".row-item").remove();
  capNhatTongGhe();
}

function capNhatTongGhe() {
  let tong = 0;

  document.querySelectorAll(".row-item").forEach((row) => {
    tong += Number(row.querySelector(".so-luong").value) || 0;
  });

  document.getElementById("tongGhe").textContent = tong;
}

function themMoi() {
  maPhongDangSua = null;

  document.getElementById("formTitle").textContent = "Thêm phòng mới";

  document.getElementById("tenPhong").value = "";

  document.getElementById("hangGheContainer").innerHTML = "";

  taoDongHang("A", "Thường", 11);
  taoDongHang("B", "Thường", 11);
  taoDongHang("C", "Thường", 11);
  taoDongHang("D", "Thường", 11);
  taoDongHang("E", "VIP", 11);
  taoDongHang("F", "VIP", 11);
  taoDongHang("G", "VIP", 11);
  taoDongHang("H", "Đôi", 6);

  document.querySelectorAll(".room").forEach((x) => {
    x.classList.remove("active");
  });
}

async function loadChiTiet(maPhong) {
  try {
    const response = await fetch(`${API}/phongchieu/${maPhong}`);
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Không thể lấy phòng");
    }

    maPhongDangSua = Number(maPhong);

    document.getElementById("formTitle").textContent = "Chỉnh sửa phòng";

    document.getElementById("tenPhong").value = data.phong.TenPhong;

    const container = document.getElementById("hangGheContainer");
    container.innerHTML = "";

    data.hangGhe.forEach((hang) => {
      taoDongHang(hang.TenHang, hang.LoaiGhe, hang.SoLuongGhe);
    });

    loadPhong();
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
}

function layDuLieuForm() {
  const tenPhong = document.getElementById("tenPhong").value.trim();

  const hangGhe = [];

  document.querySelectorAll(".row-item").forEach((row) => {
    hangGhe.push({
      tenHang: row.querySelector(".ten-hang").value.trim(),
      loaiGhe: row.querySelector(".loai-ghe").value,
      soLuongGhe: Number(row.querySelector(".so-luong").value),
    });
  });

  return { tenPhong, hangGhe };
}

async function luuPhong() {
  const duLieu = layDuLieuForm();

  if (!duLieu.tenPhong) {
    alert("Vui lòng nhập tên phòng!");
    return;
  }

  if (duLieu.hangGhe.length === 0) {
    alert("Vui lòng tạo ít nhất một hàng ghế!");
    return;
  }

  const url = maPhongDangSua
    ? `${API}/phongchieu/${maPhongDangSua}`
    : `${API}/phongchieu`;

  const method = maPhongDangSua ? "PUT" : "POST";

  try {
    const response = await fetch(url, {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(duLieu),
    });
    const data = await response.json();

    console.log("Dữ liệu gửi:", duLieu);
    console.log("HTTP Status:", response.status);
    console.log("Backend trả về:", data);

    if (!response.ok || !data.success) {
      throw new Error(data.error || data.message || "Lưu phòng thất bại!");
    }

    alert(data.message);

    await loadPhong();

    if (data.maPhong) {
      await loadChiTiet(data.maPhong);
    } else {
      themMoi();
    }
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
}

async function xoaPhong() {
  if (!maPhongDangSua) {
    alert("Vui lòng chọn phòng cần xóa!");
    return;
  }

  if (!confirm("Bạn có chắc chắn muốn xóa phòng này?")) {
    return;
  }

  try {
    const response = await fetch(`${API}/phongchieu/${maPhongDangSua}`, {
      method: "DELETE",
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Xóa phòng thất bại!");
    }

    alert(data.message);

    themMoi();
    await loadPhong();
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
}

async function loadGia() {
  try {
    const response = await fetch(`${API}/giaghe`);
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message);
    }

    data.data.forEach((item) => {
      if (item.LoaiGhe === "Thường") {
        document.getElementById("giaThuong").value = item.Gia;
      }

      if (item.LoaiGhe === "VIP") {
        document.getElementById("giaVIP").value = item.Gia;
      }

      if (item.LoaiGhe === "Đôi") {
        document.getElementById("giaDoi").value = item.Gia;
      }
    });
  } catch (error) {
    console.error(error);
    alert("Không thể tải giá ghế!");
  }
}

async function luuGia() {
  const giaGhe = {
    Thường: Number(document.getElementById("giaThuong").value),
    VIP: Number(document.getElementById("giaVIP").value),
    Đôi: Number(document.getElementById("giaDoi").value),
  };

  if (Object.values(giaGhe).some((gia) => !Number.isFinite(gia) || gia <= 0)) {
    alert("Vui lòng nhập giá hợp lệ!");
    return;
  }

  try {
    const response = await fetch(`${API}/giaghe`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ giaGhe }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Cập nhật giá thất bại!");
    }

    alert(data.message);
  } catch (error) {
    console.error(error);
    alert(error.message);
  }
}

themMoi();
loadPhong();
loadGia();
