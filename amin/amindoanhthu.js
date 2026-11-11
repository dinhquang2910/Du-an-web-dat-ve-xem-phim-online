const movieList = document.getElementById("movieList");

async function loadRevenue() {
  try {
    const response = await fetch("http://localhost:3000/api/doanhthu");

    if (!response.ok) {
      throw new Error("Không thể lấy dữ liệu doanh thu");
    }

    const movies = await response.json();

    movieList.innerHTML = "";

    movies.forEach(function (movie) {
      const movieDiv = document.createElement("div");

      movieDiv.className = "main";

      const trangThai = movie.TrangThai || "Hoạt động";

      const soVe = Number(movie.SoVeBan || 0);

      const doanhThu = Number(movie.TongDoanhThu || 0);

      movieDiv.innerHTML = `
        <img
          src="${movie.AnhPhim}"
          alt="${movie.TenPhim}"
        />

        <h4>${movie.TenPhim}</h4>

        <p>
          Trạng thái:
          <strong>${trangThai}</strong>
        </p>

        <p>
          <strong>Số vé bán ra:</strong>
          ${soVe} vé
        </p>

        <p>
          <strong>Tổng doanh thu:</strong>
          ${doanhThu.toLocaleString("vi-VN")}đ
        </p>
      `;

      movieList.appendChild(movieDiv);
    });
  } catch (error) {
    console.error(error);

    movieList.innerHTML = `
      <p style="color: red;">
        Không thể tải dữ liệu doanh thu từ Backend!
      </p>
    `;
  }
}

loadRevenue();
