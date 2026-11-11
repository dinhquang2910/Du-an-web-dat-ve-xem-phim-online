const API = "http://localhost:3000/api";

const danhSachTheLoai = document.getElementById("danhSachTheLoai");

const tenTheLoai = document.getElementById("tenTheLoai");

const soLuongTheLoai = document.getElementById("soLuongTheLoai");

// hien thi

async function loadTheLoai() {
  try {
    const response = await fetch(`${API}/theloai`);

    if (!response.ok) {
      throw new Error("Không thể lấy danh sách thể loại");
    }

    const data = await response.json();

    danhSachTheLoai.innerHTML = "";

    soLuongTheLoai.textContent = `${data.length} thể loại`;

    data.forEach(function (theLoai, index) {
      const tr = document.createElement("tr");

      tr.innerHTML = `
                <td>${index + 1}</td>

                

                <td>
                    ${theLoai.TenTheLoai}
                </td>

                <td>

                    <button
                        class="btn-sua"
                        onclick="suaTheLoai(
                            ${theLoai.MaTheLoai},
                            '${theLoai.TenTheLoai.replace(/'/g, "\\'")}'
                        )"
                    >
                        SỬA
                    </button>

                    <button
                        class="btn-xoa"
                        onclick="xoaTheLoai(
                            ${theLoai.MaTheLoai},
                            '${theLoai.TenTheLoai.replace(/'/g, "\\'")}'
                        )"
                    >
                        XÓA
                    </button>

                </td>
            `;

      danhSachTheLoai.appendChild(tr);
    });
  } catch (error) {
    console.error(error);

    danhSachTheLoai.innerHTML = `
            <tr>
                <td colspan="4" style="text-align:center;color:red;">
                    Không thể tải danh sách thể loại
                </td>
            </tr>
        `;
  }
}

// thêm

async function themTheLoai() {
  const ten = tenTheLoai.value.trim();

  if (ten === "") {
    alert("Vui lòng nhập tên thể loại!");

    return;
  }

  try {
    const response = await fetch(`${API}/theloai`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        TenTheLoai: ten,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message || "Không thể thêm thể loại!");

      return;
    }

    alert("Thêm thể loại thành công!");

    tenTheLoai.value = "";

    loadTheLoai();
  } catch (error) {
    console.error(error);

    alert("Lỗi kết nối server!");
  }
}

// sửa

async function suaTheLoai(ma, tenCu) {
  const tenMoi = prompt("Nhập tên thể loại mới:", tenCu);

  if (tenMoi === null) {
    return;
  }

  const ten = tenMoi.trim();

  if (ten === "") {
    alert("Tên thể loại không được để trống!");

    return;
  }

  try {
    const response = await fetch(`${API}/theloai/${ma}`, {
      method: "PUT",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        TenTheLoai: ten,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message || "Không thể sửa thể loại!");

      return;
    }

    alert("Sửa thể loại thành công!");

    loadTheLoai();
  } catch (error) {
    console.error(error);

    alert("Lỗi kết nối server!");
  }
}
// xóa

async function xoaTheLoai(ma, ten) {
  const xacNhan = confirm(`Bạn có chắc muốn xóa thể loại "${ten}" không?`);

  if (!xacNhan) {
    return;
  }

  try {
    const response = await fetch(`${API}/theloai/${ma}`, {
      method: "DELETE",
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message || "Không thể xóa thể loại!");

      return;
    }

    alert("Xóa thể loại thành công!");

    loadTheLoai();
  } catch (error) {
    console.error(error);

    alert("Lỗi kết nối server!");
  }
}

loadTheLoai();
