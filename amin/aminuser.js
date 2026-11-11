const accountList = document.getElementById("accountList");

const searchAccount = document.getElementById("searchAccount");

const searchButton = document.getElementById("searchButton");

let accounts = [];

async function loadAccounts() {
  try {
    const response = await fetch("http://localhost:3000/api/taikhoan");

    if (!response.ok) {
      throw new Error("Không thể lấy danh sách tài khoản");
    }

    accounts = await response.json();

    displayAccounts(accounts);
  } catch (error) {
    console.error(error);

    accountList.innerHTML = `

            <tr>

                <td
                    colspan="7"
                    class="text-center text-danger"
                >
                    Không thể tải danh sách tài khoản!
                </td>

            </tr>

        `;
  }
}

function displayAccounts(accountData) {
  accountList.innerHTML = "";

  // Không có tài khoản

  if (accountData.length === 0) {
    accountList.innerHTML = `

            <tr>

                <td
                    colspan="7"
                    class="text-center"
                >
                    Không tìm thấy tài khoản!
                </td>

            </tr>

        `;

    return;
  }

  // Hiển thị từng tài khoản

  accountData.forEach(function (account, index) {
    const row = document.createElement("tr");

    row.innerHTML = `

            <td>
                ${index + 1}
            </td>

            <td>
                ${account.HoTen}
            </td>

            <td>
                ${account.SoDienThoai}
            </td>

            <td>
    <select
        class="form-select form-select-sm"
        style="width: 130px;"
        onchange="changeAccountRole(${account.MaTaiKhoan}, this.value)"
    >
        <option value="Quản lý" ${account.VaiTro === "Quản lý" ? "selected" : ""}>
            Quản lý
        </option>

        <option value="Nhân viên" ${account.VaiTro === "Nhân viên" ? "selected" : ""}>
            Nhân viên
        </option>

        <option value="Khách hàng" ${account.VaiTro === "Khách hàng" ? "selected" : ""}>
            Khách hàng
        </option>
    </select>
</td>

            <td>
                ${formatDate(account.NgayTao)}
            </td>

            <td>
                ${account.TrangThai}
            </td>

            <td>

                <button
                    class="btn btn-warning btn-sm"
                    onclick="changeAccountStatus(${account.MaTaiKhoan})"
                >
                    ${account.TrangThai === "Hoạt động" ? "KHÓA" : "MỞ KHÓA"}
                </button>
                
                <button
    class="btn btn-primary btn-sm"
    onclick="editAccount(${account.MaTaiKhoan}, '${account.HoTen}')"
>
    SỬA
</button>
                <button
                    class="btn btn-danger btn-sm"
                    onclick="deleteAccount(${account.MaTaiKhoan})"
                >
                    XÓA
                </button>
                
            </td>

        `;

    accountList.appendChild(row);
  });
}

// ĐỊNH DẠNG NGÀY

function formatDate(dateString) {
  if (!dateString) {
    return "Chưa cập nhật";
  }

  const date = new Date(dateString);

  const day = String(date.getDate()).padStart(2, "0");

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

// KHÓA / MỞ KHÓA TÀI KHOẢN

async function changeAccountRole(maTaiKhoan, vaiTroMoi) {
  const confirmChange = confirm(
    `Bạn có chắc muốn đổi quyền tài khoản này thành "${vaiTroMoi}" không?`,
  );

  if (!confirmChange) {
    loadAccounts();
    return;
  }

  try {
    const response = await fetch(
      `http://localhost:3000/api/taikhoan/${maTaiKhoan}/vaitro`,
      {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          VaiTro: vaiTroMoi,
        }),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      alert(result.message || "Đổi quyền thất bại!");
      loadAccounts();
      return;
    }

    alert(result.message);

    loadAccounts();
  } catch (error) {
    console.error(error);

    alert("Không thể kết nối đến Backend!");

    loadAccounts();
  }
}

async function changeAccountStatus(maTaiKhoan) {
  const confirmChange = confirm(
    "Bạn có chắc muốn thay đổi trạng thái tài khoản này không?",
  );

  if (!confirmChange) {
    return;
  }

  try {
    const response = await fetch(
      `http://localhost:3000/api/taikhoan/${maTaiKhoan}/trangthai`,
      {
        method: "PUT",
      },
    );

    const result = await response.json();

    if (!response.ok) {
      alert(result.message || "Cập nhật trạng thái thất bại!");
      return;
    }

    alert(result.message);

    loadAccounts();
  } catch (error) {
    console.error(error);

    alert("Không thể kết nối đến Backend!");
  }
}

async function editAccount(maTaiKhoan, hoTen) {
  const matKhauMoi = prompt(
    `Sửa mật khẩu cho tài khoản "${hoTen}"\n\nNhập mật khẩu mới:`,
  );

  if (matKhauMoi === null) {
    return;
  }

  if (matKhauMoi.trim() === "") {
    alert("Mật khẩu không được để trống!");
    return;
  }

  const xacNhan = confirm(
    `Bạn có chắc muốn đổi mật khẩu của tài khoản "${hoTen}" không?`,
  );

  if (!xacNhan) {
    return;
  }

  try {
    const response = await fetch(
      `http://localhost:3000/api/taikhoan/${maTaiKhoan}/matkhau`,
      {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          MatKhau: matKhauMoi,
        }),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      alert(result.message || "Sửa mật khẩu thất bại!");
      return;
    }

    alert(result.message);

    loadAccounts();
  } catch (error) {
    console.error(error);

    alert("Không thể kết nối đến Backend!");
  }
}

async function deleteAccount(maTaiKhoan) {
  const confirmDelete = confirm(
    "Bạn có chắc chắn muốn xóa tài khoản này không?",
  );

  if (!confirmDelete) {
    return;
  }

  try {
    const response = await fetch(
      `http://localhost:3000/api/taikhoan/${maTaiKhoan}`,
      {
        method: "DELETE",
      },
    );

    const result = await response.json();

    if (!response.ok) {
      alert(result.message || "Xóa tài khoản thất bại!");

      return;
    }

    alert(result.message);

    // Tải lại danh sách

    loadAccounts();
  } catch (error) {
    console.error(error);

    alert("Không thể kết nối đến Backend!");
  }
}

function searchAccounts() {
  const keyword = searchAccount.value.trim().toLowerCase();

  const filteredAccounts = accounts.filter(function (account) {
    return (
      account.HoTen.toLowerCase().includes(keyword) ||
      account.SoDienThoai.toLowerCase().includes(keyword)
    );
  });

  displayAccounts(filteredAccounts);
}

searchButton.addEventListener("click", searchAccounts);
function themTaiKhoan() {
  window.location.href = "aminthemtaikhoan.html";
}
loadAccounts();
