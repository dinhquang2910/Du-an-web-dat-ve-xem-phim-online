const addMovieForm = document.getElementById("addMovieForm");

const movieName = document.getElementById("movieName");
const movieDirector = document.getElementById("movieDirector");
const movieActors = document.getElementById("movieActors");

const releaseDate = document.getElementById("releaseDate");
const movieDuration = document.getElementById("movieDuration");
const movieLanguage = document.getElementById("movieLanguage");
const movieRated = document.getElementById("movieRated");
const movieContent = document.getElementById("movieContent");
const movieImage = document.getElementById("movieImage");
const movieTrailer = document.getElementById("movieTrailer");

const addMovieMessage = document.getElementById("addMovieMessage");

async function loadMovieGenres() {
  const genreList = document.getElementById("movieGenreList");

  try {
    const response = await fetch("http://localhost:3000/api/theloai");

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Không thể tải thể loại!");
    }

    genreList.innerHTML = "";

    result.forEach((theloai) => {
      const item = document.createElement("div");
      item.className = "genre-item";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.name = "movieGenre";
      checkbox.value = theloai.MaTheLoai;
      checkbox.id = `genre-${theloai.MaTheLoai}`;

      const label = document.createElement("label");
      label.htmlFor = checkbox.id;
      label.textContent = theloai.TenTheLoai;

      item.appendChild(checkbox);
      item.appendChild(label);

      genreList.appendChild(item);
    });

    if (result.length === 0) {
      genreList.innerHTML =
        '<p class="text-muted">Chưa có thể loại nào trong SQL Server.</p>';
    }
  } catch (error) {
    console.error("Lỗi tải thể loại:", error);

    genreList.innerHTML =
      '<p class="text-danger">Không thể tải danh sách thể loại!</p>';
  }
}

loadMovieGenres();

// THÊM PHIM

addMovieForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  // Lấy các thể loại đã tích chọn
  const selectedGenres = Array.from(
    document.querySelectorAll('input[name="movieGenre"]:checked'),
  ).map(function (checkbox) {
    return checkbox.value;
  });

  // Kiểm tra đã chọn thể loại chưa
  if (selectedGenres.length === 0) {
    addMovieMessage.textContent = "Vui lòng chọn ít nhất một thể loại!";
    addMovieMessage.style.color = "red";
    return;
  }

  // Lấy dữ liệu từ form
  const movieData = {
    AnhPhim: movieImage.value.trim(),

    TenPhim: movieName.value.trim(),

    DaoDien: movieDirector.value.trim(),

    DienVien: movieActors.value.trim(),

    TheLoai: selectedGenres,

    KhoiChieu: releaseDate.value,

    ThoiLuong: Number(movieDuration.value),

    Ngonngu: movieLanguage.value.trim(),

    rated: movieRated.value,

    noidung: movieContent.value.trim(),

    Trailer: movieTrailer.value.trim(),
  };

  try {
    const response = await fetch("http://localhost:3000/api/phim", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(movieData),
    });

    const result = await response.json();

    // THÊM THÀNH CÔNG
    if (response.ok) {
      addMovieMessage.textContent = result.message;
      addMovieMessage.style.color = "green";

      addMovieForm.reset();

      setTimeout(function () {
        window.location.href = "./amintrangchu.html";
      }, 1000);
    }

    // THÊM THẤT BẠI
    else {
      addMovieMessage.textContent = result.message || "Thêm phim thất bại!";

      addMovieMessage.style.color = "red";
    }
  } catch (error) {
    console.error("Lỗi thêm phim:", error);

    addMovieMessage.textContent = "Không thể kết nối đến Backend!";

    addMovieMessage.style.color = "red";
  }
});
