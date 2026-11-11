const API = "http://localhost:3000/api";

const params = new URLSearchParams(window.location.search);
const tenPhim = params.get("phim");

document.getElementById("tenPhim").textContent = tenPhim || "Không xác định";

let danhSachSuat = [];
let suatDangChon = null;

let gheDangChon = [];

let danhSachDichVuDangChon = new Map();

let dichVuDangSua = null;

const giaCombo = 30000;

let giaGheTheoMa = new Map();

async function loadSuatChieu() {
  try {
    const response = await fetch(
      `${API}/suatchieu/${encodeURIComponent(tenPhim)}`,
    );

    if (!response.ok) {
      throw new Error("Không thể lấy suất chiếu");
    }

    danhSachSuat = await response.json();

    hienThiNgay();
  } catch (error) {
    console.error(error);
    alert("Không thể tải suất chiếu");
  }
}

function hienThiNgay() {
  const container = document.getElementById("ngayContainer");

  container.innerHTML = "";

  const ngayDaCo = [];

  danhSachSuat.forEach((suat) => {
    const ngay = suat.NgayChieu.substring(0, 10);

    if (!ngayDaCo.includes(ngay)) {
      ngayDaCo.push(ngay);

      const button = document.createElement("button");

      button.className = "option";
      button.textContent = formatNgay(ngay);
      button.dataset.ngay = ngay;

      button.addEventListener("click", function () {
        document
          .querySelectorAll("#ngayContainer .option")
          .forEach((x) => x.classList.remove("selected"));

        this.classList.add("selected");

        hienThiPhong(ngay);
      });

      container.appendChild(button);
    }
  });
}

function hienThiPhong(ngay) {
  const container = document.getElementById("phongContainer");

  container.innerHTML = "";

  document.getElementById("gioContainer").innerHTML = "";
  document.getElementById("gheContainer").innerHTML = "";

  const phongDaCo = [];

  danhSachSuat
    .filter((suat) => suat.NgayChieu.substring(0, 10) === ngay)
    .forEach((suat) => {
      if (!phongDaCo.includes(suat.MaPhong)) {
        phongDaCo.push(suat.MaPhong);

        const button = document.createElement("button");

        button.className = "option";
        button.textContent = suat.TenPhong;

        button.addEventListener("click", function () {
          document
            .querySelectorAll("#phongContainer .option")
            .forEach((x) => x.classList.remove("selected"));

          this.classList.add("selected");

          hienThiGio(ngay, suat.MaPhong);
        });

        container.appendChild(button);
      }
    });
}

function hienThiGio(ngay, maPhong) {
  const container = document.getElementById("gioContainer");

  container.innerHTML = "";

  danhSachSuat
    .filter(
      (suat) =>
        suat.NgayChieu.substring(0, 10) === ngay && suat.MaPhong === maPhong,
    )
    .forEach((suat) => {
      const button = document.createElement("button");

      button.className = "option";
      button.textContent = formatGio(suat.GioChieu);

      button.addEventListener("click", function () {
        document
          .querySelectorAll("#gioContainer .option")
          .forEach((x) => x.classList.remove("selected"));

        this.classList.add("selected");

        suatDangChon = suat;

        loadGhe(suat.MaSuatChieu);
      });

      container.appendChild(button);
    });
}

