const API = "http://localhost:3000/api";

const params = new URLSearchParams(window.location.search);

const tenPhim = params.get("TenPhim");

const tenPhimElement = document.getElementById("tenPhim");

if (!tenPhim) {
  tenPhimElement.textContent = "Không xác định được phim";
} else {
  tenPhimElement.textContent = tenPhim;
}

function formatNgay(ngay) {
  if (!ngay) {
    return "";
  }

  const date = new Date(ngay);

  const day = String(date.getDate()).padStart(2, "0");

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

async function loadPhong() {
  try {
    const response = await fetch(`${API}/phongchieu`);

    if (!response.ok) {
      throw new Error("Không thể lấy danh sách phòng");
    }

    const danhSachPhong = await response.json();

    const select = document.getElementById("maPhong");

    select.innerHTML = `
            <option value="">
                -- Chọn phòng --
            </option>
        `;

    danhSachPhong.forEach(function (phong) {
      const option = document.createElement("option");

      option.value = phong.MaPhong;

      option.textContent = `${phong.TenPhong} (${phong.SoLuongGhe} ghế)`;

      select.appendChild(option);
    });
  } catch (error) {
    console.error(error);

    alert("Không thể tải danh sách phòng chiếu");
  }
}

async function loadSuatChieu() {
  try {
    if (!tenPhim) {
      return;
    }

    const response = await fetch(
      `${API}/suatchieu/${encodeURIComponent(tenPhim)}`,
    );

    if (!response.ok) {
      throw new Error("Không thể lấy suất chiếu");
    }

    const danhSachSuat = await response.json();

    hienThiSuat(danhSachSuat);
  } catch (error) {
    console.error(error);

    document.getElementById("danhSachSuat").innerHTML = `
            <p class="text-danger">
                Không thể tải danh sách suất chiếu.
            </p>
        `;
  }
}

function hienThiSuat(danhSachSuat) {
  const container = document.getElementById("danhSachSuat");

  container.innerHTML = "";

  if (!danhSachSuat || danhSachSuat.length === 0) {
    container.innerHTML = `
            <div class="empty">
                <p>
                    Chưa có thông tin suất chiếu.
                </p>

                <p>
                    Hãy thêm suất chiếu cho phim này.
                </p>
            </div>
        `;

    return;
  }

  danhSachSuat.forEach(function (suat) {
    const div = document.createElement("div");

    div.className = "suat-item";

    div.innerHTML = `

            <div class="suat-info">

                <span>
                    📅
                    <strong>
                        ${formatNgay(suat.NgayChieu)}
                    </strong>
                </span>

                <span>
                    🕐
                    <strong>
                        ${suat.GioChieu || ""}
                    </strong>
                </span>

                <span>
                    🎬
                    <strong>
                        ${suat.TenPhong || ""}
                    </strong>
                </span>

            </div>


            <div>
    <button 
        class="nut"
        onclick="xemChiTietKhachHang(${suat.MaSuatChieu})"
    >
        Chi tiết
    </button>

    <button 
        class="nut"
        onclick="xoaSuat(${suat.MaSuatChieu})"
    >
        Xóa
    </button>
</div>

        `;

    container.appendChild(div);
  });
}

document.getElementById("btnThem").addEventListener("click", async function () {
  const ngayChieu = document.getElementById("ngayChieu").value;

  const gioChieu = document.getElementById("gioChieu").value;

  const maPhong = document.getElementById("maPhong").value;

  if (!tenPhim) {
    alert("Không xác định được tên phim!");

    return;
  }

  if (!ngayChieu) {
    alert("Vui lòng chọn ngày chiếu!");

    return;
  }

  if (!gioChieu) {
    alert("Vui lòng chọn giờ chiếu!");

    return;
  }

  if (!maPhong) {
    alert("Vui lòng chọn phòng chiếu!");

    return;
  }

  try {
    const response = await fetch(`${API}/suatchieu`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        tenPhim: tenPhim,

        maPhong: Number(maPhong),

        ngayChieu: ngayChieu,

        gioChieu: gioChieu,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message || "Không thể thêm suất chiếu!");

      return;
    }

    alert("Thêm suất chiếu thành công!");

    // XÓA FORM

    document.getElementById("ngayChieu").value = "";

    document.getElementById("gioChieu").value = "";

    document.getElementById("maPhong").value = "";

    // LOAD LẠI DANH SÁCH

    loadSuatChieu();
  } catch (error) {
    console.error(error);

    alert("Không thể kết nối Backend!");
  }
});

// XÓA SUẤT CHIẾU

async function xoaSuat(maSuatChieu) {
  const xacNhan = confirm("Bạn có chắc chắn muốn xóa suất chiếu này không?");

  if (!xacNhan) {
    return;
  }

  try {
    const response = await fetch(`${API}/suatchieu/${maSuatChieu}`, {
      method: "DELETE",
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message || "Không thể xóa suất chiếu!");

      return;
    }

    alert("Xóa suất chiếu thành công!");

    loadSuatChieu();
  } catch (error) {
    console.error(error);

    alert("Không thể kết nối Backend!");
  }
}

loadPhong();

loadSuatChieu();

function xemChiTietKhachHang(maSuatChieu) {
  window.location.href =
    "./adminchitietkhachhang.html?MaSuatChieu=" + maSuatChieu;
}
