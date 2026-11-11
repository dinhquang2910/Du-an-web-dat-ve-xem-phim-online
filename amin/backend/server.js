const express = require("express");
const cors = require("cors");
const session = require("express-session");
const { sql, poolPromise } = require("./db");

const app = express();

//định dạng tiền
const dinhDangTien = (value) => {
  if (value === null || value === undefined) {
    return "Chưa có thông tin";
  }

  return Number(value).toLocaleString("vi-VN") + "đ";
};
//đọc file

const mammoth = require("mammoth");
const path = require("path");

let dieuKhoanContext = "";

async function docDieuKhoan() {
  try {
    const filePath = path.join(__dirname, "DieuKhoan.docx");

    const result = await mammoth.extractRawText({
      path: filePath,
    });

    dieuKhoanContext = result.value.trim();

    console.log("Đã đọc điều khoản website thành công!");
  } catch (error) {
    console.error("Lỗi đọc file điều khoản:", error);
  }
}
docDieuKhoan();

function kiemTraHangGhe(hangGhe) {
  if (!Array.isArray(hangGhe) || hangGhe.length === 0) {
    return "Phòng chiếu phải có ít nhất một hàng ghế!";
  }

  const cacTenHang = new Set();

  for (const hang of hangGhe) {
    const { tenHang, loaiGhe, soLuongGhe } = hang;

    // Kiểm tra tên hàng
    if (typeof tenHang !== "string" || !/^[A-Z]+$/i.test(tenHang.trim())) {
      return "Tên hàng ghế không hợp lệ!";
    }

    const tenHangChuan = tenHang.trim().toUpperCase();

    if (cacTenHang.has(tenHangChuan)) {
      return `Hàng ghế ${tenHangChuan} bị trùng!`;
    }

    cacTenHang.add(tenHangChuan);

    // Kiểm tra loại ghế
    if (!["Thường", "VIP", "Đôi"].includes(loaiGhe)) {
      return `Loại ghế của hàng ${tenHangChuan} không hợp lệ!`;
    }

    // Kiểm tra số lượng ghế
    const soLuong = Number(soLuongGhe);

    if (!Number.isInteger(soLuong) || soLuong <= 0) {
      return `Số lượng ghế hàng ${tenHangChuan} phải là số nguyên dương!`;
    }

    // Hàng thường và VIP phải chia hết cho 11
    if ((loaiGhe === "Thường" || loaiGhe === "VIP") && soLuong % 11 !== 0) {
      return `Hàng ${tenHangChuan} loại ${loaiGhe} phải có số ghế chia hết cho 11!`;
    }

    // Hàng đôi phải chia hết cho 6
    if (loaiGhe === "Đôi" && soLuong % 6 !== 0) {
      return `Hàng ${tenHangChuan} loại Đôi phải có số ghế chia hết cho 6!`;
    }
  }

  return null;
}

let ai;

async function getGeminiAI() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Chưa cấu hình GEMINI_API_KEY trong file .env");
  }

  if (!ai) {
    const { GoogleGenAI } = await import("@google/genai");

    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
  }

  return ai;
}
const PORT = 3000;
require("dotenv").config();
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.use(express.json());

app.use(
  session({
    secret: "web-dat-ve-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24,
    },
  }),
);

app.get("/", (req, res) => {
  res.send("Backend đang chạy!");
});

app.get("/test-db", async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query("SELECT GETDATE() AS ThoiGian");

    res.json({
      message: "Kết nối SQL Server thành công!",
      data: result.recordset,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Kết nối SQL Server thất bại!",
      error: error.message,
    });
  }
});

app.post("/api/phim", async (req, res) => {
  let transaction;

  try {
    const {
      AnhPhim,
      TenPhim,
      DaoDien,
      DienVien,
      TheLoai,
      KhoiChieu,
      ThoiLuong,
      Ngonngu,
      rated,
      noidung,
      Trailer,
    } = req.body;

    // kiểm tra dữ liệu

    if (
      !AnhPhim ||
      !TenPhim ||
      !DaoDien ||
      !DienVien ||
      !Array.isArray(TheLoai) ||
      TheLoai.length < 1 ||
      TheLoai.length > 4 ||
      !KhoiChieu ||
      !ThoiLuong ||
      !Ngonngu ||
      !rated ||
      !noidung ||
      !Trailer
    ) {
      return res.status(400).json({
        message: "Vui lòng nhập đầy đủ thông tin!",
      });
    }

    // Chuyển mã thể loại thành số
    const danhSachMaTheLoai = TheLoai.map(Number);

    // Kiểm tra mã thể loại hợp lệ
    if (danhSachMaTheLoai.some((ma) => !Number.isInteger(ma) || ma <= 0)) {
      return res.status(400).json({
        message: "Mã thể loại không hợp lệ!",
      });
    }

    // Không cho chọn trùng thể loại
    const danhSachKhongTrung = [...new Set(danhSachMaTheLoai)];

    if (danhSachKhongTrung.length !== danhSachMaTheLoai.length) {
      return res.status(400).json({
        message: "Không được chọn trùng thể loại!",
      });
    }

    const pool = await poolPromise;

    transaction = new sql.Transaction(pool);

    await transaction.begin();

    // kiểm tra tên phim

    const checkMovie = await transaction
      .request()
      .input("TenPhim", sql.NVarChar(255), TenPhim.trim()).query(`
        SELECT TenPhim
        FROM Phim
        WHERE TenPhim = @TenPhim
      `);

    if (checkMovie.recordset.length > 0) {
      await transaction.rollback();

      return res.status(400).json({
        message: "Tên phim đã tồn tại!",
      });
    }

    // kiểm tra mã thể loại

    for (const maTheLoai of danhSachMaTheLoai) {
      const result = await transaction
        .request()
        .input("MaTheLoai", sql.Int, maTheLoai).query(`
          SELECT MaTheLoai
          FROM TheLoai
          WHERE MaTheLoai = @MaTheLoai
        `);

      if (result.recordset.length === 0) {
        await transaction.rollback();

        return res.status(400).json({
          message: `Mã thể loại ${maTheLoai} không tồn tại!`,
        });
      }
    }

    //thêm phim

    await transaction
      .request()
      .input("AnhPhim", sql.NVarChar(500), AnhPhim.trim())
      .input("TenPhim", sql.NVarChar(255), TenPhim.trim())
      .input("DaoDien", sql.NVarChar(255), DaoDien.trim())
      .input("DienVien", sql.NVarChar(500), DienVien.trim())
      .input("KhoiChieu", sql.Date, KhoiChieu)
      .input("ThoiLuong", sql.Int, Number(ThoiLuong))
      .input("Ngonngu", sql.NVarChar(50), Ngonngu.trim())
      .input("rated", sql.NVarChar(50), rated)
      .input("noidung", sql.NVarChar(sql.MAX), noidung.trim())
      .input("Trailer", sql.NVarChar(500), Trailer.trim()).query(`
        INSERT INTO Phim
        (
          AnhPhim,
          TenPhim,
          DaoDien,
          DienVien,
          KhoiChieu,
          ThoiLuong,
          Ngonngu,
          rated,
          noidung,
          Trailer
        )
        VALUES
        (
          @AnhPhim,
          @TenPhim,
          @DaoDien,
          @DienVien,
          @KhoiChieu,
          @ThoiLuong,
          @Ngonngu,
          @rated,
          @noidung,
          @Trailer
        )
      `);

    for (const maTheLoai of danhSachMaTheLoai) {
      await transaction
        .request()
        .input("TenPhim", sql.NVarChar(255), TenPhim.trim())
        .input("MaTheLoai", sql.Int, maTheLoai).query(`
          INSERT INTO Phim_TheLoai
          (
            TenPhim,
            MaTheLoai
          )
          VALUES
          (
            @TenPhim,
            @MaTheLoai
          )
        `);
    }

    await transaction.commit();

    res.status(201).json({
      message: "Thêm phim thành công!",
    });
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error("Lỗi rollback:", rollbackError);
      }
    }

    console.error("LỖI THÊM PHIM:", error);

    res.status(500).json({
      message: "Thêm phim thất bại!",
      error: error.message,
    });
  }
});

