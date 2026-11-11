const loginForm = document.getElementById("loginForm");

const accountInput = document.getElementById("account");

const passwordInput = document.getElementById("password");

const loginMessage = document.getElementById("loginMessage");

loginForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const account = accountInput.value.trim();

  const password = passwordInput.value;

  try {
    const response = await fetch("http://localhost:3000/api/dangnhap", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      credentials: "include",

      body: JSON.stringify({
        SoDienThoai: account,
        MatKhau: password,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      loginMessage.textContent = result.message || "Đăng nhập thất bại!";

      loginMessage.style.color = "red";

      return;
    }

    loginMessage.textContent = "Đăng nhập thành công!";

    loginMessage.style.color = "green";

    const user = result.user;

    localStorage.setItem(
      "user",
      JSON.stringify({
        MaTaiKhoan: user.MaTaiKhoan,
        fullname: user.HoTen,
        phone: user.SoDienThoai,
        role: user.VaiTro,
      }),
    );

    setTimeout(function () {
      if (user.VaiTro === "Quản lý") {
        window.location.href = "./amin/amintrangchu.html";
      } else if (user.VaiTro === "Nhân viên") {
        window.location.href = "./amin/nvtrangchu.html";
      } else {
        window.location.href = "./dangnhapxong.html";
      }
    }, 1000);
  } catch (error) {
    console.error(error);

    loginMessage.textContent = "Không thể kết nối đến Backend!";

    loginMessage.style.color = "red";
  }
});