async function loadGhe(maSuatChieu) {
  try {
    const [gheResponse, daDatResponse] = await Promise.all([
      fetch(`${API}/ghe/${maSuatChieu}`),
      fetch(`${API}/ghe-dadat/${maSuatChieu}`),
    ]);

    if (!gheResponse.ok || !daDatResponse.ok) {
      throw new Error("Không thể lấy dữ liệu ghế");
    }

    const ghe = await gheResponse.json();
    const gheDaDat = await daDatResponse.json();

    const danhSachGheDaDat = new Set(
      gheDaDat.map((item) => Number(item.MaGhe)),
    );

    const container = document.getElementById("gheContainer");

    container.innerHTML = "";
    gheDangChon = [];
    giaGheTheoMa.clear();
    danhSachDichVuDangChon.clear();
    dichVuDangSua = null;
    capNhatGiaoDienDichVu();
    const cacHang = {};

    ghe.forEach((item) => {
      const tenHang = item.TenHang;

      if (!cacHang[tenHang]) {
        cacHang[tenHang] = [];
      }

      cacHang[tenHang].push(item);

      giaGheTheoMa.set(Number(item.MaGhe), Number(item.Gia));
    });

    Object.keys(cacHang)
      .sort()
      .forEach((tenHang) => {
        const danhSach = cacHang[tenHang];

        danhSach.sort((a, b) => {
          const soA = Number(String(a.SoGhe).match(/\d+/)?.[0] || 0);

          const soB = Number(String(b.SoGhe).match(/\d+/)?.[0] || 0);

          return soA - soB;
        });

        const hang = document.createElement("div");

        const loaiGhe = danhSach[0].LoaiGhe;

        hang.className =
          loaiGhe === "Đôi" ? "ghe-hang ghe-hang-doi" : "ghe-hang";

        hang.style.gridTemplateColumns = `repeat(${danhSach.length}, minmax(0, 1fr))`;

        const tieuDe = document.createElement("div");

        tieuDe.className = "ten-hang-ghe";

        container.appendChild(tieuDe);

        danhSach.forEach((item) => {
          const button = document.createElement("button");

          button.type = "button";
          button.className = "ghe";
          button.textContent = item.SoGhe;

          button.dataset.maGhe = item.MaGhe;
          button.dataset.loaiGhe = item.LoaiGhe;
          button.title = `${item.SoGhe} - ${formatTien(item.Gia)}`;

          if (item.LoaiGhe === "Thường") {
            button.classList.add("ghe-thuong");
          }

          if (item.LoaiGhe === "VIP") {
            button.classList.add("ghe-vip");
          }

          if (item.LoaiGhe === "Đôi") {
            button.classList.add("ghe-doi");
          }

          if (danhSachGheDaDat.has(Number(item.MaGhe))) {
            button.classList.add("dadat");
            button.disabled = true;
          }

          button.addEventListener("click", function () {
            const maGhe = Number(this.dataset.maGhe);

            if (this.classList.contains("selected")) {
              this.classList.remove("selected");

              gheDangChon = gheDangChon.filter((x) => x !== maGhe);
            } else {
              this.classList.add("selected");
              gheDangChon.push(maGhe);
            }

            capNhatTongTien();
          });

          hang.appendChild(button);
        });

        container.appendChild(hang);
      });
    capNhatGiaoDienDichVu();
    capNhatTongTien();
  } catch (error) {
    console.error("Lỗi tải ghế:", error);
    alert("Không thể tải ghế");
  }
}

async function loadDichVu() {
  try {
    const response = await fetch(`${API}/dichvu`);

    if (!response.ok) {
      throw new Error("Không thể tải dịch vụ");
    }

    const result = await response.json();
    const data = Array.isArray(result) ? result : result.data;

    const container = document.getElementById("dichvuContainer");
    container.innerHTML = "";

    data.forEach((item) => {
      const div = document.createElement("div");
      div.className = "dichvu";
      div.dataset.maDichVu = item.MaDichVu;
      div.innerHTML = `
        <strong>${item.TenDichVu}</strong>
        <br>
        <span>${formatTien(Number(item.Gia))}</span>
      `;

      div.addEventListener("click", function () {
        const maDichVu = Number(item.MaDichVu);

        if (danhSachDichVuDangChon.has(maDichVu)) {
          danhSachDichVuDangChon.delete(maDichVu);

          if (dichVuDangSua === maDichVu) {
            dichVuDangSua = null;
          }
        } else {
          const tongSoLuong = [...danhSachDichVuDangChon.values()].reduce(
            (tong, dv) => tong + dv.soLuong,
            0,
          );

          if (tongSoLuong >= gheDangChon.length) {
            alert("Số lượng dịch vụ đã bằng số ghế!");
            return;
          }

          danhSachDichVuDangChon.set(maDichVu, {
            item: item,
            soLuong: 1,
          });

          dichVuDangSua = maDichVu;
        }

        capNhatGiaoDienDichVu();
        capNhatTongTien();
      });

      container.appendChild(div);
    });
  } catch (error) {
    console.error(error);
    alert("Không thể tải dịch vụ");
  }
}

function capNhatGiaoDienDichVu() {
  const cacThe = document.querySelectorAll(".dichvu");

  cacThe.forEach((the, index) => {
    const maDichVu = Number(the.dataset.maDichVu);

    the.classList.toggle("selected", danhSachDichVuDangChon.has(maDichVu));
  });

  const box = document.getElementById("soLuongDichVuBox");
  const danhSach = document.getElementById("danhSachDichVuDaChon");

  const dichVuHienTai = danhSachDichVuDangChon.get(dichVuDangSua);

  if (dichVuHienTai) {
    box.style.display = "flex";
    document.getElementById("soLuongDichVu").textContent =
      dichVuHienTai.soLuong;
  } else {
    box.style.display = "none";
  }

  const cacDichVu = [...danhSachDichVuDangChon.values()];

  danhSach.innerHTML = `
    <h4>Dịch vụ đã chọn</h4>
    ${
      cacDichVu.length
        ? cacDichVu
            .map(
              (dv) => `
            <p>
              ${dv.item.TenDichVu} × ${dv.soLuong}
              - ${formatTien(dv.soLuong * Number(dv.item.Gia))}
            </p>
          `,
            )
            .join("")
        : "<p>Chưa chọn dịch vụ</p>"
    }
    <p>
      Tổng số lượng: ${cacDichVu.reduce((tong, dv) => tong + dv.soLuong, 0)}
      / ${gheDangChon.length} ghế
    </p>
  `;
}