app.get("/api/phim", async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT
        p.AnhPhim,
        p.TenPhim,
        p.DaoDien,
        p.DienVien,

        STRING_AGG(tl.TenTheLoai, N', ')
          AS TheLoai,

        p.KhoiChieu,
        p.ThoiLuong,
        p.Ngonngu,
        p.rated,
        p.noidung,
        p.Trailer,
        p.TrangThai

      FROM Phim p

      LEFT JOIN Phim_TheLoai ptl
        ON p.TenPhim = ptl.TenPhim

      LEFT JOIN TheLoai tl
        ON ptl.MaTheLoai = tl.MaTheLoai

      GROUP BY
        p.AnhPhim,
        p.TenPhim,
        p.DaoDien,
        p.DienVien,
        p.KhoiChieu,
        p.ThoiLuong,
        p.Ngonngu,
        p.rated,
        p.noidung,
        p.Trailer,
        p.TrangThai

      ORDER BY p.TenPhim
    `);

    res.json(result.recordset);
  } catch (error) {
    console.error("LỖI LẤY DANH SÁCH PHIM:", error);

    res.status(500).json({
      message: "Không thể lấy danh sách phim!",
      error: error.message,
    });
  }
});

app.delete("/api/phim/:tenPhim", async (req, res) => {
  let transaction;

  try {
    const tenPhim = req.params.tenPhim;

    if (!tenPhim) {
      return res.status(400).json({
        message: "Tên phim không hợp lệ!",
      });
    }

    const pool = await poolPromise;

    transaction = new sql.Transaction(pool);

    await transaction.begin();

    // kiểm tra phim có tồn tại hay không

    const checkPhim = await new sql.Request(transaction).input(
      "TenPhim",
      sql.NVarChar(255),
      tenPhim,
    ).query(`
        SELECT TenPhim
        FROM Phim
        WHERE TenPhim = @TenPhim
      `);

    if (checkPhim.recordset.length === 0) {
      await transaction.rollback();

      return res.status(404).json({
        message: "Không tìm thấy phim!",
      });
    }

    //kiểm tra phim đã có vé đặt chưa

    const checkVe = await new sql.Request(transaction).input(
      "TenPhim",
      sql.NVarChar(255),
      tenPhim,
    ).query(`
        SELECT TOP 1
          dv.MaDatVe
        FROM DatVe dv
        INNER JOIN SuatChieu sc
          ON dv.MaSuatChieu = sc.MaSuatChieu
        WHERE sc.TenPhim = @TenPhim
      `);

    if (checkVe.recordset.length > 0) {
      await transaction.rollback();

      return res.status(409).json({
        message: "Không thể xóa phim vì phim đã có người đặt vé!",
      });
    }

    await new sql.Request(transaction).input(
      "TenPhim",
      sql.NVarChar(255),
      tenPhim,
    ).query(`
        DELETE FROM SuatChieu
        WHERE TenPhim = @TenPhim
      `);

    await new sql.Request(transaction).input(
      "TenPhim",
      sql.NVarChar(255),
      tenPhim,
    ).query(`
        DELETE FROM Phim_TheLoai
        WHERE TenPhim = @TenPhim
      `);

    const result = await new sql.Request(transaction).input(
      "TenPhim",
      sql.NVarChar(255),
      tenPhim,
    ).query(`
        DELETE FROM Phim
        WHERE TenPhim = @TenPhim
      `);

    await transaction.commit();

    res.json({
      success: true,
      message: `Đã xóa phim "${tenPhim}" thành công!`,
    });
  } catch (error) {
    console.error("LỖI XÓA PHIM:", error);

    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error("LỖI ROLLBACK:", rollbackError);
      }
    }

    res.status(500).json({
      success: false,
      message: "Không thể xóa phim!",
      error: error.message,
    });
  }
});

app.get("/api/vemyt/:maTaiKhoan", async (req, res) => {
  try {
    const maTaiKhoan = Number(req.params.maTaiKhoan);

    if (!Number.isInteger(maTaiKhoan) || maTaiKhoan <= 0) {
      return res.status(400).json({
        message: "Mã tài khoản không hợp lệ!",
      });
    }

    const pool = await poolPromise;

    const result = await pool.request().input("MaTaiKhoan", sql.Int, maTaiKhoan)
      .query(`
        SELECT
          dv.MaDatVe,
          tk.HoTen,
          p.TenPhim,
          pc.TenPhong,
          sc.NgayChieu,
          sc.GioChieu,
          ISNULL(dsDichVu.DichVu, N'Không có dịch vụ') AS DichVu,
          dv.TongTien,
          dv.PhuongThucThanhToan,
          dv.TrangThai,
          dv.NgayDat,
          dsGhe.Ghe

        FROM DatVe dv

        INNER JOIN TaiKhoan tk
          ON dv.MaTaiKhoan = tk.MaTaiKhoan

        INNER JOIN SuatChieu sc
          ON dv.MaSuatChieu = sc.MaSuatChieu

        INNER JOIN Phim p
          ON sc.TenPhim = p.TenPhim

        INNER JOIN PhongChieu pc
          ON sc.MaPhong = pc.MaPhong

        OUTER APPLY (
          SELECT STRING_AGG(g.SoGhe, ', ') AS Ghe
          FROM ChiTietDatVe ctdv
          INNER JOIN Ghe g
            ON ctdv.MaGhe = g.MaGhe
          WHERE ctdv.MaDatVe = dv.MaDatVe
        ) dsGhe

        OUTER APPLY (
          SELECT STRING_AGG(
            CONCAT(dvu.TenDichVu, N' × ', ctdvu.SoLuong),
            N', '
          ) AS DichVu
          FROM ChiTietDichVu ctdvu
          INNER JOIN DichVu dvu
            ON ctdvu.MaDichVu = dvu.MaDichVu
          WHERE ctdvu.MaDatVe = dv.MaDatVe
        ) dsDichVu

        WHERE dv.MaTaiKhoan = @MaTaiKhoan

        ORDER BY dv.NgayDat DESC
      `);

    console.log("VÉ CỦA TÀI KHOẢN:", result.recordset);

    res.json(result.recordset);
  } catch (error) {
    console.error("LỖI LẤY VÉ:", error);

    res.status(500).json({
      message: "Không thể lấy vé",
      error: error.message,
    });
  }
});

//chat bot

app.post("/api/ai/chat", async (req, res) => {
  const batDau = Date.now();
  let timeoutId;

  // Định dạng ngày tháng
  const dinhDangNgay = (value) => {
    if (!value) return "Chưa có thông tin";

    const date = new Date(value);

    if (isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleDateString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
    });
  };

  // Định dạng giờ chiếu
  const dinhDangGio = (value) => {
    if (!value) return "Chưa có thông tin";

    if (typeof value === "string") {
      return value.substring(0, 5);
    }

    const date = new Date(value);

    if (isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleTimeString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  try {
    console.log("\n CHATBOT ");

    const { message } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập câu hỏi!",
      });
    }

    if (message.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Câu hỏi không được vượt quá 1000 ký tự!",
      });
    }

    //trả lời cố định

    const cauHoiCoDinh = [
      {
        keywords: ["đặt vé như thế nào", "cách đặt vé", "hướng dẫn đặt vé"],
        answer:
          "Dạ, bạn có thể đặt vé bằng cách chọn phim, chọn suất chiếu, chọn ghế ngồi, chọn dịch vụ nếu muốn, sau đó tiến hành thanh toán ạ.",
      },
      {
        keywords: [
          "website có những gì",
          "chức năng website",
          "website hỗ trợ gì",
        ],
        answer:
          "Dạ, website của mình sinh ra với mục đích giúp người dùng xem thông tin chi tiết từng phim và đặt vé dễ dàng hơn ạ.",
      },
      {
        keywords: ["xin chào", "chào bạn", "hello"],
        answer:
          "Dạ, xin chào bạn! Mình là trợ lý AI của rạp phim. Bạn cần mình hỗ trợ gì ạ?",
      },
      {
        keywords: ["tạo ra bạn", "phát triển bạn"],
        answer:
          "Dạ, mình được tạo ra bởi Đinh Hồng Quang trong một dự án cá nhân",
      },
      {
        keywords: [
          "có bao nhiều phương thức thanh toán",
          "lựa chọn thanh toán",
        ],
        answer:
          "Dạ, Website hiện hỗ trợ 2 phương thức thanh toán: Thanh toán trực tuyến và Thanh toán tại quầy khi đến rạp ạ.",
      },
      {
        keywords: ["cảm ơn", "thanks", "thank you"],
        answer: "Dạ, rất vui được hỗ trợ bạn! Chúc bạn xem phim vui vẻ ạ 🍿",
      },
    ];

    const tinNhan = message.trim().toLowerCase();

    const cauTraLoiCoDinh = cauHoiCoDinh.find((item) =>
      item.keywords.some((keyword) => tinNhan.includes(keyword)),
    );

    if (cauTraLoiCoDinh) {
      return res.json({
        success: true,
        reply: cauTraLoiCoDinh.answer,
      });
    }
    const pool = await poolPromise;

    console.log("1. Đang tìm thông tin phim...");

    const result = await pool
      .request()
      .input("message", sql.NVarChar(1000), message.trim()).query(`
        SELECT
          p.TenPhim,
          p.DaoDien,
          p.DienVien,
          p.KhoiChieu,
          p.ThoiLuong,
          p.Ngonngu,
          p.rated,
          STRING_AGG(tl.TenTheLoai, N', ') AS TheLoai
        FROM Phim p
        LEFT JOIN Phim_TheLoai pt
          ON p.TenPhim = pt.TenPhim
        LEFT JOIN TheLoai tl
          ON pt.MaTheLoai = tl.MaTheLoai
        WHERE
    @message LIKE N'%' + p.TenPhim + N'%'
    OR
    @message LIKE N'%' + tl.TenTheLoai + N'%'
        GROUP BY
          p.TenPhim,
          p.DaoDien,
          p.DienVien,
          p.KhoiChieu,
          p.ThoiLuong,
          p.Ngonngu,
          p.rated
      `);

    console.log("2. Số phim tìm được:", result.recordset.length);

    let movieContext = "";
    let scheduleContext = "";

    if (result.recordset.length > 0) {
      movieContext = result.recordset
        .map(
          (phim, index) => `
PHIM ${index + 1}:
- Tên phim: ${phim.TenPhim}
- Đạo diễn: ${phim.DaoDien || "Chưa có thông tin"}
- Diễn viên: ${phim.DienVien || "Chưa có thông tin"}
- Thể loại: ${phim.TheLoai || "Chưa có thông tin"}
- Khởi chiếu: ${dinhDangNgay(phim.KhoiChieu)}
- Thời lượng: ${phim.ThoiLuong || "Chưa có thông tin"} phút
- Ngôn ngữ: ${phim.Ngonngu || "Chưa có thông tin"}
- Phân loại: ${phim.rated || "Chưa có thông tin"}
        `,
        )
        .join("\n");

      // tra cứu suất chiếu

      console.log("3. Đang tra cứu suất chiếu...");

      const requestSuatChieu = pool.request();

      // Tạo tham số tên phim
      const tenPhimParams = result.recordset.map((phim, index) => {
        const paramName = `tenPhim${index}`;

        requestSuatChieu.input(paramName, sql.NVarChar(255), phim.TenPhim);

        return `@${paramName}`;
      });

      const resultSuatChieu = await requestSuatChieu.query(`
  SELECT
    sc.MaSuatChieu,
    sc.TenPhim,
    sc.NgayChieu,
    CONVERT(VARCHAR(8), sc.GioChieu, 108) AS GioChieu,
    pc.TenPhong,

    COUNT(g.MaGhe) AS TongSoGhe,

    SUM(
      CASE WHEN cd.MaGhe IS NOT NULL THEN 1 ELSE 0 END
    ) AS SoGheDaDat,

    SUM(
      CASE
        WHEN g.MaGhe IS NOT NULL AND cd.MaGhe IS NULL THEN 1
        ELSE 0
      END
    ) AS SoGheTrong,

    SUM(
      CASE
        WHEN g.LoaiGhe = N'Thường' AND cd.MaGhe IS NULL THEN 1
        ELSE 0
      END
    ) AS GheThuongTrong,

    SUM(
      CASE
        WHEN g.LoaiGhe = N'VIP' AND cd.MaGhe IS NULL THEN 1
        ELSE 0
      END
    ) AS GheVIPTrong,

    SUM(
      CASE
        WHEN g.LoaiGhe = N'Đôi' AND cd.MaGhe IS NULL THEN 1
        ELSE 0
      END
    ) AS GheDoiTrong,

    SUM(
      CASE WHEN g.LoaiGhe = N'Thường' THEN 1 ELSE 0 END
    ) AS TongGheThuong,

    SUM(
      CASE WHEN g.LoaiGhe = N'VIP' THEN 1 ELSE 0 END
    ) AS TongGheVIP,

    SUM(
      CASE WHEN g.LoaiGhe = N'Đôi' THEN 1 ELSE 0 END
    ) AS TongGheDoi,

    MIN(CASE WHEN g.LoaiGhe = N'Thường' THEN gg.Gia END) AS GiaGheThuong,

    MIN(CASE WHEN g.LoaiGhe = N'VIP' THEN gg.Gia END) AS GiaGheVIP,

    MIN(CASE WHEN g.LoaiGhe = N'Đôi' THEN gg.Gia END) AS GiaGheDoi

  FROM SuatChieu sc

  INNER JOIN PhongChieu pc
    ON sc.MaPhong = pc.MaPhong

  LEFT JOIN Ghe g
    ON g.MaPhong = sc.MaPhong

  LEFT JOIN GiaGhe gg
    ON gg.LoaiGhe = g.LoaiGhe

  LEFT JOIN ChiTietDatVe cd
    ON cd.MaSuatChieu = sc.MaSuatChieu
    AND cd.MaGhe = g.MaGhe

  WHERE
    sc.TenPhim IN (${tenPhimParams.join(", ")})
    AND (
      sc.NgayChieu > CAST(GETDATE() AS DATE)
      OR (
        sc.NgayChieu = CAST(GETDATE() AS DATE)
        AND sc.GioChieu >= CAST(GETDATE() AS TIME)
      )
    )

  GROUP BY
    sc.MaSuatChieu,
    sc.TenPhim,
    sc.NgayChieu,
    sc.GioChieu,
    pc.TenPhong

  ORDER BY
    sc.NgayChieu ASC,
    sc.GioChieu ASC
`);

      console.log(
        "4. Số suất chiếu tìm được:",
        resultSuatChieu.recordset.length,
      );

      if (resultSuatChieu.recordset.length > 0) {
        scheduleContext = resultSuatChieu.recordset
          .map(
            (suat, index) => `
SUẤT CHIẾU ${index + 1}:

- Mã suất chiếu: ${suat.MaSuatChieu}
- Phim: ${suat.TenPhim}
- Ngày chiếu: ${dinhDangNgay(suat.NgayChieu)}
- Giờ chiếu: ${dinhDangGio(suat.GioChieu)}
- Phòng chiếu: ${suat.TenPhong}

THÔNG TIN GHẾ:

- Tổng số ghế: ${suat.TongSoGhe}
- Số ghế đã đặt: ${suat.SoGheDaDat}
- Số ghế còn trống: ${suat.SoGheTrong}

PHÂN LOẠI GHẾ CÒN TRỐNG:

- Ghế thường: ${suat.GheThuongTrong}
- Ghế VIP: ${suat.GheVIPTrong}
- Ghế đôi: ${suat.GheDoiTrong}

TỔNG SỐ GHẾ THEO LOẠI:

- Ghế thường: ${suat.TongGheThuong}
- Ghế VIP: ${suat.TongGheVIP}
- Ghế đôi: ${suat.TongGheDoi}

GIÁ TỪNG LOẠI GHẾ:

- Ghế thường: ${dinhDangTien(suat.GiaGheThuong)}
- Ghế VIP: ${dinhDangTien(suat.GiaGheVIP)}
- Ghế đôi: ${dinhDangTien(suat.GiaGheDoi)}
    `,
          )
          .join("\n");
      } else {
        scheduleContext =
          "Không tìm thấy suất chiếu sắp tới nào của những phim trên trong cơ sở dữ liệu.";
      }
    } else {
      movieContext =
        "Không tìm thấy phim nào khớp với tên phim được nhắc đến trong câu hỏi.";

      scheduleContext =
        "Chưa thể tra cứu suất chiếu vì chưa xác định được phim.";
    }

    // gửi dữ liệu cho chat bot

    console.log("5. Đang gửi dữ liệu cho Gemini...");

    const gemini = await getGeminiAI();

    const yeuCauGemini = gemini.models.generateContent({
      model: "gemini-3.5-flash-lite",

      contents: message.trim(),

      config: {
        systemInstruction: `
Bạn là trợ lý AI của website đặt vé xem phim.

NHIỆM VỤ:
- Hỗ trợ người dùng tìm hiểu thông tin phim.
- Tra cứu lịch chiếu và suất chiếu.
- Hỗ trợ người dùng tìm hiểu quy trình đặt vé.
- Giải đáp câu hỏi về tài khoản và dịch vụ của rạp.
- Trả lời bằng tiếng Việt, thân thiện, dễ hiểu.

DỮ LIỆU PHIM TỪ SQL SERVER:
${movieContext}

DỮ LIỆU SUẤT CHIẾU TỪ SQL SERVER:
${scheduleContext}

QUY TẮC BẮT BUỘC:
1. Ưu tiên sử dụng dữ liệu SQL Server được cung cấp.
2. Khi người dùng hỏi lịch chiếu, phải sử dụng mục DỮ LIỆU SUẤT CHIẾU.
3. Nếu có suất chiếu, hãy liệt kê ngày chiếu, giờ chiếu và phòng chiếu.
4. Không được nhầm ngày khởi chiếu của phim với ngày có suất chiếu.
5. Không tự bịa tên phim, suất chiếu, giờ chiếu, phòng chiếu hoặc giá vé.
6. Nếu không có suất chiếu trong dữ liệu, hãy nói rõ hiện chưa tìm thấy suất chiếu sắp tới.
7. Nếu không tìm thấy phim, hãy thông báo chưa tìm thấy phim phù hợp trong hệ thống.
8. Nếu người dùng hỏi về vấn đề chung của website, hãy hỗ trợ trong phạm vi chức năng đặt vé xem phim.
9. Trả lời ngắn gọn, tự nhiên, dễ hiểu.


QUY TẮC TRA CỨU GHẾ:

10. Khi người dùng hỏi số lượng ghế còn trống, phải sử dụng dữ liệu ghế trong SQL Server.
11. Phải phân biệt rõ ghế thường, ghế VIP và ghế đôi.
12. Nếu người dùng hỏi tổng số ghế trống, hãy sử dụng trường SoGheTrong.
13. Nếu người dùng hỏi ghế thường, hãy sử dụng trường GheThuongTrong.
14. Nếu người dùng hỏi ghế VIP, hãy sử dụng trường GheVIPTrong.
15. Nếu người dùng hỏi ghế đôi, hãy sử dụng trường GheDoiTrong.
16. Không được tự tính hoặc suy đoán số ghế nếu dữ liệu SQL Server không có.
17. Nếu không tìm thấy suất chiếu phù hợp, hãy yêu cầu người dùng cung cấp tên phim hoặc thông tin suất chiếu cụ thể.
18. Phải phân biệt số ghế còn trống với tổng số ghế của phòng.
19. Khi trả lời, cần nêu rõ tên phim, ngày chiếu, giờ chiếu và phòng chiếu để tránh nhầm lẫn giữa các suất.


ĐIỀU KHOẢN VÀ CHÍNH SÁCH WEBSITE:

${dieuKhoanContext}

QUY TẮC TRẢ LỜI VỀ ĐIỀU KHOẢN:

20. Khi người dùng hỏi về điều khoản, chính sách, đổi vé,
hủy vé, thanh toán hoặc bảo mật, hãy sử dụng nội dung
điều khoản được cung cấp.

21. Không tự tạo ra quy định không có trong tài liệu.

22. Nếu tài liệu không đề cập đến vấn đề người dùng hỏi,
hãy thông báo chưa có thông tin chính thức.

23. Trả lời đúng nội dung và không tự ý thay đổi ý nghĩa
của các điều khoản.

QUY TẮC TRA CỨU GIÁ VÉ:

20. Khi người dùng hỏi giá vé, phải sử dụng dữ liệu giá ghế từ SQL Server.

21. Phải phân biệt giá ghế thường, ghế VIP và ghế đôi.

22. Nếu người dùng hỏi giá ghế thường, sử dụng trường GiaGheThuong.

23. Nếu người dùng hỏi giá ghế VIP, sử dụng trường GiaGheVIP.

24. Nếu người dùng hỏi giá ghế đôi, sử dụng trường GiaGheDoi.

25. Không tự suy đoán hoặc bịa giá vé.

26. Nếu người dùng hỏi giá vé của một suất chiếu cụ thể,
phải xác định đúng tên phim, ngày chiếu, giờ chiếu và phòng chiếu.

27. Nếu dữ liệu không có giá của loại ghế được hỏi,
hãy thông báo chưa có thông tin giá chính thức.


QUY TẮC TÌM KIẾM PHIM THEO THỂ LOẠI:

28. Khi người dùng hỏi tìm phim theo thể loại,
phải sử dụng dữ liệu phim từ SQL Server.

29. Các thể loại phim phải được xác định từ trường TheLoai.

30. Nếu người dùng hỏi phim kinh dị, hãy liệt kê
những phim có thể loại Kinh dị.

31. Nếu người dùng hỏi phim hành động, hãy liệt kê
những phim có thể loại Hành động.

32. Nếu người dùng hỏi phim tình cảm, hãy liệt kê
những phim có thể loại Tình cảm.

33. Chỉ được giới thiệu những phim thực sự tồn tại
trong dữ liệu SQL Server.

34. Nếu tìm thấy nhiều phim cùng thể loại,
hãy liệt kê tên phim và thông tin cơ bản của từng phim.

35. Nếu không tìm thấy phim thuộc thể loại được hỏi,
hãy thông báo hiện chưa có phim phù hợp trong hệ thống.

36. Không tự bịa tên phim hoặc thể loại phim.
        `,
      },
    });

    const hetThoiGian = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error("Gemini phản hồi quá 60 giây."));
      }, 60000);
    });

    const response = await Promise.race([yeuCauGemini, hetThoiGian]);

    console.log("6. Gemini đã phản hồi!");
    console.log("Tổng thời gian:", Date.now() - batDau, "ms");

    return res.json({
      success: true,
      reply: response.text || "Mình chưa tạo được câu trả lời.",
    });
  } catch (error) {
    console.error("LỖI CHATBOT:", error);
    console.error("Thời gian:", Date.now() - batDau, "ms");

    return res.status(500).json({
      success: false,
      message: error.message || "Chatbot đang gặp sự cố.",
    });
  } finally {
    clearTimeout(timeoutId);
  }
});

app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});

app.post("/api/dangky", async (req, res) => {
  try {
    const { HoTen, SoDienThoai, MatKhau } = req.body;

    // Kiểm tra dữ liệu
    if (!HoTen || !SoDienThoai || !MatKhau) {
      return res.status(400).json({
        message: "Vui lòng nhập đầy đủ thông tin!",
      });
    }

    const pool = await poolPromise;

    // Kiểm tra số điện thoại đã tồn tại
    const checkAccount = await pool
      .request()
      .input("SoDienThoai", sql.NVarChar(20), SoDienThoai).query(`
                SELECT *
                FROM TaiKhoan
                WHERE SoDienThoai = @SoDienThoai
            `);

    if (checkAccount.recordset.length > 0) {
      return res.status(400).json({
        message: "Số điện thoại đã tồn tại!",
      });
    }

    // Thêm tài khoản
    await pool
      .request()
      .input("HoTen", sql.NVarChar(100), HoTen)
      .input("SoDienThoai", sql.NVarChar(20), SoDienThoai)
      .input("MatKhau", sql.NVarChar(255), MatKhau).query(`
                INSERT INTO TaiKhoan
                (
                    HoTen,
                    SoDienThoai,
                    MatKhau
                )
                VALUES
                (
                    @HoTen,
                    @SoDienThoai,
                    @MatKhau
                )
            `);

    res.json({
      message: "Đăng ký thành công!",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Đăng ký thất bại!",
      error: error.message,
    });
  }
});

app.post("/api/dangnhap", async (req, res) => {
  try {
    const { SoDienThoai, MatKhau } = req.body;

    if (!SoDienThoai || !MatKhau) {
      return res.status(400).json({
        message: "Vui lòng nhập số điện thoại và mật khẩu!",
      });
    }

    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("SoDienThoai", sql.NVarChar(20), SoDienThoai)
      .input("MatKhau", sql.NVarChar(255), MatKhau).query(`
        SELECT
          MaTaiKhoan,
          HoTen,
          SoDienThoai,
          VaiTro,
          TrangThai
        FROM TaiKhoan
        WHERE SoDienThoai = @SoDienThoai
        AND MatKhau = @MatKhau
      `);

    if (result.recordset.length === 0) {
      return res.status(401).json({
        message: "Số điện thoại hoặc mật khẩu không đúng!",
      });
    }

    const user = result.recordset[0];

    if (user.TrangThai !== "Hoạt động") {
      return res.status(403).json({
        message: "Tài khoản đã bị khóa!",
      });
    }

    req.session.maTaiKhoan = user.MaTaiKhoan;
    req.session.hoTen = user.HoTen;
    req.session.vaiTro = user.VaiTro;

    // Chờ session lưu xong rồi mới trả
    req.session.save((err) => {
      if (err) {
        console.error("Lỗi lưu session:", err);

        return res.status(500).json({
          message: "Không thể lưu phiên đăng nhập!",
        });
      }

      console.log("SESSION SAU KHI ĐĂNG NHẬP:", req.session);

      return res.json({
        message: "Đăng nhập thành công!",
        user: user,
      });
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Đăng nhập thất bại!",
      error: error.message,
    });
  }
});

// test
app.get("/api/taikhoan", async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
                SELECT
                    MaTaiKhoan,
                    HoTen,
                    SoDienThoai,
                    VaiTro,
                    NgayTao,
                    TrangThai
                FROM TaiKhoan
                ORDER BY MaTaiKhoan ASC
            `);

    res.json(result.recordset);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Không thể lấy danh sách tài khoản!",
      error: error.message,
    });
  }
});

