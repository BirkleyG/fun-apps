export type Book = {
  name: string;
  abbr: string;
  chapterCount: number;
};

export type PlanType = "asWritten" | "chronological";

export const books: Book[] = [
  { name: "Genesis", abbr: "GEN", chapterCount: 50 },
  { name: "Exodus", abbr: "EXO", chapterCount: 40 },
  { name: "Leviticus", abbr: "LEV", chapterCount: 27 },
  { name: "Numbers", abbr: "NUM", chapterCount: 36 },
  { name: "Deuteronomy", abbr: "DEU", chapterCount: 34 },
  { name: "Joshua", abbr: "JOS", chapterCount: 24 },
  { name: "Judges", abbr: "JDG", chapterCount: 21 },
  { name: "Ruth", abbr: "RUT", chapterCount: 4 },
  { name: "1 Samuel", abbr: "1SA", chapterCount: 31 },
  { name: "2 Samuel", abbr: "2SA", chapterCount: 24 },
  { name: "1 Kings", abbr: "1KI", chapterCount: 22 },
  { name: "2 Kings", abbr: "2KI", chapterCount: 25 },
  { name: "1 Chronicles", abbr: "1CH", chapterCount: 29 },
  { name: "2 Chronicles", abbr: "2CH", chapterCount: 36 },
  { name: "Ezra", abbr: "EZR", chapterCount: 10 },
  { name: "Nehemiah", abbr: "NEH", chapterCount: 13 },
  { name: "Esther", abbr: "EST", chapterCount: 10 },
  { name: "Job", abbr: "JOB", chapterCount: 42 },
  { name: "Psalms", abbr: "PSA", chapterCount: 150 },
  { name: "Proverbs", abbr: "PRO", chapterCount: 31 },
  { name: "Ecclesiastes", abbr: "ECC", chapterCount: 12 },
  { name: "Song of Songs", abbr: "SNG", chapterCount: 8 },
  { name: "Isaiah", abbr: "ISA", chapterCount: 66 },
  { name: "Jeremiah", abbr: "JER", chapterCount: 52 },
  { name: "Lamentations", abbr: "LAM", chapterCount: 5 },
  { name: "Ezekiel", abbr: "EZK", chapterCount: 48 },
  { name: "Daniel", abbr: "DAN", chapterCount: 12 },
  { name: "Hosea", abbr: "HOS", chapterCount: 14 },
  { name: "Joel", abbr: "JOL", chapterCount: 3 },
  { name: "Amos", abbr: "AMO", chapterCount: 9 },
  { name: "Obadiah", abbr: "OBA", chapterCount: 1 },
  { name: "Jonah", abbr: "JON", chapterCount: 4 },
  { name: "Micah", abbr: "MIC", chapterCount: 7 },
  { name: "Nahum", abbr: "NAM", chapterCount: 3 },
  { name: "Habakkuk", abbr: "HAB", chapterCount: 3 },
  { name: "Zephaniah", abbr: "ZEP", chapterCount: 3 },
  { name: "Haggai", abbr: "HAG", chapterCount: 2 },
  { name: "Zechariah", abbr: "ZEC", chapterCount: 14 },
  { name: "Malachi", abbr: "MAL", chapterCount: 4 },
  { name: "Matthew", abbr: "MAT", chapterCount: 28 },
  { name: "Mark", abbr: "MRK", chapterCount: 16 },
  { name: "Luke", abbr: "LUK", chapterCount: 24 },
  { name: "John", abbr: "JHN", chapterCount: 21 },
  { name: "Acts", abbr: "ACT", chapterCount: 28 },
  { name: "Romans", abbr: "ROM", chapterCount: 16 },
  { name: "1 Corinthians", abbr: "1CO", chapterCount: 16 },
  { name: "2 Corinthians", abbr: "2CO", chapterCount: 13 },
  { name: "Galatians", abbr: "GAL", chapterCount: 6 },
  { name: "Ephesians", abbr: "EPH", chapterCount: 6 },
  { name: "Philippians", abbr: "PHP", chapterCount: 4 },
  { name: "Colossians", abbr: "COL", chapterCount: 4 },
  { name: "1 Thessalonians", abbr: "1TH", chapterCount: 5 },
  { name: "2 Thessalonians", abbr: "2TH", chapterCount: 3 },
  { name: "1 Timothy", abbr: "1TI", chapterCount: 6 },
  { name: "2 Timothy", abbr: "2TI", chapterCount: 4 },
  { name: "Titus", abbr: "TIT", chapterCount: 3 },
  { name: "Philemon", abbr: "PHM", chapterCount: 1 },
  { name: "Hebrews", abbr: "HEB", chapterCount: 13 },
  { name: "James", abbr: "JAS", chapterCount: 5 },
  { name: "1 Peter", abbr: "1PE", chapterCount: 5 },
  { name: "2 Peter", abbr: "2PE", chapterCount: 3 },
  { name: "1 John", abbr: "1JN", chapterCount: 5 },
  { name: "2 John", abbr: "2JN", chapterCount: 1 },
  { name: "3 John", abbr: "3JN", chapterCount: 1 },
  { name: "Jude", abbr: "JUD", chapterCount: 1 },
  { name: "Revelation", abbr: "REV", chapterCount: 22 }
];