function capNhatTongTien() {
  const tienVe = gheDangChon.reduce((tong, maGhe) => {
    return tong + (giaGheTheoMa.get(maGhe) || 0);
  }, 0);

  const tienDichVu = [...danhSachDichVuDangChon.values()].reduce((tong, dv) => {
    return tong + dv.soLuong * Number(dv.item.Gia);
  }, 0);

  document.getElementById("tongTien").textContent = formatTien(
    tienVe + tienDichVu,
  );
}

document.getElementById("giamDichVu").addEventListener("click", function () {
  const dv = danhSachDichVuDangChon.get(dichVuDangSua);

  if (!dv) return;

  dv.soLuong--;

  if (dv.soLuong <= 0) {
    danhSachDichVuDangChon.delete(dichVuDangSua);
    dichVuDangSua = null;
  }

  capNhatGiaoDienDichVu();
  capNhatTongTien();
});

document.getElementById("tangDichVu").addEventListener("click", function () {
  const dv = danhSachDichVuDangChon.get(dichVuDangSua);

  if (!dv) return;

  const tongSoLuong = [...danhSachDichVuDangChon.values()].reduce(
    (tong, item) => tong + item.soLuong,
    0,
  );

  if (tongSoLuong >= gheDangChon.length) {
    alert("Tổng số lượng dịch vụ không được vượt quá số ghế!");
    return;
  }

  dv.soLuong++;

  capNhatGiaoDienDichVu();
  capNhatTongTien();
});

document.getElementById("btnTiepTuc").addEventListener("click", function () {
  if (!suatDangChon) {
    alert("Vui lòng chọn ngày, phòng và giờ");
    return;
  }

  if (gheDangChon.length === 0) {
    alert("Vui lòng chọn ghế");
    return;
  }

  const danhSachDichVu = [...danhSachDichVuDangChon.values()];

  const tongSoLuongDichVu = danhSachDichVu.reduce(
    (tong, dv) => tong + dv.soLuong,
    0,
  );

  if (tongSoLuongDichVu !== gheDangChon.length) {
    alert(
      `Bạn đang chọn ${gheDangChon.length} ghế nhưng mới chọn ${tongSoLuongDichVu} dịch vụ. Vui lòng chọn đủ dịch vụ!`,
    );
    return;
  }

  const tienVe = gheDangChon.reduce((tong, maGhe) => {
    return tong + (giaGheTheoMa.get(maGhe) || 0);
  }, 0);

  const tienDichVu = danhSachDichVu.reduce((tong, dv) => {
    return tong + dv.soLuong * Number(dv.item.Gia);
  }, 0);

  const tongTien = tienVe + tienDichVu;

  const thongTin = {
    tenPhim,
    maSuatChieu: suatDangChon.MaSuatChieu,
    maPhong: suatDangChon.MaPhong,
    tenPhong: suatDangChon.TenPhong,
    ngayChieu: suatDangChon.NgayChieu,
    gioChieu: suatDangChon.GioChieu,

    ghe: gheDangChon,

    dichVu: danhSachDichVu.map((dv) => ({
      MaDichVu: dv.item.MaDichVu,
      TenDichVu: dv.item.TenDichVu,
      Gia: Number(dv.item.Gia),
      soLuong: dv.soLuong,
    })),

    soLuongGhe: gheDangChon.length,
    soLuongDichVu: tongSoLuongDichVu,
    tongTien,
  };

  console.log("Thông tin đặt vé:", thongTin);

  localStorage.setItem("thongTinDatVe", JSON.stringify(thongTin));

  window.location.href = "thanhtoan.html";
});

function formatTien(tien) {
  return Number(tien).toLocaleString("vi-VN") + "đ";
}

function formatNgay(ngay) {
  const date = new Date(ngay);

  return date.toLocaleDateString("vi-VN");
}

function formatGio(gio) {
  return gio.substring(0, 5);
}

loadSuatChieu();
loadDichVu();