app.put("/api/taikhoan/:id/trangthai", async (req, res) => {
  try {
    const maTaiKhoan = Number(req.params.id);

    if (isNaN(maTaiKhoan)) {
      return res.status(400).json({
        message: "Mã tài khoản không hợp lệ!",
      });
    }

    const pool = await poolPromise;

    // Tìm tài khoản
    const checkAccount = await pool
      .request()
      .input("MaTaiKhoan", sql.Int, maTaiKhoan).query(`
        SELECT MaTaiKhoan, TrangThai
        FROM TaiKhoan
        WHERE MaTaiKhoan = @MaTaiKhoan
      `);

    if (checkAccount.recordset.length === 0) {
      return res.status(404).json({
        message: "Không tìm thấy tài khoản!",
      });
    }

    const trangThaiHienTai = checkAccount.recordset[0].TrangThai.trim();

    let trangThaiMoi;

    if (trangThaiHienTai === "Hoạt động") {
      trangThaiMoi = "Bị khóa";
    } else if (trangThaiHienTai === "Bị khóa") {
      trangThaiMoi = "Hoạt động";
    } else {
      return res.status(400).json({
        message: "Trạng thái tài khoản không hợp lệ!",
      });
    }

    // Cập nhật trạng thái
    await pool
      .request()
      .input("MaTaiKhoan", sql.Int, maTaiKhoan)
      .input("TrangThai", sql.NVarChar(50), trangThaiMoi).query(`
        UPDATE TaiKhoan
        SET TrangThai = @TrangThai
        WHERE MaTaiKhoan = @MaTaiKhoan
      `);

    res.json({
      message: "Cập nhật trạng thái thành công!",
      TrangThai: trangThaiMoi,
    });
  } catch (error) {
    console.error("LỖI KHÓA/MỞ KHÓA TÀI KHOẢN:", error);

    res.status(500).json({
      message: "Không thể cập nhật trạng thái tài khoản!",
      error: error.message,
    });
  }
});

app.put("/api/taikhoan/:id/vaitro", async (req, res) => {
  try {
    const maTaiKhoan = Number(req.params.id);
    const { VaiTro } = req.body;

    // Kiểm tra quyền có hợp lệ không
    const danhSachVaiTro = ["Quản lý", "Nhân viên", "Khách hàng"];

    if (!danhSachVaiTro.includes(VaiTro)) {
      return res.status(400).json({
        message: "Vai trò không hợp lệ!",
      });
    }

    const pool = await poolPromise;

    // Kiểm tra tài khoản có tồn tại không
    const checkAccount = await pool
      .request()
      .input("MaTaiKhoan", sql.Int, maTaiKhoan).query(`
        SELECT *
        FROM TaiKhoan
        WHERE MaTaiKhoan = @MaTaiKhoan
      `);

    if (checkAccount.recordset.length === 0) {
      return res.status(404).json({
        message: "Không tìm thấy tài khoản!",
      });
    }

    // Cập nhật quyền
    await pool
      .request()
      .input("MaTaiKhoan", sql.Int, maTaiKhoan)
      .input("VaiTro", sql.NVarChar(50), VaiTro).query(`
        UPDATE TaiKhoan
        SET VaiTro = @VaiTro
        WHERE MaTaiKhoan = @MaTaiKhoan
      `);

    res.json({
      message: "Đổi quyền thành công!",
      VaiTro: VaiTro,
    });
  } catch (error) {
    console.error("LỖI ĐỔI QUYỀN:", error);

    res.status(500).json({
      message: "Không thể đổi quyền tài khoản!",
      error: error.message,
    });
  }
});
//xóa
app.delete("/api/taikhoan/:id", async (req, res) => {
  try {
    const maTaiKhoan = Number(req.params.id);

    const pool = await poolPromise;

    const result = await pool.request().input("MaTaiKhoan", sql.Int, maTaiKhoan)
      .query(`
                DELETE FROM TaiKhoan
                WHERE MaTaiKhoan = @MaTaiKhoan
            `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        message: "Không tìm thấy tài khoản!",
      });
    }

    res.json({
      message: "Xóa tài khoản thành công!",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Xóa tài khoản thất bại!",
      error: error.message,
    });
  }
});