export const bookByAbbr = Object.fromEntries(books.map((book) => [book.abbr, book] as const));

const pad3 = (value: number) => value.toString().padStart(3, "0");

export const canonicalPlan = books.flatMap((book) =>
  Array.from({ length: book.chapterCount }, (_, index) => `${book.abbr}-${pad3(index + 1)}`)
);

const CHRONOLOGICAL_SOURCE = `
Gen 1-3
Gen 4-7
Gen 8-11
Job 1-5
Job 6-9
Job 10-13
Job 14-16
Job 17-20
Job 21-23
Job 24-28
Job 29-31
Job 32-34
Job 35-37
Job 38-39
Job 40-42
Gen 12-15
Gen 16-18
Gen 19-21
Gen 22-24
Gen 25-26
Gen 27-29
Gen 30-31
Gen 32-34
Gen 35-37
Gen 38-40
Gen 41-42
Gen 43-45
Gen 46-47
Gen 48-50
Exo 1-3
Exo 4-6
Exo 7-9
Exo 10-12
Exo 13-15
Exo 16-18
Exo 19-21
Exo 22-24
Exo 25-27
Exo 28-29
Exo 30-32
Exo 33-35
Exo 36-38
Exo 39-40
Lev 1-4
Lev 5-7
Lev 8-10
Lev 11-13
Lev 14-15
Lev 16-18
Lev 19-21
Lev 22-23
Lev 24-25
Lev 26-27
Num 1-2
Num 3-4
Num 5-6
Num 7
Num 8-10
Num 11-13
Num 14-15
Num 16-17
Num 18-20
Num 21-22
Num 23-25
Num 26-27
Num 28-30
Num 31-32
Num 33-34
Num 35-36
Deu 1-2
Deu 3-4
Deu 5-7
Deu 8-10
Deu 11-13
Deu 14-16
Deu 17-20
Deu 21-23
Deu 24-27
Deu 28-29
Deu 30-31
Deu 32-34 / Psa 90
Jos 1-4
Jos 5-8
Jos 9-11
Jos 12-15
Jos 16-18
Jos 19-21
Jos 22-24
Jdg 1-2
Jdg 3-5
Jdg 6-7
Jdg 8-9
Jdg 10-12
Jdg 13-15
Jdg 16-18
Jdg 19-21
Rth 1-4
1Sa 1-3
1Sa 4-8
1Sa 9-12
1Sa 13-14
1Sa 15-17
1Sa 18-20 / Psa 11, 59
1Sa 21-24 / Psa 91
Psa 7, 27, 31, 34, 52
Psa 56, 120, 140-142
1Sa 25-27
Psa 17, 35, 54, 63
1Sa 28-31 / Psa 18
Psa 121, 123-125, 128-130
2Sa 1-4
Psa 6, 8-10, 14, 16, 19, 21
1Ch 1-2
Psa 43-45, 49, 84-85, 87
1Ch 3-5
Psa 73, 77-78
1Ch 6
Psa 81, 88, 92-93
1Ch 7-10
Psa 102-104
2Sa 5 / 1Ch 11-12
Psa 133
Psa 106-107
1Ch 13-16
Psa 1-2, 15, 22-24, 47, 68
Psa 89, 96, 100-101, 105, 132
2Sa 6-7 / 1Ch 17
Psa 25, 29, 33, 36, 39
2Sa 8-9 / 1Ch 18
Psa 50, 53, 60, 75
2Sa 10 / 1Ch 19 / Psa 20
Psa 65-67, 69-70
2Sa 11-12 / 1Ch 20
Psa 32, 51, 86, 122
2Sa 13-15
Psa 3-4, 12-13, 28, 55
2Sa 16-18
Psa 26, 40, 58, 61-62, 64
2Sa 19-21
Psa 5, 38, 41-42
2Sa 22-23 / Psa 57
Psa 95, 97-99
2Sa 24 / 1Ch 21-22 / Psa 30
Psa 108-110
1Ch 23-25
Psa 131, 138-139, 143-145
1Ch 26-29 / Psa 127
Psa 111-118
1Ki 1-2 / Psa 37, 71, 94
Psa 119
1Ki 3-4
2Ch 1 / Psa 72
Sng 1-8
Pro 1-3
Pro 4-6
Pro 7-9
Pro 10-12
Pro 13-15
Pro 16-18
Pro 19-21
Pro 22-24
1Ki 5-6 / 2Ch 2-3
1Ki 7 / 2Ch 4
1Ki 8 / 2Ch 5
2Ch 6-7 / Psa 136
Psa 134, 146-150
1Ki 9 / 2Ch 8
Pro 25-26
Pro 27-29
Ecc 1-6
Ecc 7-12
1Ki 10-11 / 2Ch 9
Pro 30-31
1Ki 12-14
2Ch 10-12
1Ki 15 / 2Ch 13-16
1Ki 16 / 2Ch 17
1Ki 17-19
1Ki 20-21
1Ki 22 / 2Ch 18
2Ch 19-23
Oba 1 / Psa 82-83
2Ki 1-4
2Ki 5-8
2Ki 9-11
2Ki 12-13 / 2Ch 24
2Ki 14 / 2Ch 25
Jon 1-4
2Ki 15 / 2Ch 26
Isa 1-4
Isa 5-8
Amo 1-5
Amo 6-9
2Ch 27 / Isa 9-12
Mic 1-7
2Ch 28 / 2Ki 16-17
Isa 13-17
Isa 18-22
Isa 23-27
2Ki 18 / 2Ch 29-31 / Psa 48
Hos 1-7
Hos 8-14
Isa 28-30
Isa 31-34
Isa 35-36
Isa 37-39 / Psa 76
Isa 40-43
Isa 44-48
2Ki 19 / Psa 46, 80, 135
Isa 49-53
Isa 54-58
Isa 59-63
Isa 64-66
2Ki 20-21
2Ch 32-33
Nah 1-3
2Ki 22-23 / 2Ch 34-35
Zep 1-3
Jer 1-3
Jer 4-6
Jer 7-9
Jer 10-13
Jer 14-17
Jer 18-22
Jer 23-25
Jer 26-29
Jer 30-31
Jer 32-34
Jer 35-37
Jer 38-40 / Psa 74, 79
2Ki 24-25 / 2Ch 36
Hab 1-3
Jer 41-45
Jer 46-48
Jer 49-50
Jer 51-52
Lam 1-2
Lam 3-5
Eze 1-4
Eze 5-8
Eze 9-12
Eze 13-15
Eze 16-17
Eze 18-20
Eze 21-22
Eze 23-24
Eze 25-27
Eze 28-30
Eze 31-33
Eze 34-36
Eze 37-39
Eze 40-42
Eze 43-45
Eze 46-48
Joe 1-3
Dan 1-3
Dan 4-6
Dan 7-9
Dan 10-12
Ezr 1-3
Ezr 4-6 / Psa 137
Hag 1-2
Zec 1-4
Zec 5-9
Zec 10-14
Est 1-5
Est 6-10
Ezr 7-10
Neh 1-5
Neh 6-7
Neh 8-10
Neh 11-13 / Psa 126
Mal 1-4
Luk 1 / Jhn 1
Mat 1 / Luk 2
Mat 2
Mat 3 / Mar 1 / Luk 3
Mat 4 / Luk 5-5
Jhn 2-4
Mat 8 / Mar 2
Jhn 5
Mat 12 / Mar 3 / Luk 6
Mat 5-7
Mat 9 / Luk 7
Mat 11
Luk 11
Mat 13 / Luk 8
Mar 4-5
Mat 10
Mat 14 / Mar 6 / Luk 9
Jhn 6
Mat 15 / Mar 7
Mat 16 / Mar 8
Mat 17 / Mar 9
Mat 18
Jhn 7-8
Jhn 9-10
Luk 10
Luk 12-13
Luk 14-15
Luk 16-17
Jhn 11
Luk 18
Mat 19 / Mar 10
Mat 20-21
Luk 19
Mar 11 / Jhn 12
Mat 22 / Mar 12
Mat 23 / Luk 20-21
Mar 13
Mat 24
Mat 25
Mat 26 / Mar 14
Luk 22 / Jhn 13
Jhn 14-17
Mat 27 / Mar 15
Luk 23 / Jhn 18-19
Mat 28 / Mar 16
Luk 24 / Jhn 20-21
Act 1-3
Act 4-6
Act 7-8
Act 9-10
Act 11-12
Act 13-14
Jas 1-5
Act 15-16
Gal 1-3
Gal 4-6
Act 17
1Th 1-5 / 2Th 1-3
Act 18-19
1Co 1-4
1Co 5-8
1Co 9-11
1Co 12-14
1Co 15-16
2Co 1-4
2Co 5-9
2Co 10-13
Rom 1-3
Rom 4-7
Rom 8-10
Rom 11-13
Rom 14-16
Act 20-23
Act 24-26
Act 27-28
Co1 1-4 / Phm 1
Eph 1-6
Phl 1-4
1Ti 1-6
Tit 1-3
1Pe 1-5
Heb 1-6
Heb 7-10
Heb 11-13
2Ti 1-4
2Pe 1-3 / Jde 1
1Jo 1-5
2Jo 1 / 3Jo 1
Rev 1-5
Rev 6-11
Rev 12-18
Rev 19-22
`;

