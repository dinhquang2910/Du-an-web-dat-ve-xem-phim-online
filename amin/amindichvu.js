const API_DICH_VU = "http://localhost:3000/api/dichvu";

const formDichVu = document.getElementById("formDichVu");
const inputTen = document.getElementById("tenDichVu");
const inputGia = document.getElementById("giaDichVu");
const tbodyDichVu = document.getElementById("danhSachDichVu");
const soLuongDichVu = document.getElementById("soLuongDichVu");
const tieuDeForm = document.getElementById("tieuDeForm");
const btnLuu = document.getElementById("btnLuu");
const btnHuy = document.getElementById("btnHuy");
const thongBao = document.getElementById("thongBao");

let maDichVuDangSua = null;

function dinhDangTien(gia) {
  return Number(gia || 0).toLocaleString("vi-VN") + " đ";
}

function hienThongBao(noiDung, laLoi = false) {
  thongBao.textContent = noiDung;
  thongBao.classList.toggle("loi", laLoi);
  thongBao.classList.add("hien");
  window.clearTimeout(hienThongBao.timer);
  hienThongBao.timer = window.setTimeout(() => {
    thongBao.classList.remove("hien");
  }, 3000);
}

async function docPhanHoi(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      data.message || data.error || `Lỗi HTTP ${response.status}`,
    );
  }
  return data;
}

async function taiDanhSachDichVu() {
  tbodyDichVu.innerHTML =
    '<tr><td colspan="5" class="trang-thai">Đang tải danh sách...</td></tr>';

  try {
    const response = await fetch(API_DICH_VU);
    const data = await docPhanHoi(response);

    const danhSach = Array.isArray(data)
      ? data
      : data.data || data.dichVu || [];

    soLuongDichVu.textContent = `${danhSach.length} dịch vụ`;

    if (danhSach.length === 0) {
      tbodyDichVu.innerHTML =
        '<tr><td colspan="5" class="trang-thai">Chưa có dịch vụ nào.</td></tr>';
      return;
    }

    tbodyDichVu.innerHTML = danhSach
      .map(
        (item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHTML(item.MaDichVu)}</td>
        <td>${escapeHTML(item.TenDichVu)}</td>
        <td>${dinhDangTien(item.Gia)}</td>
        <td>
          <button class="btn-sua" type="button"
            data-action="sua"
            data-id="${escapeHTML(item.MaDichVu)}"
            data-ten="${escapeHTML(item.TenDichVu)}"
            data-gia="${Number(item.Gia)}">Sửa</button>
          <button class="btn-xoa" type="button"
            data-action="xoa"
            data-id="${escapeHTML(item.MaDichVu)}"
            data-ten="${escapeHTML(item.TenDichVu)}">Xóa</button>
        </td>
      </tr>
    `,
      )
      .join("");
  } catch (error) {
    tbodyDichVu.innerHTML = `<tr><td colspan="5" class="trang-thai">Không tải được danh sách: ${escapeHTML(error.message)}</td></tr>`;
    hienThongBao(error.message, true);
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (kyTu) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[kyTu],
  );
}

function resetForm() {
  maDichVuDangSua = null;
  formDichVu.reset();
  tieuDeForm.textContent = "Thêm dịch vụ";
  btnLuu.textContent = "+ Thêm dịch vụ";
  btnHuy.hidden = true;
}

formDichVu.addEventListener("submit", async (event) => {
  event.preventDefault();

  const tenDichVu = inputTen.value.trim();
  const gia = Number(inputGia.value);

  if (!tenDichVu) {
    hienThongBao("Vui lòng nhập tên dịch vụ.", true);
    inputTen.focus();
    return;
  }

  if (!Number.isFinite(gia) || gia < 0) {
    hienThongBao("Giá dịch vụ phải là số không âm.", true);
    inputGia.focus();
    return;
  }

  const duLieu = { tenDichVu: tenDichVu, gia: gia };
  const dangSua = maDichVuDangSua !== null;
  const url = dangSua
    ? `${API_DICH_VU}/${encodeURIComponent(maDichVuDangSua)}`
    : API_DICH_VU;

  btnLuu.disabled = true;

  try {
    const response = await fetch(url, {
      method: dangSua ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(duLieu),
    });

    await docPhanHoi(response);
    hienThongBao(
      dangSua ? "Cập nhật dịch vụ thành công." : "Thêm dịch vụ thành công.",
    );
    resetForm();
    await taiDanhSachDichVu();
  } catch (error) {
    hienThongBao(error.message, true);
  } finally {
    btnLuu.disabled = false;
  }
});

btnHuy.addEventListener("click", resetForm);

tbodyDichVu.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const id = button.dataset.id;

  if (button.dataset.action === "sua") {
    maDichVuDangSua = id;
    inputTen.value = button.dataset.ten || "";
    inputGia.value = button.dataset.gia || "";
    tieuDeForm.textContent = "Cập nhật dịch vụ";
    btnLuu.textContent = "Lưu thay đổi";
    btnHuy.hidden = false;
    inputTen.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  if (button.dataset.action === "xoa") {
    const ten = button.dataset.ten || "dịch vụ này";
    if (!window.confirm(`Bạn có chắc chắn muốn xóa "${ten}" không?`)) return;

    button.disabled = true;
    try {
      const response = await fetch(`${API_DICH_VU}/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      await docPhanHoi(response);
      hienThongBao("Xóa dịch vụ thành công.");
      if (maDichVuDangSua !== null && String(maDichVuDangSua) === String(id)) {
        resetForm();
      }
      await taiDanhSachDichVu();
    } catch (error) {
      hienThongBao(error.message, true);
      button.disabled = false;
    }
  }
});

taiDanhSachDichVu();