app.get("/api/phim", async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT
        AnhPhim,
        TenPhim,
        DaoDien,
        DienVien,
        TheLoai,
        KhoiChieu,
        ThoiLuong,
        Ngonngu,
        rated,
        noidung
      FROM Phim
      ORDER BY KhoiChieu DESC
    `);

    res.json(result.recordset);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Không thể lấy danh sách phim!",
      error: error.message,
    });
  }
});

app.get("/api/suatchieu/:tenPhim", async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("TenPhim", sql.NVarChar(255), req.params.tenPhim).query(`
        SELECT
          sc.MaSuatChieu,
          sc.TenPhim,
          sc.MaPhong,
          pc.TenPhong,
          sc.NgayChieu,
          sc.GioChieu
        FROM SuatChieu sc
        INNER JOIN PhongChieu pc
          ON sc.MaPhong = pc.MaPhong
        WHERE sc.TenPhim = @TenPhim
        ORDER BY sc.NgayChieu, sc.GioChieu
      `);

    const danhSachSuat = result.recordset.map((suat) => {
      let gioChieu = suat.GioChieu;

      if (gioChieu instanceof Date) {
        gioChieu =
          String(gioChieu.getUTCHours()).padStart(2, "0") +
          ":" +
          String(gioChieu.getUTCMinutes()).padStart(2, "0");
      } else if (typeof gioChieu === "string") {
        gioChieu = gioChieu.substring(0, 5);
      }

      return {
        MaSuatChieu: suat.MaSuatChieu,
        TenPhim: suat.TenPhim,
        MaPhong: suat.MaPhong,
        TenPhong: suat.TenPhong,
        NgayChieu: suat.NgayChieu,
        GioChieu: gioChieu,
      };
    });

    res.json(danhSachSuat);
  } catch (error) {
    console.error("LỖI LẤY SUẤT CHIẾU:", error);

    res.status(500).json({
      message: "Không thể lấy suất chiếu",
    });
  }
});

app.get("/api/ghe/:maSuatChieu", async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("MaSuatChieu", sql.Int, Number(req.params.maSuatChieu)).query(`
        SELECT
          g.MaGhe,
          g.MaPhong,
          g.MaHang,
          g.SoGhe,
          hg.TenHang,
          hg.LoaiGhe,
          gg.Gia
        FROM Ghe g
        INNER JOIN HangGhe hg
          ON g.MaHang = hg.MaHang
        INNER JOIN GiaGhe gg
          ON hg.LoaiGhe = gg.LoaiGhe
        INNER JOIN SuatChieu sc
          ON g.MaPhong = sc.MaPhong
        WHERE sc.MaSuatChieu = @MaSuatChieu
        ORDER BY
          hg.MaHang,
          TRY_CAST(
            SUBSTRING(g.SoGhe, LEN(hg.TenHang) + 1, LEN(g.SoGhe))
            AS INT
          )
      `);

    res.json(result.recordset);
  } catch (error) {
    console.error("LỖI LẤY GHẾ:", error);

    res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách ghế",
      error: error.message,
    });
  }
});

app.get("/api/ghe-dadat/:maSuatChieu", async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("MaSuatChieu", sql.Int, req.params.maSuatChieu).query(`
                SELECT
                    cd.MaGhe,
                    g.SoGhe
                FROM ChiTietDatVe cd
                INNER JOIN Ghe g
                    ON cd.MaGhe = g.MaGhe
                WHERE cd.MaSuatChieu = @MaSuatChieu
            `);

    res.json(result.recordset);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Không thể lấy ghế đã đặt",
    });
  }
});

app.get("/api/dichvu", async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
                SELECT *
                FROM DichVu
            `);

    res.json(result.recordset);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Không thể lấy dịch vụ",
    });
  }
});

app.get("/api/nuoc", async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
                SELECT *
                FROM Nuoc
            `);

    res.json(result.recordset);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Không thể lấy danh sách nước",
    });
  }
});

app.post("/api/datve", async (req, res) => {
  let transaction;

  try {
    const {
      maTaiKhoan,
      maSuatChieu,
      ghe,
      tongTien,
      phuongThucThanhToan,
      dichVu,
    } = req.body;

    //Kiểm tra dữ liệu đầu vào
    if (!maTaiKhoan) {
      return res.status(401).json({
        success: false,
        message: "Không xác định được tài khoản!",
      });
    }

    if (
      !Number.isInteger(Number(maSuatChieu)) ||
      !Array.isArray(ghe) ||
      ghe.length === 0 ||
      !ghe.every((id) => Number.isInteger(Number(id)) && Number(id) > 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Thông tin suất chiếu hoặc ghế không hợp lệ!",
      });
    }

    // Không cho phép gửi trùng một mã ghế
    const danhSachGhe = [...new Set(ghe.map(Number))];

    if (danhSachGhe.length !== ghe.length) {
      return res.status(400).json({
        success: false,
        message: "Danh sách ghế có mã bị trùng!",
      });
    }

    const pool = await poolPromise;
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    // Kiểm tra và lấy giá ghế từ database
    const requestGhe = new sql.Request(transaction);

    requestGhe.input("MaSuatChieu", sql.Int, Number(maSuatChieu));

    const thamSoGhe = danhSachGhe.map((maGhe, index) => {
      const tenThamSo = `MaGhe${index}`;

      requestGhe.input(tenThamSo, sql.Int, maGhe);

      return `@${tenThamSo}`;
    });

    const ketQuaGhe = await requestGhe.query(`
      SELECT
        g.MaGhe,
        g.SoGhe,
        g.LoaiGhe,
        gg.Gia
      FROM Ghe g
      INNER JOIN GiaGhe gg
        ON g.LoaiGhe = gg.LoaiGhe
      INNER JOIN SuatChieu sc
        ON sc.MaPhong = g.MaPhong
      WHERE sc.MaSuatChieu = @MaSuatChieu
        AND g.MaGhe IN (${thamSoGhe.join(",")})
    `);

    if (ketQuaGhe.recordset.length !== danhSachGhe.length) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Có ghế không tồn tại hoặc không thuộc phòng của suất chiếu!",
      });
    }

    // Kiểm tra ghế đã được đặt chưa
    const requestCheck = new sql.Request(transaction);

    requestCheck.input("MaSuatChieu", sql.Int, Number(maSuatChieu));

    const thamSoCheck = danhSachGhe.map((maGhe, index) => {
      const tenThamSo = `CheckGhe${index}`;

      requestCheck.input(tenThamSo, sql.Int, maGhe);

      return `@${tenThamSo}`;
    });

    const check = await requestCheck.query(`
      SELECT MaGhe
      FROM ChiTietDatVe WITH (UPDLOCK, HOLDLOCK)
      WHERE MaSuatChieu = @MaSuatChieu
        AND MaGhe IN (${thamSoCheck.join(",")})
    `);

    if (check.recordset.length > 0) {
      await transaction.rollback();

      return res.status(409).json({
        success: false,
        message: "Có ghế đã được người khác đặt trước!",
      });
    }

    // Tính tổng tiền ghế theo GiaGhe
    const tongTienGhe = ketQuaGhe.recordset.reduce(
      (tong, item) => tong + Number(item.Gia),
      0,
    );

    // kiểm tra và tính tiền dịch vụ

    const danhSachDichVu = Array.isArray(dichVu) ? dichVu : [];

    const tongSoLuongDichVu = danhSachDichVu.reduce(
      (tong, dv) => tong + Number(dv.soLuong),
      0,
    );

    // Tổng số lượng dịch vụ phải bằng số ghế
    if (tongSoLuongDichVu !== danhSachGhe.length) {
      throw new Error("Tổng số lượng dịch vụ phải bằng số ghế đã chọn!");
    }

    if (danhSachDichVu.length === 0) {
      throw new Error("Vui lòng chọn dịch vụ!");
    }

    let tongTienDichVu = 0;
    const danhSachDichVuHopLe = [];

    for (const dv of danhSachDichVu) {
      const maDichVu = Number(dv.maDichVu);
      const soLuong = Number(dv.soLuong);

      if (
        !Number.isInteger(maDichVu) ||
        maDichVu <= 0 ||
        !Number.isInteger(soLuong) ||
        soLuong <= 0
      ) {
        throw new Error("Thông tin dịch vụ không hợp lệ!");
      }

      // Lấy giá dịch vụ trực tiếp từ SQL
      const ketQuaDichVu = await new sql.Request(transaction).input(
        "MaDichVu",
        sql.Int,
        maDichVu,
      ).query(`
      SELECT MaDichVu, Gia
      FROM DichVu
      WHERE MaDichVu = @MaDichVu
    `);

      if (ketQuaDichVu.recordset.length === 0) {
        throw new Error(`Không tìm thấy dịch vụ có mã ${maDichVu}!`);
      }

      const donGia = Number(ketQuaDichVu.recordset[0].Gia);

      if (!Number.isFinite(donGia) || donGia < 0) {
        throw new Error("Giá dịch vụ không hợp lệ!");
      }

      tongTienDichVu += soLuong * donGia;

      danhSachDichVuHopLe.push({
        maDichVu,
        soLuong,
        donGia,
      });
    }

    const tongTienThucTe = tongTienGhe + tongTienDichVu;

    // Tạo đơn đặt vé
    const datVe = await new sql.Request(transaction)
      .input("MaTaiKhoan", sql.Int, Number(maTaiKhoan))
      .input("MaSuatChieu", sql.Int, Number(maSuatChieu))
      .input("TongTien", sql.Decimal(12, 2), tongTienThucTe)
      .input("PhuongThucThanhToan", sql.NVarChar(50), phuongThucThanhToan)
      .query(`
        INSERT INTO DatVe
        (
          MaTaiKhoan,
          MaSuatChieu,
          TongTien,
          PhuongThucThanhToan
        )
        OUTPUT INSERTED.MaDatVe
        VALUES
        (
          @MaTaiKhoan,
          @MaSuatChieu,
          @TongTien,
          @PhuongThucThanhToan
        )
      `);

    const maDatVe = datVe.recordset[0].MaDatVe;

    // Thêm chi tiết ghế với giá lấy từ database
    for (const item of ketQuaGhe.recordset) {
      await new sql.Request(transaction)
        .input("MaDatVe", sql.Int, maDatVe)
        .input("MaSuatChieu", sql.Int, Number(maSuatChieu))
        .input("MaGhe", sql.Int, item.MaGhe)
        .input("DonGia", sql.Decimal(12, 2), item.Gia).query(`
          INSERT INTO ChiTietDatVe
          (
            MaDatVe,
            MaSuatChieu,
            MaGhe,
            DonGia
          )
          VALUES
          (
            @MaDatVe,
            @MaSuatChieu,
            @MaGhe,
            @DonGia
          )
        `);
    }

    for (const dv of danhSachDichVuHopLe) {
      await new sql.Request(transaction)
        .input("MaDatVe", sql.Int, maDatVe)
        .input("MaDichVu", sql.Int, dv.maDichVu)
        .input("SoLuong", sql.Int, dv.soLuong)
        .input("DonGia", sql.Decimal(12, 2), dv.donGia).query(`
      INSERT INTO ChiTietDichVu
      (MaDatVe, MaDichVu, SoLuong, DonGia)
      VALUES
      (@MaDatVe, @MaDichVu, @SoLuong, @DonGia)
    `);
    }

    await transaction.commit();

    return res.json({
      success: true,
      maDatVe,
      tongTien: tongTienThucTe,
      message: "Đặt vé thành công!",
    });
  } catch (error) {
    console.error("LỖI ĐẶT VÉ:", error);

    if (transaction && transaction._aborted !== true) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error("Lỗi rollback:", rollbackError);
      }
    }

    return res.status(500).json({
      success: false,
      message: "Đặt vé thất bại!",
      error: error.message,
    });
  }
});

app.get("/api/phongchieu", async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT
        MaPhong,
        TenPhong,
        SoLuongGhe
      FROM PhongChieu
      ORDER BY MaPhong
    `);

    res.json(result.recordset);
  } catch (error) {
    console.error("LỖI LẤY PHÒNG:", error);

    res.status(500).json({
      message: "Không thể lấy danh sách phòng chiếu",
    });
  }
});

