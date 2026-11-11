const API = "http://localhost:3000/api";

const params = new URLSearchParams(window.location.search);

const tenPhimCu = params.get("TenPhim");

async function loadTheLoai() {
  try {
    const response = await fetch(`${API}/theloai`);

    if (!response.ok) {
      throw new Error("Không thể lấy danh sách thể loại");
    }

    const danhSachTheLoai = await response.json();

    const container = document.getElementById("danhSachTheLoai");

    container.innerHTML = "";

    danhSachTheLoai.forEach(function (theLoai) {
      const div = document.createElement("div");

      div.className = "theLoaiItem";

      div.innerHTML = `
        <label>
          <input
            type="checkbox"
            class="theLoaiCheckbox"
            value="${theLoai.MaTheLoai}"
          >

          ${theLoai.TenTheLoai}
        </label>
      `;

      container.appendChild(div);
    });
  } catch (error) {
    console.error(error);

    document.getElementById("danhSachTheLoai").textContent =
      "Không thể tải danh sách thể loại!";
  }
}

async function loadMovie() {
  if (!tenPhimCu) {
    alert("Không tìm thấy tên phim!");

    return;
  }

  try {
    const response = await fetch(
      `${API}/phim/${encodeURIComponent(tenPhimCu)}`,
    );

    if (!response.ok) {
      throw new Error("Không thể lấy thông tin phim");
    }

    const movie = await response.json();

    document.getElementById("tenPhim").value = movie.TenPhim || "";

    document.getElementById("anhPhim").value = movie.AnhPhim || "";

    document.getElementById("daoDien").value = movie.DaoDien || "";

    document.getElementById("dienVien").value = movie.DienVien || "";

    document.getElementById("thoiLuong").value = movie.ThoiLuong || "";

    document.getElementById("ngonNgu").value = movie.Ngonngu || "";

    document.getElementById("rated").value = movie.Rated || "";

    document.getElementById("noiDung").value = movie.noidung || "";

    if (movie.KhoiChieu) {
      const date = new Date(movie.KhoiChieu);

      const year = date.getFullYear();

      const month = String(date.getMonth() + 1).padStart(2, "0");

      const day = String(date.getDate()).padStart(2, "0");

      document.getElementById("khoiChieu").value = `${year}-${month}-${day}`;
    }

    hienThiAnh();

    const theLoaiResponse = await fetch(
      `${API}/phim/${encodeURIComponent(tenPhimCu)}/theloai`,
    );

    if (theLoaiResponse.ok) {
      const danhSachMaTheLoai = await theLoaiResponse.json();

      document
        .querySelectorAll(".theLoaiCheckbox")
        .forEach(function (checkbox) {
          if (danhSachMaTheLoai.includes(Number(checkbox.value))) {
            checkbox.checked = true;
          }
        });
    }
  } catch (error) {
    console.error(error);

    alert("Không thể tải thông tin phim!");
  }
}

function hienThiAnh() {
  const input = document.getElementById("anhPhim");

  const preview = document.getElementById("anhPreview");

  input.addEventListener("input", function () {
    if (input.value.trim() !== "") {
      preview.src = input.value;

      preview.style.display = "block";
    } else {
      preview.style.display = "none";
    }
  });
}

async function suaPhim() {
  const tenPhimMoi = document.getElementById("tenPhim").value.trim();

  const anhPhim = document.getElementById("anhPhim").value.trim();

  const daoDien = document.getElementById("daoDien").value.trim();

  const dienVien = document.getElementById("dienVien").value.trim();

  const khoiChieu = document.getElementById("khoiChieu").value;

  const thoiLuong = document.getElementById("thoiLuong").value;

  const ngonNgu = document.getElementById("ngonNgu").value.trim();

  const rated = document.getElementById("rated").value.trim();

  const noiDung = document.getElementById("noiDung").value.trim();

  const maTheLoai = Array.from(
    document.querySelectorAll(".theLoaiCheckbox:checked"),
  ).map(function (checkbox) {
    return Number(checkbox.value);
  });

  if (!tenPhimMoi) {
    alert("Vui lòng nhập tên phim!");

    return;
  }

  if (maTheLoai.length === 0) {
    alert("Vui lòng chọn ít nhất một thể loại!");

    return;
  }

  const movieData = {
    TenPhim: tenPhimMoi,

    AnhPhim: anhPhim,

    DaoDien: daoDien,

    DienVien: dienVien,

    KhoiChieu: khoiChieu,

    ThoiLuong: thoiLuong,

    Ngonngu: ngonNgu,

    rated: rated,

    noidung: noiDung,

    MaTheLoai: maTheLoai,
  };

  try {
    const response = await fetch(
      `${API}/phim/${encodeURIComponent(tenPhimCu)}`,

      {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(movieData),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      alert(result.message || "Sửa phim thất bại!");

      return;
    }

    alert("Sửa phim thành công!");

    window.location.href = "./amintrangchu.html";
  } catch (error) {
    console.error(error);

    alert("Không thể kết nối đến Backend!");
  }
}

function quayLai() {
  window.location.href = "./amintrangchu.html";
}

async function init() {
  await loadTheLoai();

  await loadMovie();
}

init();
