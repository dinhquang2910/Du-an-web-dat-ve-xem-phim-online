const form = document.getElementById("registerForm");

const phoneInput = document.querySelector('input[name="account"]');

const passwordInput = document.getElementById("password");

const confirmPasswordInput = document.getElementById("confirmPassword");

const matchError = document.getElementById("matchError");

function setupToggle(btnId, inputId) {
  const btn = document.getElementById(btnId);
  const input = document.getElementById(inputId);

  if (!btn || !input) {
    return;
  }

  btn.addEventListener("click", function () {
    const isHidden = input.type === "password";

    if (isHidden) {
      input.type = "text";

      btn.textContent = "Ẩn";

      btn.setAttribute("aria-label", "Ẩn mật khẩu");
    } else {
      input.type = "password";

      btn.textContent = "Hiện";

      btn.setAttribute("aria-label", "Hiện mật khẩu");
    }
  });
}

setupToggle("togglePass", "password");

setupToggle("toggleConfirmPass", "confirmPassword");

form.addEventListener("submit", async function (event) {
  event.preventDefault();

  const fullname = document
    .querySelector('input[name="fullname"]')
    .value.trim();

  const phone = phoneInput.value.trim();

  const password = passwordInput.value;

  const confirmPassword = confirmPasswordInput.value;

  // Kiểm tra mật khẩu
  if (password !== confirmPassword) {
    matchError.textContent = "Mật khẩu xác nhận không khớp!";

    matchError.style.display = "block";

    confirmPasswordInput.focus();

    return;
  }

  matchError.style.display = "none";

  try {
    const response = await fetch("http://localhost:3000/api/dangky", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        HoTen: fullname,
        SoDienThoai: phone,
        MatKhau: password,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.message || "Đăng ký thất bại!");

      return;
    }

    alert(result.message);

    form.reset();

    window.location.href = "./indexdangnhap.html";
  } catch (error) {
    console.error(error);

    alert("Không thể kết nối đến Backend!");
  }
});