app.post("/api/suatchieu", async (req, res) => {
  try {
    const { tenPhim, maPhong, ngayChieu, gioChieu } = req.body;

    if (!tenPhim || !maPhong || !ngayChieu || !gioChieu) {
      return res.status(400).json({
        message: "Vui lòng nhập đầy đủ thông tin!",
      });
    }

    const pool = await poolPromise;
    // kiểm tra xem phim có tồn tại hay không

    const checkPhim = await pool
      .request()
      .input("TenPhim", sql.NVarChar(255), tenPhim).query(`
        SELECT TenPhim
        FROM Phim
        WHERE TenPhim = @TenPhim
      `);

    if (checkPhim.recordset.length === 0) {
      return res.status(404).json({
        message: "Không tìm thấy phim!",
      });
    }

    // kiểm tra phòng có tồn tại hay k

    const checkPhong = await pool.request().input("MaPhong", sql.Int, maPhong)
      .query(`
        SELECT MaPhong
        FROM PhongChieu
        WHERE MaPhong = @MaPhong
      `);

    if (checkPhong.recordset.length === 0) {
      return res.status(404).json({
        message: "Không tìm thấy phòng chiếu!",
      });
    }

    const checkTrung = await pool
      .request()
      .input("MaPhong", sql.Int, maPhong)
      .input("NgayChieu", sql.Date, ngayChieu)
      .input("GioChieu", sql.Time, gioChieu).query(`
        SELECT MaSuatChieu
        FROM SuatChieu
        WHERE MaPhong = @MaPhong
        AND NgayChieu = @NgayChieu
        AND GioChieu = @GioChieu
      `);

    if (checkTrung.recordset.length > 0) {
      return res.status(409).json({
        message: "Phòng này đã có suất chiếu vào thời gian này!",
      });
    }

    await pool
      .request()
      .input("TenPhim", sql.NVarChar(255), tenPhim)
      .input("MaPhong", sql.Int, maPhong)
      .input("NgayChieu", sql.Date, ngayChieu)
      .input("GioChieu", sql.Time, gioChieu).query(`
        INSERT INTO SuatChieu
        (
          TenPhim,
          MaPhong,
          NgayChieu,
          GioChieu
        )
        VALUES
        (
          @TenPhim,
          @MaPhong,
          @NgayChieu,
          @GioChieu
        )
      `);

    res.json({
      success: true,
      message: "Thêm suất chiếu thành công!",
    });
  } catch (error) {
    console.error("LỖI THÊM SUẤT CHIẾU:", error);

    res.status(500).json({
      message: "Không thể thêm suất chiếu",
      error: error.message,
    });
  }
});
app.delete("/api/suatchieu/:maSuatChieu", async (req, res) => {
  try {
    const maSuatChieu = Number(req.params.maSuatChieu);

    if (!maSuatChieu) {
      return res.status(400).json({
        message: "Mã suất chiếu không hợp lệ!",
      });
    }

    const pool = await poolPromise;

    // kiểm tra đã có vé chưa

    const checkVe = await pool
      .request()
      .input("MaSuatChieu", sql.Int, maSuatChieu).query(`
        SELECT MaDatVe
        FROM DatVe
        WHERE MaSuatChieu = @MaSuatChieu
      `);

    if (checkVe.recordset.length > 0) {
      return res.status(409).json({
        message: "Không thể xóa suất chiếu vì đã có người đặt vé!",
      });
    }

    await pool.request().input("MaSuatChieu", sql.Int, maSuatChieu).query(`
        DELETE FROM SuatChieu
        WHERE MaSuatChieu = @MaSuatChieu
      `);

    res.json({
      success: true,

      message: "Xóa suất chiếu thành công!",
    });
  } catch (error) {
    console.error("LỖI XÓA SUẤT CHIẾU:", error);

    res.status(500).json({
      message: "Không thể xóa suất chiếu",

      error: error.message,
    });
  }
});

app.get("/api/admin/chitietkhachhang/:maSuatChieu", async (req, res) => {
  try {
    const maSuatChieu = Number(req.params.maSuatChieu);

    if (!maSuatChieu) {
      return res.status(400).json({
        message: "Mã suất chiếu không hợp lệ!",
      });
    }

    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("MaSuatChieu", sql.Int, maSuatChieu).query(`
        SELECT
          dv.MaDatVe,
          tk.HoTen,
          tk.SoDienThoai,

          p.TenPhim,

          pc.TenPhong,

          sc.NgayChieu,
          sc.GioChieu,

          ghe.Ghe,

          dv.TongTien,

          dichvu.DichVu

        FROM DatVe dv

        INNER JOIN TaiKhoan tk
          ON dv.MaTaiKhoan = tk.MaTaiKhoan

        INNER JOIN SuatChieu sc
          ON dv.MaSuatChieu = sc.MaSuatChieu

        INNER JOIN Phim p
          ON sc.TenPhim = p.TenPhim

        INNER JOIN PhongChieu pc
          ON sc.MaPhong = pc.MaPhong

        OUTER APPLY
        (
          SELECT
            STRING_AGG(
              CONVERT(NVARCHAR(MAX), g.SoGhe),
              N', '
            ) AS Ghe

          FROM ChiTietDatVe ctdv

          INNER JOIN Ghe g
            ON ctdv.MaGhe = g.MaGhe

          WHERE ctdv.MaDatVe = dv.MaDatVe
        ) ghe

        OUTER APPLY
        (
          SELECT
            STRING_AGG(
              CONVERT(
                NVARCHAR(MAX),
                d.TenDichVu
                + N' x'
                + CAST(ctdv2.SoLuong AS NVARCHAR(10))
              ),
              N', '
            ) AS DichVu

          FROM ChiTietDichVu ctdv2

          INNER JOIN DichVu d
            ON ctdv2.MaDichVu = d.MaDichVu

          WHERE ctdv2.MaDatVe = dv.MaDatVe
        ) dichvu

        WHERE dv.MaSuatChieu = @MaSuatChieu

        ORDER BY dv.MaDatVe DESC
      `);

    res.json(result.recordset);
  } catch (error) {
    console.error("LỖI CHI TIẾT KHÁCH HÀNG:", error);

    res.status(500).json({
      message: "Không thể lấy thông tin khách hàng",
      error: error.message,
    });
  }
});

//xoa ve của khach
app.delete("/api/admin/xoave/:maDatVe", async (req, res) => {
  const maDatVe = Number(req.params.maDatVe);

  if (!maDatVe) {
    return res.status(400).json({
      message: "Mã đặt vé không hợp lệ!",
    });
  }

  let transaction;

  try {
    const pool = await poolPromise;

    transaction = new sql.Transaction(pool);

    await transaction.begin();

    // Kiểm tra vé
    const checkVe = await new sql.Request(transaction).input(
      "MaDatVe",
      sql.Int,
      maDatVe,
    ).query(`
                SELECT
                    MaDatVe,
                    MaSuatChieu
                FROM DatVe
                WHERE MaDatVe = @MaDatVe
            `);

    if (checkVe.recordset.length === 0) {
      await transaction.rollback();

      return res.status(404).json({
        message: "Không tìm thấy vé!",
      });
    }

    // Xóa dịch vụ
    await new sql.Request(transaction).input("MaDatVe", sql.Int, maDatVe)
      .query(`
                DELETE FROM ChiTietDichVu
                WHERE MaDatVe = @MaDatVe
            `);

    // Xóa ghế
    await new sql.Request(transaction).input("MaDatVe", sql.Int, maDatVe)
      .query(`
                DELETE FROM ChiTietDatVe
                WHERE MaDatVe = @MaDatVe
            `);

    // Xóa vé
    await new sql.Request(transaction).input("MaDatVe", sql.Int, maDatVe)
      .query(`
                DELETE FROM DatVe
                WHERE MaDatVe = @MaDatVe
            `);

    await transaction.commit();

    res.json({
      success: true,

      message: "Xóa vé thành công!",
    });
  } catch (error) {
    console.error("LỖI XÓA VÉ:", error);

    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error("LỖI ROLLBACK:", rollbackError);
      }
    }

    res.status(500).json({
      message: "Không thể xóa vé",

      error: error.message,
    });
  }
});

