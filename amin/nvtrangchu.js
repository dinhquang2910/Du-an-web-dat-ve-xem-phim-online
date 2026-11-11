const movieList = document.getElementById("movieList");

async function loadMovies() {
  try {
    const response = await fetch("http://localhost:3000/api/phim");

    if (!response.ok) {
      throw new Error("Không thể lấy danh sách phim");
    }

    const movies = await response.json();

    movieList.innerHTML = "";

    movies.forEach(function (movie) {
      const movieDiv = document.createElement("div");

      movieDiv.className = "main";

      const trangThai = movie.TrangThai || "Hoạt động";

      movieDiv.innerHTML = `
        <img 
          src="${movie.AnhPhim}" 
          alt="${movie.TenPhim}"
        />

        <h4>${movie.TenPhim}</h4>

        <p>
          Thể loại :
          ${movie.TheLoai || "Chưa cập nhật"}
        </p>

        <p>
          Thời lượng :
          ${movie.ThoiLuong || "Chưa cập nhật"} phút
        </p>

        <p>
          Khởi chiếu :
          ${formatDate(movie.KhoiChieu)}
        </p>

        <p>
          Trạng thái :
          <strong>
            ${trangThai}
          </strong>
        </p>

        <!-- NÚT CHI TIẾT -->
        <a
          href="./nvchitiet.html?TenPhim=${encodeURIComponent(movie.TenPhim)}"
        >
          <button
            type="button"
            class="btn btn-outline-primary"
          >
            CHI TIẾT
          </button>
        </a>
        <!-- NÚT SỬA -->
<br>

<a
  href="./aminsuaphim.html?TenPhim=${encodeURIComponent(movie.TenPhim)}"
>
  <button
    type="button"
    class="btn btn-outline-primary"
  >
    SỬA PHIM
  </button>
</a>
        <!-- NÚT XÓA -->
        <button
          type="button"
          class="btn btn-outline-primary"
          onclick="deleteMovie('${movie.TenPhim}')"
        >
          XÓA PHIM
        </button>

        <!-- NÚT TRẠNG THÁI -->
        <br>

        <button
          type="button"
          class="btn btn-outline-primary"
          onclick="doiTrangThai(
            '${movie.TenPhim}',
            '${trangThai}'
          )"
        >
          ${trangThai.toUpperCase()}
        </button>
      `;

      movieList.appendChild(movieDiv);
    });
  } catch (error) {
    console.error(error);

    const errorMessage = document.createElement("p");

    errorMessage.textContent = "Không thể tải danh sách phim từ Backend!";

    errorMessage.style.color = "red";

    movieList.appendChild(errorMessage);
  }
}

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

function showMovieDetail(movieId) {
  alert("Mã phim: " + movieId);
}

async function doiTrangThai(tenPhim, trangThaiHienTai) {
  let trangThaiMoi;

  if (trangThaiHienTai === "Hoạt động") {
    const xacNhan = confirm(
      `Bạn có muốn chuyển phim "${tenPhim}" sang trạng thái "Ngừng chiếu" không?`,
    );

    if (!xacNhan) {
      return;
    }

    trangThaiMoi = "Ngừng chiếu";
  } else {
    const xacNhan = confirm(
      `Bạn có muốn chuyển phim "${tenPhim}" sang trạng thái "Hoạt động" không?`,
    );

    if (!xacNhan) {
      return;
    }

    trangThaiMoi = "Hoạt động";
  }

  try {
    const response = await fetch(
      `http://localhost:3000/api/phim/${encodeURIComponent(tenPhim)}/trangthai`,
      {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          TrangThai: trangThaiMoi,
        }),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      alert(result.message || "Không thể thay đổi trạng thái phim!");

      return;
    }

    alert(`Đã chuyển phim "${tenPhim}" sang "${trangThaiMoi}".`);

    loadMovies();
  } catch (error) {
    console.error(error);

    alert("Không thể kết nối đến Backend!");
  }
}

async function deleteMovie(tenPhim) {
  const confirmDelete = confirm(
    `Bạn có chắc chắn muốn xóa phim "${tenPhim}" không?`,
  );

  if (!confirmDelete) {
    return;
  }

  try {
    const response = await fetch(
      `http://localhost:3000/api/phim/${encodeURIComponent(tenPhim)}`,
      {
        method: "DELETE",
      },
    );

    const result = await response.json();

    if (!response.ok) {
      alert(result.message || "Xóa phim thất bại!");

      return;
    }

    alert(result.message);

    location.reload();
  } catch (error) {
    console.error(error);

    alert("Không thể kết nối đến Backend!");
  }
}

loadMovies();
