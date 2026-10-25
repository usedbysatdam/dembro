/* Soal EC Games: mc (pilihan ganda), ox (benar/salah), fill (isian singkat) */
window.QUIZ_QUESTIONS = [
  { type: "mc", q: "Topologi jaringan yang semua komputer terhubung ke hub/switch pusat?", opts: ["Star", "Ring", "Bus", "Mesh"], answer: 0 },
  { type: "mc", q: "Perangkat yang menghubungkan dua jaringan berbeda dan memilih jalur terbaik?", opts: ["Hub", "Router", "Kabel UTP", "NIC"], answer: 1 },
  { type: "ox", q: "Fotosintesis terjadi di daun.", opts: ["Benar", "Salah"], answer: 0 },
  { type: "mc", q: "Bagian tumbuhan tempat fotosintesis terjadi?", opts: ["Akar", "Batang", "Daun", "Bunga"], answer: 2 },
  { type: "fill", q: "Zat hijau daun yang menangkap cahaya matahari disebut?", text: "klorofil", hint: "Diawali huruf K..." },
  { type: "mc", q: "Planet terdekat dari Matahari?", opts: ["Venus", "Mars", "Merkurius", "Jupiter"], answer: 2 },
  { type: "ox", q: "Air mendidih pada suhu 90°C di tekanan normal.", opts: ["Benar", "Salah"], answer: 1 },
  { type: "fill", q: "Satuan dasar penyusun makhluk hidup?", text: "sel", hint: "3 huruf, diawali S..." },
  { type: "mc", q: "Gaya yang menarik benda jatuh ke bumi disebut gaya?", opts: ["Gesek", "Magnet", "Gravitasi", "Otot"], answer: 2 },
  { type: "mc", q: "Lapisan bumi tempat manusia tinggal?", opts: ["Inti", "Mantel", "Kerak", "Astenosfer"], answer: 2 },
  { type: "fill", q: "IP address versi 4 terdiri dari berapa oktet?", text: "4", hint: "Angka antara 2 dan 6..." },
  { type: "mc", q: "IP address versi 4 terdiri dari berapa oktet?", opts: ["2", "4", "6", "8"], answer: 1 },
];
window.QUIZ_TIME_PER_Q = 15;