app.put("/api/phim/:tenphim/trangthai", async (req, res) => {
  try {
    const tenPhim = req.params.tenphim;
    const { TrangThai } = req.body;

    if (TrangThai !== "Hoạt động" && TrangThai !== "Ngừng chiếu") {
      return res.status(400).json({
        message: "Trạng thái không hợp lệ!",
      });
    }

    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("TenPhim", sql.NVarChar(255), tenPhim)
      .input("TrangThai", sql.NVarChar(50), TrangThai).query(`
        UPDATE Phim
        SET TrangThai = @TrangThai
        WHERE TenPhim = @TenPhim
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        message: "Không tìm thấy phim!",
      });
    }

    res.json({
      message: "Cập nhật trạng thái thành công!",
      TrangThai: TrangThai,
    });
  } catch (error) {
    console.error("Lỗi cập nhật trạng thái:", error);

    res.status(500).json({
      message: "Lỗi server khi cập nhật trạng thái!",
    });
  }
});
// thể loại
app.get("/api/theloai", async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT *
      FROM TheLoai
      ORDER BY MaTheLoai ASC
    `);

    res.json(result.recordset);
  } catch (error) {
    console.error("Lỗi lấy thể loại:", error);

    res.status(500).json({
      message: "Lỗi server!",
    });
  }
});
app.post("/api/theloai", async (req, res) => {
  try {
    const { TenTheLoai } = req.body;

    if (!TenTheLoai || TenTheLoai.trim() === "") {
      return res.status(400).json({
        message: "Tên thể loại không được để trống!",
      });
    }

    const pool = await poolPromise;

    await pool
      .request()
      .input("TenTheLoai", sql.NVarChar(100), TenTheLoai.trim()).query(`
        INSERT INTO TheLoai (TenTheLoai)
        VALUES (@TenTheLoai)
      `);

    res.json({
      message: "Thêm thể loại thành công!",
    });
  } catch (error) {
    console.error("Lỗi thêm thể loại:", error);

    if (error.number === 2627) {
      return res.status(400).json({
        message: "Thể loại này đã tồn tại!",
      });
    }

    res.status(500).json({
      message: "Lỗi server!",
    });
  }
});
app.put("/api/theloai/:ma", async (req, res) => {
  try {
    const ma = parseInt(req.params.ma);

    const { TenTheLoai } = req.body;

    if (!TenTheLoai || TenTheLoai.trim() === "") {
      return res.status(400).json({
        message: "Tên thể loại không được để trống!",
      });
    }

    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("MaTheLoai", sql.Int, ma)
      .input("TenTheLoai", sql.NVarChar(100), TenTheLoai.trim()).query(`
          UPDATE TheLoai

          SET TenTheLoai = @TenTheLoai

          WHERE MaTheLoai = @MaTheLoai
        `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        message: "Không tìm thấy thể loại!",
      });
    }

    res.json({
      message: "Sửa thể loại thành công!",
    });
  } catch (error) {
    console.error("Lỗi sửa thể loại:", error);

    if (error.number === 2627) {
      return res.status(400).json({
        message: "Tên thể loại này đã tồn tại!",
      });
    }

    res.status(500).json({
      message: "Lỗi server!",
    });
  }
});
app.delete("/api/theloai/:id", async (req, res) => {
  try {
    const maTheLoai = Number(req.params.id);

    const pool = await poolPromise;

    // kiểm tra thế loại đã được sử dụng chưa

    const checkResult = await pool
      .request()
      .input("MaTheLoai", sql.Int, maTheLoai).query(`
        SELECT TOP 1
          p.TenPhim
        FROM Phim_TheLoai ptl

        INNER JOIN Phim p
          ON ptl.TenPhim = p.TenPhim

        WHERE ptl.MaTheLoai = @MaTheLoai
      `);

    if (checkResult.recordset.length > 0) {
      return res.status(400).json({
        message: "Thể loại này đang được dùng cho phim!",
      });
    }

    await pool.request().input("MaTheLoai", sql.Int, maTheLoai).query(`
        DELETE FROM TheLoai
        WHERE MaTheLoai = @MaTheLoai
      `);

    res.json({
      message: "Xóa thể loại thành công!",
    });
  } catch (error) {
    console.error("LỖI XÓA THỂ LOẠI:", error);

    res.status(500).json({
      message: "Không thể xóa thể loại!",
      error: error.message,
    });
  }
});
//them tk
app.post("/api/taikhoan", async (req, res) => {
  try {
    const { HoTen, SoDienThoai, MatKhau } = req.body;

    // Kiểm tra dữ liệu
    if (!HoTen || !SoDienThoai || !MatKhau) {
      return res.status(400).json({
        message: "Vui lòng nhập đầy đủ thông tin!",
      });
    }

    // Kết nối SQL Server
    const pool = await poolPromise;

    // Kiểm tra số điện thoại đã tồn tại
    const checkAccount = await pool
      .request()
      .input("SoDienThoai", sql.NVarChar(20), SoDienThoai).query(`
        SELECT MaTaiKhoan
        FROM TaiKhoan
        WHERE SoDienThoai = @SoDienThoai
      `);

    if (checkAccount.recordset.length > 0) {
      return res.status(400).json({
        message: "Số điện thoại đã tồn tại!",
      });
    }

    // Thêm tài khoản
    await pool
      .request()
      .input("HoTen", sql.NVarChar(100), HoTen)
      .input("SoDienThoai", sql.NVarChar(20), SoDienThoai)
      .input("MatKhau", sql.NVarChar(255), MatKhau).query(`
        INSERT INTO TaiKhoan
        (
          HoTen,
          SoDienThoai,
          MatKhau
        )
        VALUES
        (
          @HoTen,
          @SoDienThoai,
          @MatKhau
        )
      `);

    res.json({
      message: "Thêm tài khoản thành công!",
    });
  } catch (error) {
    console.error("LỖI THÊM TÀI KHOẢN:", error);

    res.status(500).json({
      message: "Lỗi khi thêm tài khoản!",
      error: error.message,
    });
  }
});
app.get("/api/doanhthu", async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT
        p.TenPhim,
        p.AnhPhim,
        p.TrangThai,

        ISNULL(ve.SoVeBan, 0) AS SoVeBan,

        ISNULL(dt.TongDoanhThu, 0) AS TongDoanhThu

      FROM Phim p

      LEFT JOIN
      (
        -- ĐẾM SỐ VÉ
        SELECT
          sc.TenPhim,
          COUNT(cd.MaChiTiet) AS SoVeBan

        FROM SuatChieu sc

        INNER JOIN DatVe dv
          ON sc.MaSuatChieu = dv.MaSuatChieu

        INNER JOIN ChiTietDatVe cd
          ON dv.MaDatVe = cd.MaDatVe

        WHERE dv.TrangThai = N'Đã đặt'

        GROUP BY sc.TenPhim

      ) ve
        ON p.TenPhim = ve.TenPhim

      LEFT JOIN
      (
        -- TÍNH DOANH THU
        SELECT
          sc.TenPhim,
          SUM(dv.TongTien) AS TongDoanhThu

        FROM SuatChieu sc

        INNER JOIN DatVe dv
          ON sc.MaSuatChieu = dv.MaSuatChieu

        WHERE dv.TrangThai = N'Đã đặt'

        GROUP BY sc.TenPhim

      ) dt
        ON p.TenPhim = dt.TenPhim

      ORDER BY p.TenPhim
    `);

    res.json(result.recordset);
  } catch (error) {
    console.error("LỖI LẤY DOANH THU:", error);

    res.status(500).json({
      message: "Không thể lấy dữ liệu doanh thu!",
      error: error.message,
    });
  }
});

app.put("/api/taikhoan/:id/matkhau", async (req, res) => {
  try {
    const maTaiKhoan = Number(req.params.id);
    const { MatKhau } = req.body;

    if (!MatKhau || MatKhau.trim() === "") {
      return res.status(400).json({
        message: "Mật khẩu không được để trống!",
      });
    }

    const pool = await poolPromise;

    // Kiểm tra tài khoản có tồn tại không
    const checkAccount = await pool
      .request()
      .input("MaTaiKhoan", sql.Int, maTaiKhoan).query(`
        SELECT MaTaiKhoan, HoTen
        FROM TaiKhoan
        WHERE MaTaiKhoan = @MaTaiKhoan
      `);

    if (checkAccount.recordset.length === 0) {
      return res.status(404).json({
        message: "Không tìm thấy tài khoản!",
      });
    }

    // Cập nhật mật khẩu
    await pool
      .request()
      .input("MaTaiKhoan", sql.Int, maTaiKhoan)
      .input("MatKhau", sql.NVarChar(255), MatKhau).query(`
        UPDATE TaiKhoan
        SET MatKhau = @MatKhau
        WHERE MaTaiKhoan = @MaTaiKhoan
      `);

    res.json({
      message: "Đổi mật khẩu thành công!",
    });
  } catch (error) {
    console.error("LỖI SỬA MẬT KHẨU:", error);

    res.status(500).json({
      message: "Không thể sửa mật khẩu tài khoản!",
      error: error.message,
    });
  }
});

app.get("/api/phim/:tenPhim", async (req, res) => {
  try {
    const { tenPhim } = req.params;

    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("TenPhim", sql.NVarChar(255), tenPhim).query(`
        SELECT
          p.AnhPhim,
          p.TenPhim,
          p.DaoDien,
          p.DienVien,

          STRING_AGG(
            tl.TenTheLoai,
            N', '
          ) AS TheLoai,

          p.KhoiChieu,
          p.ThoiLuong,
          p.Ngonngu,
          p.rated,
          p.noidung,
          p.Trailer,
          p.TrangThai

        FROM Phim p

        LEFT JOIN Phim_TheLoai ptl
          ON p.TenPhim = ptl.TenPhim

        LEFT JOIN TheLoai tl
          ON ptl.MaTheLoai = tl.MaTheLoai

        WHERE p.TenPhim = @TenPhim

        GROUP BY
          p.AnhPhim,
          p.TenPhim,
          p.DaoDien,
          p.DienVien,
          p.KhoiChieu,
          p.ThoiLuong,
          p.Ngonngu,
          p.rated,
          p.noidung,
          p.Trailer,
          p.TrangThai
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        message: "Không tìm thấy phim!",
      });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error("LỖI LẤY CHI TIẾT PHIM:", error);

    res.status(500).json({
      message: "Không thể lấy thông tin phim!",
      error: error.message,
    });
  }
});
app.get("/api/phim/:tenPhim/theloai", async (req, res) => {
  try {
    const { tenPhim } = req.params;

    const result = await pool
      .request()
      .input("TenPhim", sql.NVarChar(255), tenPhim).query(`
        SELECT MaTheLoai
        FROM Phim_TheLoai
        WHERE TenPhim = @TenPhim
      `);

    const maTheLoai = result.recordset.map((item) => item.MaTheLoai);

    res.json(maTheLoai);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Lỗi server!",
    });
  }
});
app.put("/api/phim/:tenPhim", async (req, res) => {
  let transaction;

  try {
    const pool = await poolPromise;

    transaction = new sql.Transaction(pool);
    const { tenPhim } = req.params;

    const {
      TenPhim,
      AnhPhim,
      DaoDien,
      DienVien,
      KhoiChieu,
      ThoiLuong,
      Ngonngu,
      rated,
      noidung,
      MaTheLoai,
    } = req.body;

    if (!TenPhim) {
      return res.status(400).json({
        message: "Tên phim không được để trống!",
      });
    }

    if (!Array.isArray(MaTheLoai) || MaTheLoai.length === 0) {
      return res.status(400).json({
        message: "Phim phải có ít nhất một thể loại!",
      });
    }

    await transaction.begin();

    const checkMovie = await new sql.Request(transaction).input(
      "TenPhimCu",
      sql.NVarChar(255),
      tenPhim,
    ).query(`
          SELECT TenPhim
          FROM Phim
          WHERE TenPhim = @TenPhimCu
        `);

    if (checkMovie.recordset.length === 0) {
      await transaction.rollback();

      return res.status(404).json({
        message: "Không tìm thấy phim!",
      });
    }

    if (TenPhim !== tenPhim) {
      const checkNewName = await new sql.Request(transaction).input(
        "TenPhimMoi",
        sql.NVarChar(255),
        TenPhim,
      ).query(`
            SELECT TenPhim
            FROM Phim
            WHERE TenPhim = @TenPhimMoi
          `);

      if (checkNewName.recordset.length > 0) {
        await transaction.rollback();

        return res.status(400).json({
          message: "Tên phim mới đã tồn tại!",
        });
      }
    }

    await new sql.Request(transaction).input(
      "TenPhimCu",
      sql.NVarChar(255),
      tenPhim,
    ).query(`
        DELETE FROM Phim_TheLoai
        WHERE TenPhim = @TenPhimCu
      `);

    await new sql.Request(transaction)

      .input("TenPhimCu", sql.NVarChar(255), tenPhim)

      .input("TenPhimMoi", sql.NVarChar(255), TenPhim)

      .input("AnhPhim", sql.NVarChar(500), AnhPhim)

      .input("DaoDien", sql.NVarChar(255), DaoDien)

      .input("DienVien", sql.NVarChar(500), DienVien)

      .input("KhoiChieu", sql.Date, KhoiChieu || null)

      .input("ThoiLuong", sql.Int, ThoiLuong || null)

      .input("Ngonngu", sql.NVarChar(100), Ngonngu)

      .input("rated", sql.NVarChar(50), rated)

      .input("noidung", sql.NVarChar(sql.MAX), noidung).query(`
        UPDATE Phim

        SET
          TenPhim = @TenPhimMoi,
          AnhPhim = @AnhPhim,
          DaoDien = @DaoDien,
          DienVien = @DienVien,
          KhoiChieu = @KhoiChieu,
          ThoiLuong = @ThoiLuong,
          Ngonngu = @Ngonngu,
          rated = @rated,
          noidung = @noidung

        WHERE
          TenPhim = @TenPhimCu
      `);

    for (const maTheLoai of MaTheLoai) {
      await new sql.Request(transaction)

        .input("TenPhim", sql.NVarChar(255), TenPhim)

        .input("MaTheLoai", sql.Int, maTheLoai).query(`
          INSERT INTO Phim_TheLoai
          (
            TenPhim,
            MaTheLoai
          )

          VALUES
          (
            @TenPhim,
            @MaTheLoai
          )
        `);
    }

    await transaction.commit();

    res.json({
      message: "Cập nhật phim thành công!",
    });
  } catch (error) {
    console.error(error);

    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error(rollbackError);
    }

    res.status(500).json({
      message: "Lỗi server khi cập nhật phim!",
    });
  }
});

app.get("/api/ai/suat-chieu", async (req, res) => {
  try {
    const pool = await poolPromise;

    const tenPhim = (req.query.tenPhim || "").trim();
    const ngay = (req.query.ngay || "").trim();

    if (ngay && !/^\d{4}-\d{2}-\d{2}$/.test(ngay)) {
      return res.status(400).json({
        success: false,
        message: "Ngày phải có định dạng YYYY-MM-DD.",
      });
    }

    const request = pool
      .request()
      .input("tenPhim", sql.NVarChar(255), `%${tenPhim}%`);

    let dieuKienNgay = "";

    if (ngay) {
      request.input("ngay", sql.Date, ngay);
      dieuKienNgay = "AND sc.NgayChieu = @ngay";
    } else {
      dieuKienNgay = "AND sc.NgayChieu >= CAST(GETDATE() AS DATE)";
    }

    const result = await request.query(`
            SELECT
                sc.MaSuatChieu,
                sc.TenPhim,
                sc.NgayChieu,
                sc.GioChieu,
                pc.MaPhong,
                pc.TenPhong,
                pc.SoLuongGhe
            FROM SuatChieu sc
            JOIN PhongChieu pc
                ON sc.MaPhong = pc.MaPhong
            WHERE
                (@tenPhim = N'%%' OR sc.TenPhim LIKE @tenPhim)
                ${dieuKienNgay}
            ORDER BY sc.NgayChieu, sc.GioChieu;
        `);

    res.json({
      success: true,
      data: result.recordset,
    });
  } catch (error) {
    console.error("Lỗi API suất chiếu:", error);
    res.status(500).json({
      success: false,
      message: "Không thể tra cứu suất chiếu.",
    });
  }
});

app.get("/api/ai/ghe-trong", async (req, res) => {
  try {
    const maSuatChieu = Number(req.query.maSuatChieu);

    if (!Number.isInteger(maSuatChieu) || maSuatChieu <= 0) {
      return res.status(400).json({
        success: false,
        message: "Mã suất chiếu không hợp lệ.",
      });
    }

    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("maSuatChieu", sql.Int, maSuatChieu).query(`
                SELECT
                    g.MaGhe,
                    g.SoGhe,
                    g.LoaiGhe,
                    CASE
                        WHEN ctdv.MaGhe IS NULL THEN N'Trống'
                        ELSE N'Đã đặt'
                    END AS TrangThai
                FROM SuatChieu sc
                JOIN Ghe g
                    ON g.MaPhong = sc.MaPhong
                LEFT JOIN ChiTietDatVe ctdv
                    ON ctdv.MaGhe = g.MaGhe
                    AND ctdv.MaSuatChieu = sc.MaSuatChieu
                WHERE sc.MaSuatChieu = @maSuatChieu
                ORDER BY g.MaGhe;
            `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy suất chiếu hoặc ghế.",
      });
    }

    res.json({
      success: true,
      data: result.recordset,
      tongSoGhe: result.recordset.length,
      soGheTrong: result.recordset.filter((g) => g.TrangThai === "Trống")
        .length,
    });
  } catch (error) {
    console.error("Lỗi API ghế trống:", error);
    res.status(500).json({
      success: false,
      message: "Không thể kiểm tra ghế.",
    });
  }
});

