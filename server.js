const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

// Buat direktori uploads jika belum ada (rekursif)
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: function(req, file, cb) {
    const safeName = Date.now() + '-' + path.basename(file.originalname);
    cb(null, safeName);
  }
});

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['text/plain', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file teks (.txt), PDF (.pdf), dan Word (.docx) yang diizinkan'), false);
    }
  }
});

app.use(express.static('public'));

app.post('/upload', upload.single('document'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Tidak ada file yang diunggah' });
  }

  const filePath = req.file.path;
  const mimetype = req.file.mimetype;

  try {
    let data = '';

    if (mimetype === 'text/plain') {
      data = await fs.promises.readFile(filePath, 'utf8');
    } else if (mimetype === 'application/pdf') {
      const pdfBuffer = await fs.promises.readFile(filePath);
      const pdfData = await pdfParse(pdfBuffer);
      data = pdfData.text;
    } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const docBuffer = await fs.promises.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer: docBuffer });
      data = result.value;
    } else {
      throw new Error('Tipe file tidak didukung');
    }

    // Hapus file setelah selesai dibaca
    fs.unlink(filePath, (unlinkErr) => {
      if (unlinkErr) console.error('Gagal menghapus file:', unlinkErr);
    });

    res.json({ content: data });
  } catch (err) {
    console.error('Gagal membaca file:', err);
    return res.status(500).json({ error: 'Gagal membaca file' });
  }
});

// Tangani error dari multer
app.use((err, req, res, next) => {
  console.error('Error handler caught error:', err);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});