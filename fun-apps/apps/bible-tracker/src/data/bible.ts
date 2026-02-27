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

const pad3 = (value: number) => value.toString().padStart(3, "0");

const asWritten = books.flatMap((book) =>
  Array.from({ length: book.chapterCount }, (_, index) => `${book.abbr}-${pad3(index + 1)}`)
);

const chronological = asWritten; // TODO: Replace with actual chronological plan.

export const plans: Record<PlanType, string[]> = {
  asWritten,
  chronological
};