const aliasMap: Record<string, string> = {
  gen: "GEN",
  exo: "EXO",
  lev: "LEV",
  num: "NUM",
  deu: "DEU",
  jos: "JOS",
  jdg: "JDG",
  rth: "RUT",
  "1sa": "1SA",
  "2sa": "2SA",
  "1ki": "1KI",
  "2ki": "2KI",
  "1ch": "1CH",
  "2ch": "2CH",
  ezr: "EZR",
  neh: "NEH",
  est: "EST",
  job: "JOB",
  psa: "PSA",
  pro: "PRO",
  ecc: "ECC",
  sng: "SNG",
  isa: "ISA",
  jer: "JER",
  lam: "LAM",
  eze: "EZK",
  dan: "DAN",
  hos: "HOS",
  joe: "JOL",
  jol: "JOL",
  amo: "AMO",
  oba: "OBA",
  jon: "JON",
  mic: "MIC",
  nam: "NAM",
  hab: "HAB",
  zep: "ZEP",
  hag: "HAG",
  zec: "ZEC",
  mal: "MAL",
  mat: "MAT",
  mar: "MRK",
  mrk: "MRK",
  luk: "LUK",
  jhn: "JHN",
  act: "ACT",
  rom: "ROM",
  "1co": "1CO",
  "2co": "2CO",
  gal: "GAL",
  eph: "EPH",
  phl: "PHP",
  php: "PHP",
  col: "COL",
  "1th": "1TH",
  "2th": "2TH",
  "1ti": "1TI",
  "2ti": "2TI",
  tit: "TIT",
  phm: "PHM",
  heb: "HEB",
  jas: "JAS",
  "1pe": "1PE",
  "2pe": "2PE",
  "1jo": "1JN",
  "2jo": "2JN",
  "3jo": "3JN",
  jde: "JUD",
  jud: "JUD",
  rev: "REV"
};

