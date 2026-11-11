const movieList = document.getElementById("movieList");
let movieHienTai = null;

const params = new URLSearchParams(window.location.search);

const tenPhimURL = params.get("TenPhim");

console.log("Tên phim lấy từ URL:", tenPhimURL);

// LOAD PHIM

async function loadMovie() {
  try {
    if (!tenPhimURL) {
      movieList.innerHTML = `
        <p style="color:red">
          Không có tên phim trong URL!
        </p>
      `;

      console.log("URL hiện tại:", window.location.href);

      return;
    }

    const response = await fetch("http://localhost:3000/api/phim");

    if (!response.ok) {
      throw new Error("Không thể lấy danh sách phim từ Backend");
    }

    const movies = await response.json();

    console.log("Danh sách phim từ SQL:", movies);

    // TÌM PHIM

    const movie = movies.find(function (item) {
      console.log(
        "Đang so sánh:",
        `"${item.TenPhim}"`,
        "với",
        `"${tenPhimURL}"`,
      );

      return (
        String(item.TenPhim).trim().toLowerCase() ===
        String(tenPhimURL).trim().toLowerCase()
      );
    });

    // KHÔNG TÌM THẤY

    if (!movie) {
      movieList.innerHTML = `
        <h3 style="color:red">
          Không tìm thấy phim
        </h3>

        <p>
          Tên phim từ URL:
          <b>${tenPhimURL}</b>
        </p>
      `;

      console.log("Không tìm thấy phim.");
      console.log("Tên phim cần tìm:", tenPhimURL);

      return;
    }
    movieHienTai = movie;

    const movieDiv = document.createElement("div");

    movieDiv.className = "main";

    movieDiv.innerHTML = `

      <div class="thongTinPhim">

        <img
          src="${movie.AnhPhim}"
          alt="${movie.TenPhim}"
        />


        <div class="chiTietPhim">

          <h4 class="tenPhim">
            ${movie.TenPhim}
          </h4>


          <p>
            <b>Đạo diễn:</b>
            ${movie.DaoDien || "Chưa cập nhật"}
          </p>


          <p>
            <b>Diễn viên:</b>
            ${movie.DienVien || "Chưa cập nhật"}
          </p>


          <p>
            <b>Thể loại:</b>
            ${movie.TheLoai || "Chưa cập nhật"}
          </p>


          <p>
            <b>Khởi chiếu:</b>
            ${formatDate(movie.KhoiChieu)}
          </p>


          <p>
            <b>Thời lượng:</b>
            ${movie.ThoiLuong || "Chưa cập nhật"} phút
          </p>


          <p>
            <b>Ngôn ngữ:</b>
            ${movie.Ngonngu || "Chưa cập nhật"}
          </p>


          <p>
            <b>Rated:</b>
            ${movie.rated || "Chưa cập nhật"}
          </p>


         <button
  type="button"
  onclick="window.location.href='datve.html?phim=' + encodeURIComponent('${movie.TenPhim}')"
>
  Đặt vé
</button>


          <button
            type="button"
            onclick="showTrailer()"
          >
            Trailer
          </button>

        </div>

      </div>


      <h2>Nội dung</h2>
       <hr>

      <p class="noidung">
        ${movie.noidung || "Chưa có nội dung mô tả."}
      </p>

    `;

    movieList.appendChild(movieDiv);
  } catch (error) {
    console.error(error);

    movieList.innerHTML = `
      <p style="color:red">
        ${error.message}
      </p>
    `;
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

function showMovieDetail(movieName) {
  alert("Tên phim: " + movieName);
}

function showTrailer() {
  if (!movieHienTai) {
    alert("Không tìm thấy thông tin phim!");
    return;
  }

  if (!movieHienTai.Trailer) {
    alert("Phim này chưa có trailer!");
    return;
  }

  const modal = document.getElementById("trailerModal");
  const video = document.getElementById("trailerVideo");

  const trailerURL = movieHienTai.Trailer;

  const url = new URL(trailerURL);
  const videoId = url.searchParams.get("v");

  if (!videoId) {
    alert("Link trailer YouTube không hợp lệ!");
    return;
  }

  video.src = "https://www.youtube.com/embed/" + videoId + "?autoplay=1";

  modal.style.display = "flex";
}

function closeTrailer() {
  const modal = document.getElementById("trailerModal");
  const video = document.getElementById("trailerVideo");

  video.src = "";

  modal.style.display = "none";
}

document.addEventListener("click", function (event) {
  const modal = document.getElementById("trailerModal");

  const trailerBox = document.querySelector(".trailer-box");

  if (event.target === modal && !trailerBox.contains(event.target)) {
    closeTrailer();
  }
});

loadMovie();
