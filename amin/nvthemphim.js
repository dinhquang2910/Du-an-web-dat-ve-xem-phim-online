const addMovieForm = document.getElementById("addMovieForm");

const movieName = document.getElementById("movieName");
const movieDirector = document.getElementById("movieDirector");
const movieActors = document.getElementById("movieActors");
const movieGenre1 = document.getElementById("movieGenre1");
const movieGenre2 = document.getElementById("movieGenre2");
const movieGenre3 = document.getElementById("movieGenre3");
const movieGenre4 = document.getElementById("movieGenre4");
const releaseDate = document.getElementById("releaseDate");
const movieDuration = document.getElementById("movieDuration");
const movieLanguage = document.getElementById("movieLanguage");
const movieRated = document.getElementById("movieRated");
const movieContent = document.getElementById("movieContent");
const movieImage = document.getElementById("movieImage");
const movieTrailer = document.getElementById("movieTrailer");

const addMovieMessage = document.getElementById("addMovieMessage");

addMovieForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const movieData = {
    AnhPhim: movieImage.value.trim(),

    TenPhim: movieName.value.trim(),

    DaoDien: movieDirector.value.trim(),

    DienVien: movieActors.value.trim(),

    TheLoai: [
      movieGenre1.value.trim(),
      movieGenre2.value.trim(),
      movieGenre3.value.trim(),
      movieGenre4.value.trim(),
    ].filter(function (theLoai) {
      return theLoai !== "";
    }),

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

    if (response.ok) {
      addMovieMessage.textContent = result.message;

      addMovieMessage.style.color = "green";

      addMovieForm.reset();

      setTimeout(function () {
        window.location.href = "./nvtrangchu.html";
      }, 1000);
    } else {
      addMovieMessage.textContent = result.message || "Thêm phim thất bại!";

      addMovieMessage.style.color = "red";
    }
  } catch (error) {
    console.error(error);

    addMovieMessage.textContent = "Không thể kết nối đến Backend!";

    addMovieMessage.style.color = "red";
  }
});
