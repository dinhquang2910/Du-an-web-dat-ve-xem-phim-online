const movieList = document.getElementById("movieList");

async function loadMovies() {
  try {
    const response = await fetch("http://localhost:3000/api/phim");

    if (!response.ok) {
      throw new Error("Không thể lấy danh sách phim");
    }

    const movies = await response.json();

    movies.forEach(function (movie) {
      const movieDiv = document.createElement("div");

      movieDiv.className = "main";

      movieDiv.innerHTML = `
        <img 
          src="${movie.AnhPhim}" 
          alt="${movie.TenPhim}"
        />

        <h4>${movie.TenPhim}</h4>

        <p>
          Thể loại : ${movie.TheLoai || "Chưa cập nhật"}
        </p>

        <p>
          Thời lượng : 
          ${movie.ThoiLuong || "Chưa cập nhật"} phút
        </p>

        <p>
          Khởi chiếu : 
          ${formatDate(movie.KhoiChieu)}
        </p>

       
<a href="./indexdangnhap.html"><button 
          type="button"
          class="btn btn-outline-primary"
          onclick="deleteMovie('${movie.TenPhim}')"
        >
          ĐẶT VÉ
        </button></a>
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

loadMovies();