app.get("/api/ai/dich-vu", async (req, res) => {
  try {
    const pool = await poolPromise;

    const [dichVu, nuoc] = await Promise.all([
      pool.request().query(`
                SELECT MaDichVu, TenDichVu, Gia
                FROM DichVu
                ORDER BY MaDichVu;
            `),
    ]);

    res.json({
      success: true,
      dichVu: dichVu.recordset,
      nuoc: nuoc.recordset,
    });
  } catch (error) {
    console.error("Lỗi API dịch vụ:", error);
    res.status(500).json({
      success: false,
      message: "Không thể lấy thông tin dịch vụ.",
    });
  }
});
app.post("/api/ai/dat-ve", async (req, res) => {
  let transaction;

  try {
    const maTaiKhoan = req.session?.maTaiKhoan;

    if (!maTaiKhoan) {
      return res.status(401).json({
        success: false,
        message: "Bạn cần đăng nhập để đặt vé.",
      });
    }

    const { maSuatChieu, ghe, phuongThucThanhToan } = req.body;

    if (!Number.isInteger(Number(maSuatChieu)) || Number(maSuatChieu) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Mã suất chiếu không hợp lệ.",
      });
    }

    if (
      !Array.isArray(ghe) ||
      ghe.length === 0 ||
      ghe.length > 10 ||
      !ghe.every((x) => typeof x === "string" && x.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Danh sách ghế không hợp lệ.",
      });
    }

    const danhSachGhe = ghe.map((x) => x.trim());

    if (new Set(danhSachGhe).size !== danhSachGhe.length) {
      return res.status(400).json({
        success: false,
        message: "Danh sách ghế có ghế bị trùng.",
      });
    }

    if (
      typeof phuongThucThanhToan !== "string" ||
      !phuongThucThanhToan.trim() ||
      phuongThucThanhToan.trim().length > 50
    ) {
      return res.status(400).json({
        success: false,
        message: "Phương thức thanh toán không hợp lệ.",
      });
    }

    const pool = await poolPromise;

    transaction = new sql.Transaction(pool);

    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    const taiKhoan = await new sql.Request(transaction).input(
      "maTaiKhoan",
      sql.Int,
      Number(maTaiKhoan),
    ).query(`
                SELECT MaTaiKhoan, TrangThai
                FROM TaiKhoan
                WHERE MaTaiKhoan = @maTaiKhoan;
            `);

    if (
      taiKhoan.recordset.length === 0 ||
      taiKhoan.recordset[0].TrangThai !== "Hoạt động"
    ) {
      await transaction.rollback();

      return res.status(403).json({
        success: false,
        message: "Tài khoản không tồn tại hoặc đã bị khóa.",
      });
    }

    const suatChieu = await new sql.Request(transaction).input(
      "maSuatChieu",
      sql.Int,
      Number(maSuatChieu),
    ).query(`
                SELECT
                    MaSuatChieu,
                    TenPhim,
                    MaPhong,
                    NgayChieu,
                    GioChieu
                FROM SuatChieu WITH (UPDLOCK, HOLDLOCK)
                WHERE MaSuatChieu = @maSuatChieu
                  AND (
                    NgayChieu > CAST(GETDATE() AS DATE)
                    OR (
                        NgayChieu = CAST(GETDATE() AS DATE)
                        AND GioChieu > CAST(GETDATE() AS TIME)
                    )
                  );
            `);

    if (suatChieu.recordset.length === 0) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "Suất chiếu không tồn tại hoặc đã qua giờ chiếu.",
      });
    }

    const thongTinSuat = suatChieu.recordset[0];

    const seatParams = danhSachGhe.map((_, i) => `@ghe${i}`).join(", ");

    const requestGhe = new sql.Request(transaction)
      .input("maPhong", sql.Int, thongTinSuat.MaPhong)
      .input("maSuatChieu", sql.Int, Number(maSuatChieu));

    danhSachGhe.forEach((soGhe, i) => {
      requestGhe.input(`ghe${i}`, sql.NVarChar(10), soGhe);
    });

    // Kiểm tra ghế có thuộc phòng và còn trống không
    const ketQuaGhe = await requestGhe.query(`
            SELECT
                g.MaGhe,
                g.SoGhe,
                g.LoaiGhe,
                ctdv.MaChiTiet
            FROM Ghe g WITH (UPDLOCK, HOLDLOCK)
            LEFT JOIN ChiTietDatVe ctdv WITH (UPDLOCK, HOLDLOCK)
                ON ctdv.MaGhe = g.MaGhe
                AND ctdv.MaSuatChieu = @maSuatChieu
            WHERE g.MaPhong = @maPhong
              AND g.SoGhe IN (${seatParams});
        `);

    if (ketQuaGhe.recordset.length !== danhSachGhe.length) {
      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Có ghế không tồn tại trong phòng chiếu.",
      });
    }

    const gheDaDat = ketQuaGhe.recordset.filter(
      (item) => item.MaChiTiet !== null,
    );

    if (gheDaDat.length > 0) {
      await transaction.rollback();

      return res.status(409).json({
        success: false,
        message: "Một số ghế đã được người khác đặt.",
        gheDaDat: gheDaDat.map((item) => item.SoGhe),
      });
    }

    // Lấy giá vé từ database, không nhận giá từ trình duyệt
    const giaVeResult = await new sql.Request(transaction).query(`
                SELECT TOP 1 Gia
                FROM DichVu
                WHERE TenDichVu = N'Ve xem phim';
            `);

    if (giaVeResult.recordset.length === 0) {
      await transaction.rollback();

      return res.status(500).json({
        success: false,
        message: "Chưa cấu hình giá vé trong database.",
      });
    }

    const donGia = Number(giaVeResult.recordset[0].Gia);
    const tongTien = donGia * ketQuaGhe.recordset.length;

    const donVe = await new sql.Request(transaction)
      .input("maTaiKhoan", sql.Int, Number(maTaiKhoan))
      .input("maSuatChieu", sql.Int, Number(maSuatChieu))
      .input("tongTien", sql.Decimal(12, 2), tongTien)
      .input(
        "phuongThucThanhToan",
        sql.NVarChar(50),
        phuongThucThanhToan.trim(),
      ).query(`
                INSERT INTO DatVe (
                    MaTaiKhoan,
                    MaSuatChieu,
                    TongTien,
                    PhuongThucThanhToan
                )
                OUTPUT INSERTED.MaDatVe
                VALUES (
                    @maTaiKhoan,
                    @maSuatChieu,
                    @tongTien,
                    @phuongThucThanhToan
                );
            `);

    const maDatVe = donVe.recordset[0].MaDatVe;

    for (const item of ketQuaGhe.recordset) {
      await new sql.Request(transaction)
        .input("maDatVe", sql.Int, maDatVe)
        .input("maSuatChieu", sql.Int, Number(maSuatChieu))
        .input("maGhe", sql.Int, item.MaGhe)
        .input("donGia", sql.Decimal(12, 2), donGia).query(`
                    INSERT INTO ChiTietDatVe (
                        MaDatVe,
                        MaSuatChieu,
                        MaGhe,
                        DonGia
                    )
                    VALUES (
                        @maDatVe,
                        @maSuatChieu,
                        @maGhe,
                        @donGia
                    );
                `);
    }

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: "Đặt vé thành công.",
      data: {
        maDatVe,
        maTaiKhoan: Number(maTaiKhoan),
        tenPhim: thongTinSuat.TenPhim,
        maSuatChieu: Number(maSuatChieu),
        ngayChieu: thongTinSuat.NgayChieu,
        gioChieu: thongTinSuat.GioChieu,
        ghe: ketQuaGhe.recordset.map((item) => ({
          maGhe: item.MaGhe,
          soGhe: item.SoGhe,
          loaiGhe: item.LoaiGhe,
        })),
        soLuongVe: ketQuaGhe.recordset.length,
        donGia,
        tongTien,
        phuongThucThanhToan,
      },
    });
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error("Lỗi rollback:", rollbackError);
      }
    }

    console.error("Lỗi API AI đặt vé:", error);

    if (error.number === 2601 || error.number === 2627) {
      return res.status(409).json({
        success: false,
        message: "Ghế vừa được người khác đặt. Vui lòng chọn ghế khác.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Không thể tạo đơn đặt vé.",
    });
  }
});

app.get("/api/phongchieu/:id", async (req, res) => {
  try {
    const pool = await poolPromise;
    const maPhong = Number(req.params.id);

    if (!Number.isInteger(maPhong) || maPhong <= 0) {
      return res.status(400).json({
        success: false,
        message: "Mã phòng không hợp lệ!",
      });
    }

    const phong = await pool.request().input("MaPhong", sql.Int, maPhong)
      .query(`
        SELECT MaPhong, TenPhong, SoLuongGhe
        FROM PhongChieu
        WHERE MaPhong = @MaPhong
      `);

    if (phong.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phòng!",
      });
    }

    const hang = await pool.request().input("MaPhong", sql.Int, maPhong).query(`
        SELECT
          hg.MaHang,
          hg.TenHang,
          hg.LoaiGhe,
          COUNT(g.MaGhe) AS SoLuongGhe
        FROM HangGhe hg
        LEFT JOIN Ghe g ON g.MaHang = hg.MaHang
        WHERE hg.MaPhong = @MaPhong
        GROUP BY hg.MaHang, hg.TenHang, hg.LoaiGhe
        ORDER BY hg.MaHang
      `);

    res.json({
      success: true,
      phong: phong.recordset[0],
      hangGhe: hang.recordset,
    });
  } catch (error) {
    console.error("LỖI CHI TIẾT PHÒNG:", error);
    res.status(500).json({
      success: false,
      message: "Không thể lấy chi tiết phòng!",
    });
  }
});

async function taoHangGhe(transaction, maPhong, hangGhe) {
  for (const hang of hangGhe) {
    const tenHang = String(hang.tenHang).trim();
    const loaiGhe = String(hang.loaiGhe).trim();
    const soLuongGhe = Number(hang.soLuongGhe);

    const result = await new sql.Request(transaction)
      .input("MaPhong", sql.Int, maPhong)
      .input("TenHang", sql.NVarChar(10), tenHang)
      .input("LoaiGhe", sql.NVarChar(50), loaiGhe).query(`
        INSERT INTO HangGhe (MaPhong, TenHang, LoaiGhe)
        OUTPUT INSERTED.MaHang
        VALUES (@MaPhong, @TenHang, @LoaiGhe)
      `);

    const maHang = result.recordset[0].MaHang;

    for (let i = 1; i <= soLuongGhe; i++) {
      const soGhe = `${tenHang}${i}`;

      await new sql.Request(transaction)
        .input("MaPhong", sql.Int, maPhong)
        .input("MaHang", sql.Int, maHang)
        .input("SoGhe", sql.NVarChar(10), soGhe)
        .input("LoaiGhe", sql.NVarChar(50), loaiGhe).query(`
          INSERT INTO Ghe (MaPhong, MaHang, SoGhe, LoaiGhe)
          VALUES (@MaPhong, @MaHang, @SoGhe, @LoaiGhe)
        `);
    }
  }
}

app.put("/api/phongchieu/:id", async (req, res) => {
  let transaction;

  try {
    const maPhong = Number(req.params.id);
    const tenPhong = String(req.body.tenPhong || "").trim();
    const hangGhe = req.body.hangGhe;

    if (!Number.isInteger(maPhong) || maPhong <= 0 || !tenPhong) {
      return res.status(400).json({
        success: false,
        message: "Thông tin phòng không hợp lệ!",
      });
    }

    const loiKiemTra = kiemTraHangGhe(hangGhe);

    if (loiKiemTra) {
      return res.status(400).json({
        success: false,
        message: loiKiemTra,
      });
    }

    const pool = await poolPromise;

    transaction = new sql.Transaction(pool);
    await transaction.begin();

    const checkPhong = await new sql.Request(transaction).input(
      "MaPhong",
      sql.Int,
      maPhong,
    ).query(`
        SELECT MaPhong FROM PhongChieu
        WHERE MaPhong = @MaPhong
      `);

    if (checkPhong.recordset.length === 0) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phòng!",
      });
    }

    const checkTen = await new sql.Request(transaction)
      .input("TenPhong", sql.NVarChar(100), tenPhong)
      .input("MaPhong", sql.Int, maPhong).query(`
        SELECT MaPhong
        FROM PhongChieu
        WHERE TenPhong = @TenPhong
          AND MaPhong <> @MaPhong
      `);

    if (checkTen.recordset.length > 0) {
      await transaction.rollback();

      return res.status(409).json({
        success: false,
        message: "Tên phòng đã được sử dụng!",
      });
    }

    const checkDatVe = await new sql.Request(transaction).input(
      "MaPhong",
      sql.Int,
      maPhong,
    ).query(`
        SELECT TOP 1 cd.MaChiTiet
        FROM ChiTietDatVe cd
        INNER JOIN Ghe g ON cd.MaGhe = g.MaGhe
        WHERE g.MaPhong = @MaPhong
      `);

    if (checkDatVe.recordset.length > 0) {
      await transaction.rollback();

      return res.status(409).json({
        success: false,
        message: "Phòng đã có vé được đặt. Không thể thay đổi sơ đồ ghế!",
      });
    }

    await new sql.Request(transaction).input("MaPhong", sql.Int, maPhong)
      .query(`
        DELETE FROM Ghe WHERE MaPhong = @MaPhong;
        DELETE FROM HangGhe WHERE MaPhong = @MaPhong;
      `);

    const soLuongGhe = hangGhe.reduce(
      (tong, hang) => tong + Number(hang.soLuongGhe),
      0,
    );

    await new sql.Request(transaction)
      .input("MaPhong", sql.Int, maPhong)
      .input("TenPhong", sql.NVarChar(100), tenPhong)
      .input("SoLuongGhe", sql.Int, soLuongGhe).query(`
        UPDATE PhongChieu
        SET TenPhong = @TenPhong,
            SoLuongGhe = @SoLuongGhe
        WHERE MaPhong = @MaPhong
      `);

    await taoHangGhe(transaction, maPhong, hangGhe);

    await transaction.commit();

    res.json({
      success: true,
      message: "Cập nhật phòng chiếu thành công!",
    });
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (e) {
        console.error(e);
      }
    }

    console.error("LỖI SỬA PHÒNG:", error);

    res.status(500).json({
      success: false,
      message: "Không thể cập nhật phòng!",
      error: error.message,
    });
  }
});

