const gioHang = document.getElementById("gioHang");

const tongSoVe = document.getElementById("tongSoVe");

const gioPhim = JSON.parse(localStorage.getItem("gioPhim")) || [];

if (gioPhim.length === 0) {
  gioHang.innerHTML = `
    <div class="empty-cart">

      <h3>Giỏ vé đang trống 😢</h3>

      <a href="./dangnhapxong.html">
        Quay lại chọn phim
      </a>

    </div>
  `;
} else {
  let tong = 0;

  gioPhim.forEach((ve, index) => {
    tong += ve.soLuong;

    gioHang.innerHTML += `

      <div class="ticket-card">

        <h3>${ve.tenPhim}</h3>

        <p>
          <b>Ngày:</b>
          ${ve.ngay}
        </p>

        <p>
          <b>Giờ chiếu:</b>
          ${ve.gio}
        </p>

        <p>
          <b>Ghế:</b>
          ${ve.ghe.join(", ")}
        </p>

        <p>
          <b>Số lượng:</b>
          ${ve.soLuong} vé
        </p>


        <button
          class="btn btn-danger"
          onclick="xoaVe(${index})"
        >
          Xóa
        </button>

      </div>

    `;
  });

  tongSoVe.textContent = tong;
}

function xoaVe(index) {
  gioPhim.splice(index, 1);

  localStorage.setItem("gioPhim", JSON.stringify(gioPhim));

  location.reload();
}
