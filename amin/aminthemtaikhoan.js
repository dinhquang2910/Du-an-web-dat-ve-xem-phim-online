async function themTaiKhoan(event) {
  event.preventDefault();

  const hoTen = document.getElementById("hoTen").value.trim();
  const soDienThoai = document.getElementById("soDienThoai").value.trim();
  const matKhau = document.getElementById("matKhau").value.trim();

  if (hoTen === "" || soDienThoai === "" || matKhau === "") {
    alert("Vui lòng nhập đầy đủ thông tin!");
    return;
  }

  try {
    const response = await fetch("http://localhost:3000/api/taikhoan", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        HoTen: hoTen,
        SoDienThoai: soDienThoai,
        MatKhau: matKhau,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message || "Thêm tài khoản thất bại!");
      return;
    }

    alert("Thêm tài khoản thành công!");

    window.location.href = "aminuser.html";
  } catch (error) {
    console.error("Lỗi:", error);
    alert("Không thể kết nối đến server!");
  }
}