const normalizeBookToken = (token: string) => {
  const trimmed = token.trim().toLowerCase();
  if (trimmed === "co1") return "col";
  return trimmed;
};

const parseChapterList = (abbr: string, chapterText: string) => {
  const chapters: string[] = [];
  const parts = chapterText.split(",");
  for (const part of parts) {
    const cleaned = part.trim();
    if (!cleaned) continue;
    const rangeMatch = cleaned.match(/^(\d+)(?:-(\d+))?$/);
    if (!rangeMatch) continue;
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2] ?? rangeMatch[1]);
    if (Number.isNaN(start) || Number.isNaN(end)) continue;
    const normalizedEnd = end < start ? start : end;
    for (let chapter = start; chapter <= normalizedEnd; chapter += 1) {
      chapters.push(`${abbr}-${pad3(chapter)}`);
    }
  }
  return chapters;
};

const parseChronologicalPlan = (source: string) => {
  const ordered: string[] = [];
  const seen = new Set<string>();
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) =>
      line &&
      !line.toLowerCase().includes("daily bible") &&
      !line.startsWith("[")
    );

  for (const line of lines) {
    const segments = line.split("/");
    for (const segment of segments) {
      const trimmed = segment.trim();
      if (!trimmed) continue;
      const match = trimmed.match(/^([0-9]?[A-Za-z]{2,3})\s+(.+)$/);
      if (!match) continue;
      const token = normalizeBookToken(match[1]);
      const abbr = aliasMap[token];
      if (!abbr) continue;
      const chapterText = match[2].replace(/\s+/g, " ");
      const chapterIds = parseChapterList(abbr, chapterText);
      for (const chapterId of chapterIds) {
        if (seen.has(chapterId)) continue;
        seen.add(chapterId);
        ordered.push(chapterId);
      }
    }
  }

  return ordered;
};

export const chronologicalPlan = parseChronologicalPlan(CHRONOLOGICAL_SOURCE);

export const plans: Record<PlanType, string[]> = {
  asWritten: canonicalPlan,
  chronological: chronologicalPlan
};

export const getChapterLabel = (chapterId: string) => {
  const [abbr, rawChapter] = chapterId.split("-");
  const chapterNumber = Number(rawChapter);
  const book = bookByAbbr[abbr];
  if (!book) return chapterId;
  return `${book.name} ${chapterNumber}`;
};