app.delete("/api/phongchieu/:id", async (req, res) => {
  let transaction;

  try {
    const maPhong = Number(req.params.id);

    if (!Number.isInteger(maPhong) || maPhong <= 0) {
      return res.status(400).json({
        success: false,
        message: "Mã phòng không hợp lệ!",
      });
    }

    const pool = await poolPromise;

    transaction = new sql.Transaction(pool);
    await transaction.begin();

    const check = await new sql.Request(transaction).input(
      "MaPhong",
      sql.Int,
      maPhong,
    ).query(`
        SELECT MaPhong FROM PhongChieu
        WHERE MaPhong = @MaPhong
      `);

    if (check.recordset.length === 0) {
      await transaction.rollback();

      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phòng!",
      });
    }

    const checkSuat = await new sql.Request(transaction).input(
      "MaPhong",
      sql.Int,
      maPhong,
    ).query(`
        SELECT TOP 1 MaSuatChieu
        FROM SuatChieu
        WHERE MaPhong = @MaPhong
      `);

    if (checkSuat.recordset.length > 0) {
      await transaction.rollback();

      return res.status(409).json({
        success: false,
        message: "Không thể xóa phòng đã có suất chiếu!",
      });
    }

    await new sql.Request(transaction).input("MaPhong", sql.Int, maPhong)
      .query(`
        DELETE FROM Ghe WHERE MaPhong = @MaPhong;
        DELETE FROM HangGhe WHERE MaPhong = @MaPhong;
        DELETE FROM PhongChieu WHERE MaPhong = @MaPhong;
      `);

    await transaction.commit();

    res.json({
      success: true,
      message: "Xóa phòng chiếu thành công!",
    });
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (e) {
        console.error(e);
      }
    }

    console.error("LỖI XÓA PHÒNG:", error);

    res.status(500).json({
      success: false,
      message: "Không thể xóa phòng!",
      error: error.message,
    });
  }
});

app.get("/api/giaghe", async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT LoaiGhe, Gia
      FROM GiaGhe
      ORDER BY
        CASE LoaiGhe
          WHEN N'Thường' THEN 1
          WHEN N'VIP' THEN 2
          WHEN N'Đôi' THEN 3
          ELSE 4
        END
    `);

    res.json({
      success: true,
      data: result.recordset,
    });
  } catch (error) {
    console.error("LỖI LẤY GIÁ GHẾ:", error);

    res.status(500).json({
      success: false,
      message: "Không thể lấy giá ghế!",
    });
  }
});

app.put("/api/giaghe", async (req, res) => {
  let transaction;

  try {
    const giaGhe = req.body.giaGhe;

    const cacLoai = ["Thường", "VIP", "Đôi"];

    if (!giaGhe || typeof giaGhe !== "object") {
      return res.status(400).json({
        success: false,
        message: "Dữ liệu giá ghế không hợp lệ!",
      });
    }

    for (const loai of cacLoai) {
      const gia = Number(giaGhe[loai]);

      if (!Number.isFinite(gia) || gia <= 0) {
        return res.status(400).json({
          success: false,
          message: `Giá ghế ${loai} không hợp lệ!`,
        });
      }
    }

    const pool = await poolPromise;

    transaction = new sql.Transaction(pool);
    await transaction.begin();

    for (const loai of cacLoai) {
      await new sql.Request(transaction)
        .input("LoaiGhe", sql.NVarChar(50), loai)
        .input("Gia", sql.Decimal(12, 2), Number(giaGhe[loai])).query(`
          UPDATE GiaGhe
          SET Gia = @Gia
          WHERE LoaiGhe = @LoaiGhe
        `);
    }

    await transaction.commit();

    res.json({
      success: true,
      message: "Cập nhật giá ghế thành công!",
    });
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (e) {
        console.error(e);
      }
    }

    console.error("LỖI CẬP NHẬT GIÁ:", error);

    res.status(500).json({
      success: false,
      message: "Không thể cập nhật giá ghế!",
      error: error.message,
    });
  }
});

app.post("/api/phongchieu", async (req, res) => {
  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);

  let daBatDau = false;

  try {
    const { tenPhong, hangGhe } = req.body;

    if (!tenPhong || !tenPhong.trim()) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập tên phòng!",
      });
    }

    if (!Array.isArray(hangGhe) || hangGhe.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Phòng phải có ít nhất một hàng ghế!",
      });
    }

    const danhSachTenHang = new Set();

    for (const hang of hangGhe) {
      const tenHang = String(hang.tenHang || "")
        .trim()
        .toUpperCase();
      const loaiGhe = hang.loaiGhe;
      const soLuongGhe = Number(hang.soLuongGhe);

      if (!/^[A-Z]{1,2}$/.test(tenHang)) {
        return res.status(400).json({
          success: false,
          message: "Tên hàng chỉ được chứa 1-2 chữ cái A-Z!",
        });
      }

      if (danhSachTenHang.has(tenHang)) {
        return res.status(400).json({
          success: false,
          message: `Hàng ${tenHang} đang bị trùng!`,
        });
      }

      danhSachTenHang.add(tenHang);

      if (!["Thường", "VIP", "Đôi"].includes(loaiGhe)) {
        return res.status(400).json({
          success: false,
          message: `Loại ghế của hàng ${tenHang} không hợp lệ!`,
        });
      }

      if (!Number.isInteger(soLuongGhe) || soLuongGhe <= 0) {
        return res.status(400).json({
          success: false,
          message: `Số lượng ghế hàng ${tenHang} phải là số nguyên dương!`,
        });
      }

      if (
        (loaiGhe === "Thường" || loaiGhe === "VIP") &&
        soLuongGhe % 11 !== 0
      ) {
        return res.status(400).json({
          success: false,
          message: `Hàng ${tenHang} loại ${loaiGhe} phải có số ghế chia hết cho 11!`,
        });
      }

      if (loaiGhe === "Đôi" && soLuongGhe % 6 !== 0) {
        return res.status(400).json({
          success: false,
          message: `Hàng ${tenHang} loại Đôi phải có số ghế chia hết cho 6!`,
        });
      }
    }

    const tongSoGhe = hangGhe.reduce(
      (tong, hang) => tong + Number(hang.soLuongGhe),
      0,
    );

    await transaction.begin();
    daBatDau = true;

    const request = new sql.Request(transaction);

    const kiemTraPhong = await request.input(
      "TenPhong",
      sql.NVarChar(100),
      tenPhong.trim(),
    ).query(`
        SELECT MaPhong
        FROM PhongChieu
        WHERE TenPhong = @TenPhong
      `);

    if (kiemTraPhong.recordset.length > 0) {
      await transaction.rollback();
      daBatDau = false;

      return res.status(400).json({
        success: false,
        message: "Tên phòng đã tồn tại!",
      });
    }

    // Thêm phòng chiếu
    const resultPhong = await new sql.Request(transaction)
      .input("TenPhong", sql.NVarChar(100), tenPhong.trim())
      .input("SoLuongGhe", sql.Int, tongSoGhe).query(`
        INSERT INTO PhongChieu (TenPhong, SoLuongGhe)
        OUTPUT INSERTED.MaPhong
        VALUES (@TenPhong, @SoLuongGhe)
      `);

    const maPhong = resultPhong.recordset[0].MaPhong;

    // Tạo từng hàng ghế và các ghế tương ứng
    for (const hang of hangGhe) {
      const tenHang = hang.tenHang.trim().toUpperCase();
      const loaiGhe = hang.loaiGhe;
      const soLuongGhe = Number(hang.soLuongGhe);

      // Thêm hàng ghế
      const resultHang = await new sql.Request(transaction)
        .input("MaPhong", sql.Int, maPhong)
        .input("TenHang", sql.NVarChar(10), tenHang)
        .input("LoaiGhe", sql.NVarChar(50), loaiGhe).query(`
          INSERT INTO HangGhe (MaPhong, TenHang, LoaiGhe)
          OUTPUT INSERTED.MaHang
          VALUES (@MaPhong, @TenHang, @LoaiGhe)
        `);

      const maHang = resultHang.recordset[0].MaHang;

      // Tạo từng ghế
      for (let i = 1; i <= soLuongGhe; i++) {
        const soGhe = `${tenHang}${i}`;

        await new sql.Request(transaction)
          .input("MaPhong", sql.Int, maPhong)
          .input("MaHang", sql.Int, maHang)
          .input("SoGhe", sql.NVarChar(10), soGhe)
          .input("LoaiGhe", sql.NVarChar(50), loaiGhe).query(`
            INSERT INTO Ghe (MaPhong, MaHang, SoGhe, LoaiGhe)
            VALUES (@MaPhong, @MaHang, @SoGhe, @LoaiGhe)
          `);
      }
    }

    await transaction.commit();
    daBatDau = false;

    return res.status(201).json({
      success: true,
      message: "Thêm phòng chiếu thành công!",
      maPhong: maPhong,
      tongSoGhe: tongSoGhe,
    });
  } catch (error) {
    if (daBatDau) {
      await transaction.rollback();
    }

    console.error("LỖI THÊM PHÒNG:", error);

    return res.status(500).json({
      success: false,
      message: "Lỗi thêm phòng chiếu!",
      error: error.message,
    });
  }
});

app.get("/api/dichvu", async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT MaDichVu, TenDichVu, Gia
      FROM DichVu
      ORDER BY MaDichVu DESC
    `);

    res.json({
      success: true,
      data: result.recordset,
    });
  } catch (error) {
    console.error("LỖI LẤY DỊCH VỤ:", error);

    res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách dịch vụ!",
    });
  }
});

app.post("/api/dichvu", async (req, res) => {
  try {
    const tenDichVu = String(req.body.tenDichVu || "").trim();
    const gia = Number(req.body.gia);

    if (!tenDichVu || tenDichVu.length > 255) {
      return res.status(400).json({
        success: false,
        message: "Tên dịch vụ không hợp lệ!",
      });
    }

    if (!Number.isFinite(gia) || gia < 0) {
      return res.status(400).json({
        success: false,
        message: "Giá dịch vụ phải là số dương",
      });
    }

    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("TenDichVu", sql.NVarChar(255), tenDichVu)
      .input("Gia", sql.Decimal(12, 2), gia).query(`
        INSERT INTO DichVu (TenDichVu, Gia)
        OUTPUT INSERTED.MaDichVu,
               INSERTED.TenDichVu,
               INSERTED.Gia
        VALUES (@TenDichVu, @Gia)
      `);

    res.status(201).json({
      success: true,
      message: "Thêm dịch vụ thành công!",
      data: result.recordset[0],
    });
  } catch (error) {
    console.error("LỖI THÊM DỊCH VỤ:", error);

    res.status(500).json({
      success: false,
      message: "Không thể thêm dịch vụ!",
      error: error.message,
    });
  }
});

app.put("/api/dichvu/:id", async (req, res) => {
  try {
    const maDichVu = Number(req.params.id);
    const tenDichVu = String(req.body.tenDichVu || "").trim();
    const gia = Number(req.body.gia);

    if (!Number.isInteger(maDichVu) || maDichVu <= 0) {
      return res.status(400).json({
        success: false,
        message: "Mã dịch vụ không hợp lệ!",
      });
    }

    if (!tenDichVu || tenDichVu.length > 255) {
      return res.status(400).json({
        success: false,
        message: "Tên dịch vụ không hợp lệ!",
      });
    }

    if (!Number.isFinite(gia) || gia < 0) {
      return res.status(400).json({
        success: false,
        message: "Giá dịch vụ phải là số dương",
      });
    }

    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("MaDichVu", sql.Int, maDichVu)
      .input("TenDichVu", sql.NVarChar(255), tenDichVu)
      .input("Gia", sql.Decimal(12, 2), gia).query(`
        UPDATE DichVu
        SET TenDichVu = @TenDichVu,
            Gia = @Gia
        WHERE MaDichVu = @MaDichVu
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy dịch vụ!",
      });
    }

    res.json({
      success: true,
      message: "Cập nhật dịch vụ thành công!",
    });
  } catch (error) {
    console.error("LỖI SỬA DỊCH VỤ:", error);

    res.status(500).json({
      success: false,
      message: "Không thể cập nhật dịch vụ!",
      error: error.message,
    });
  }
});

app.delete("/api/dichvu/:id", async (req, res) => {
  try {
    const maDichVu = Number(req.params.id);

    if (!Number.isInteger(maDichVu) || maDichVu <= 0) {
      return res.status(400).json({
        success: false,
        message: "Mã dịch vụ không hợp lệ!",
      });
    }

    const pool = await poolPromise;

    const result = await pool.request().input("MaDichVu", sql.Int, maDichVu)
      .query(`
        DELETE FROM DichVu
        WHERE MaDichVu = @MaDichVu
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy dịch vụ!",
      });
    }

    res.json({
      success: true,
      message: "Xóa dịch vụ thành công!",
    });
  } catch (error) {
    console.error("LỖI XÓA DỊCH VỤ:", error);

    // Dịch vụ đang được sử dụng trong ChiTietDichVu
    if (error.number === 547) {
      return res.status(409).json({
        success: false,
        message: "Dịch vụ đã được sử dụng trong đơn đặt vé, không thể xóa!",
      });
    }

    res.status(500).json({
      success: false,
      message: "Không thể xóa dịch vụ!",
      error: error.message,
    });
  }
});
async function startServer() {
  await docDieuKhoan();

  app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
  });
}

startServer();
