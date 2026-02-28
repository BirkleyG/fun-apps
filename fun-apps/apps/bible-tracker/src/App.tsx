// @ts-nocheck
import { useState, useEffect, useRef } from "react";

const storage = {
  get: async (key) => ({ value: localStorage.getItem(key) }),
  set: async (key, value) => {
    localStorage.setItem(key, value);
    return true;
  }
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ICONS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const Icon = ({ type, size = 18, color = "currentColor", strokeWidth = 1.75 }) => {
  const p = { fill:"none", stroke:color, strokeWidth, strokeLinecap:"round", strokeLinejoin:"round", viewBox:"0 0 24 24", width:size, height:size, display:"inline-block", verticalAlign:"middle", flexShrink:0 };
  switch(type) {
    case "book":     return <svg {...p}><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><line x1="4" y1="11" x2="20" y2="11"/></svg>;
    case "chart":    return <svg {...p}><rect x="3" y="12" width="4" height="8" rx="0.5"/><rect x="10" y="7" width="4" height="13" rx="0.5"/><rect x="17" y="3" width="4" height="17" rx="0.5"/></svg>;
    case "settings": return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>;
    case "check-circle": return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-5"/></svg>;
    case "plus":     return <svg {...p}><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>;
    case "bookmark": return <svg {...p}><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>;
    case "trophy":   return <svg {...p}><path d="M8 21h8M12 17v4"/><path d="M7 4H4v4c0 2.2 1.3 4 3 4.5"/><path d="M17 4h3v4c0 2.2-1.3 4-3 4.5"/><path d="M7 4h10v7a5 5 0 01-10 0V4z"/></svg>;
    case "flame":    return <svg {...p}><path d="M8.5 14.5A2.5 2.5 0 0011 17c1.5 0 3-1 3-3 0-1.5-.8-2.5-2-3 .5 2-1 3-1.5 3.5-.5-.7-.5-1.5.5-3-1.5.5-2.5 2-2.5 3z"/><path d="M12 2c0 3.5-2.5 5-3.5 7.5C7.5 11.5 8 13 8.5 14.5"/><path d="M12 2c0 3.5 2.5 5 3.5 7.5.5 2 0 3.5-.5 5"/><path d="M8.5 14.5C7.5 16 7 18 8.5 20c1 1.3 2.5 2 3.5 2s2.5-.7 3.5-2c1.5-2 1-4-.5-5.5"/></svg>;
    case "calendar": return <svg {...p}><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
    case "chevron-down":  return <svg {...p}><polyline points="6 9 12 15 18 9"/></svg>;
    case "chevron-right": return <svg {...p}><polyline points="9 18 15 12 9 6"/></svg>;
    case "x":        return <svg {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
    case "share":    return <svg {...p}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>;
    case "drag":     return <svg {...p} fill={color} stroke="none"><circle cx="9" cy="5" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="9" cy="19" r="1.2"/><circle cx="15" cy="5" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="15" cy="19" r="1.2"/></svg>;
    case "moon":     return <svg {...p}><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>;
    case "sun":      return <svg {...p}><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;
    case "arrow-right": return <svg {...p}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;
    case "target":   return <svg {...p}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.5" fill={color}/></svg>;
    case "clock":    return <svg {...p}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>;
    case "link":     return <svg {...p}><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>;
    case "check":    return <svg {...p}><polyline points="20 6 9 17 4 12"/></svg>;
    case "alert":    return <svg {...p}><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
    case "trending": return <svg {...p}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>;
    case "filter":   return <svg {...p}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>;
    case "list":     return <svg {...p}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
    case "audio":    return <svg {...p}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M19.07 4.93a10 10 0 010 14.14"/></svg>;
    case "undo":     return <svg {...p}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.96"/></svg>;
    default: return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="2"/></svg>;
  }
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// BIBLE DATA
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BIBLE_BOOKS = [
  {name:"Genesis",chapters:50,testament:"OT",category:"pentateuch"},
  {name:"Exodus",chapters:40,testament:"OT",category:"pentateuch"},
  {name:"Leviticus",chapters:27,testament:"OT",category:"pentateuch"},
  {name:"Numbers",chapters:36,testament:"OT",category:"pentateuch"},
  {name:"Deuteronomy",chapters:34,testament:"OT",category:"pentateuch"},
  {name:"Joshua",chapters:24,testament:"OT",category:"historical"},
  {name:"Judges",chapters:21,testament:"OT",category:"historical"},
  {name:"Ruth",chapters:4,testament:"OT",category:"historical"},
  {name:"1 Samuel",chapters:31,testament:"OT",category:"historical"},
  {name:"2 Samuel",chapters:24,testament:"OT",category:"historical"},
  {name:"1 Kings",chapters:22,testament:"OT",category:"historical"},
  {name:"2 Kings",chapters:25,testament:"OT",category:"historical"},
  {name:"1 Chronicles",chapters:29,testament:"OT",category:"historical"},
  {name:"2 Chronicles",chapters:36,testament:"OT",category:"historical"},
  {name:"Ezra",chapters:10,testament:"OT",category:"historical"},
  {name:"Nehemiah",chapters:13,testament:"OT",category:"historical"},
  {name:"Esther",chapters:10,testament:"OT",category:"historical"},
  {name:"Job",chapters:42,testament:"OT",category:"wisdom"},
  {name:"Psalms",chapters:150,testament:"OT",category:"wisdom"},
  {name:"Proverbs",chapters:31,testament:"OT",category:"wisdom"},
  {name:"Ecclesiastes",chapters:12,testament:"OT",category:"wisdom"},
  {name:"Song of Solomon",chapters:8,testament:"OT",category:"wisdom"},
  {name:"Isaiah",chapters:66,testament:"OT",category:"major-prophets"},
  {name:"Jeremiah",chapters:52,testament:"OT",category:"major-prophets"},
  {name:"Lamentations",chapters:5,testament:"OT",category:"major-prophets"},
  {name:"Ezekiel",chapters:48,testament:"OT",category:"major-prophets"},
  {name:"Daniel",chapters:12,testament:"OT",category:"major-prophets"},
  {name:"Hosea",chapters:14,testament:"OT",category:"minor-prophets"},
  {name:"Joel",chapters:3,testament:"OT",category:"minor-prophets"},
  {name:"Amos",chapters:9,testament:"OT",category:"minor-prophets"},
  {name:"Obadiah",chapters:1,testament:"OT",category:"minor-prophets"},
  {name:"Jonah",chapters:4,testament:"OT",category:"minor-prophets"},
  {name:"Micah",chapters:7,testament:"OT",category:"minor-prophets"},
  {name:"Nahum",chapters:3,testament:"OT",category:"minor-prophets"},
  {name:"Habakkuk",chapters:3,testament:"OT",category:"minor-prophets"},
  {name:"Zephaniah",chapters:3,testament:"OT",category:"minor-prophets"},
  {name:"Haggai",chapters:2,testament:"OT",category:"minor-prophets"},
  {name:"Zechariah",chapters:14,testament:"OT",category:"minor-prophets"},
  {name:"Malachi",chapters:4,testament:"OT",category:"minor-prophets"},
  {name:"Matthew",chapters:28,testament:"NT",category:"gospels"},
  {name:"Mark",chapters:16,testament:"NT",category:"gospels"},
  {name:"Luke",chapters:24,testament:"NT",category:"gospels"},
  {name:"John",chapters:21,testament:"NT",category:"gospels"},
  {name:"Acts",chapters:28,testament:"NT",category:"acts"},
  {name:"Romans",chapters:16,testament:"NT",category:"pauline"},
  {name:"1 Corinthians",chapters:16,testament:"NT",category:"pauline"},
  {name:"2 Corinthians",chapters:13,testament:"NT",category:"pauline"},
  {name:"Galatians",chapters:6,testament:"NT",category:"pauline"},
  {name:"Ephesians",chapters:6,testament:"NT",category:"pauline"},
  {name:"Philippians",chapters:4,testament:"NT",category:"pauline"},
  {name:"Colossians",chapters:4,testament:"NT",category:"pauline"},
  {name:"1 Thessalonians",chapters:5,testament:"NT",category:"pauline"},
  {name:"2 Thessalonians",chapters:3,testament:"NT",category:"pauline"},
  {name:"1 Timothy",chapters:6,testament:"NT",category:"pauline"},
  {name:"2 Timothy",chapters:4,testament:"NT",category:"pauline"},
  {name:"Titus",chapters:3,testament:"NT",category:"pauline"},
  {name:"Philemon",chapters:1,testament:"NT",category:"pauline"},
  {name:"Hebrews",chapters:13,testament:"NT",category:"general-epistles"},
  {name:"James",chapters:5,testament:"NT",category:"general-epistles"},
  {name:"1 Peter",chapters:5,testament:"NT",category:"general-epistles"},
  {name:"2 Peter",chapters:3,testament:"NT",category:"general-epistles"},
  {name:"1 John",chapters:5,testament:"NT",category:"general-epistles"},
  {name:"2 John",chapters:1,testament:"NT",category:"general-epistles"},
  {name:"3 John",chapters:1,testament:"NT",category:"general-epistles"},
  {name:"Jude",chapters:1,testament:"NT",category:"general-epistles"},
  {name:"Revelation",chapters:22,testament:"NT",category:"revelation"},
];

const BOOK_CATS = {
  all:               {label:"All Books"},
  ot:                {label:"Old Testament"},
  nt:                {label:"New Testament"},
  pentateuch:        {label:"Pentateuch"},
  historical:        {label:"Historical"},
  wisdom:            {label:"Wisdom & Poetry"},
  "major-prophets":  {label:"Major Prophets"},
  "minor-prophets":  {label:"Minor Prophets"},
  gospels:           {label:"Gospels"},
  pauline:           {label:"Pauline Epistles"},
  "general-epistles":{label:"General Epistles"},
};

function catFilter(b, cat) {
  if (cat==="all") return true;
  if (cat==="ot") return b.testament==="OT";
  if (cat==="nt") return b.testament==="NT";
  return b.category===cat;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// CHRONOLOGICAL PLAN â€” exact interleaved order from the provided document
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function buildChronPlan() {
  // ch(book, ...nums) â†’ specific chapters
  const ch = (book, ...nums) => nums.map(n => `${book} ${n}`);
  // all(name) â†’ every chapter of a book
  const all = name => { const b=BIBLE_BOOKS.find(x=>x.name===name); return b?Array.from({length:b.chapters},(_,i)=>`${name} ${i+1}`):[];};
  // ps(n) â†’ "Psalms N" (matches BIBLE_BOOKS name "Psalms")
  const ps = (...nums) => nums.map(n=>`Psalms ${n}`);

  return [
    // Genesis 1-11, then Job, then Genesis 12-50
    ...ch("Genesis",1,2,3,4,5,6,7,8,9,10,11),
    ...all("Job"),
    ...ch("Genesis",12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50),
    ...all("Exodus"),
    ...all("Leviticus"),
    ...all("Numbers"),
    ...all("Deuteronomy"), ...ps(90),
    ...all("Joshua"),
    ...all("Judges"),
    ...all("Ruth"),
    // 1 Samuel interspersed with Psalms
    ...ch("1 Samuel",1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20), ...ps(11,59),
    ...ch("1 Samuel",21,22,23,24), ...ps(91),
    ...ps(7,27,31,34,52),
    ...ps(56,120,140,141,142),
    ...ch("1 Samuel",25,26,27),
    ...ps(17,35,54,63),
    ...ch("1 Samuel",28,29,30,31), ...ps(18),
    ...ps(121,123,124,125,128,129,130),
    ...ch("2 Samuel",1,2,3,4),
    ...ps(6,8,9,10,14,16,19,21),
    ...ch("1 Chronicles",1,2),
    ...ps(43,44,45,49,84,85,87),
    ...ch("1 Chronicles",3,4,5),
    ...ps(73,77,78),
    "1 Chronicles 6",
    ...ps(81,88,92,93),
    ...ch("1 Chronicles",7,8,9,10),
    ...ps(102,103,104),
    "2 Samuel 5","1 Chronicles 11","1 Chronicles 12", ...ps(133),
    ...ps(106,107),
    ...ch("1 Chronicles",13,14,15,16),
    ...ps(1,2,15,22,23,24,47,68),
    ...ps(89,96,100,101,105,132),
    "2 Samuel 6","2 Samuel 7","1 Chronicles 17",
    ...ps(25,29,33,36,39),
    "2 Samuel 8","2 Samuel 9","1 Chronicles 18",
    ...ps(50,53,60,75),
    "2 Samuel 10","1 Chronicles 19", ...ps(20),
    ...ps(65,66,67,69,70),
    "2 Samuel 11","2 Samuel 12","1 Chronicles 20",
    ...ps(32,51,86,122),
    "2 Samuel 13","2 Samuel 14","2 Samuel 15",
    ...ps(3,4,12,13,28,55),
    "2 Samuel 16","2 Samuel 17","2 Samuel 18",
    ...ps(26,40,58,61,62,64),
    "2 Samuel 19","2 Samuel 20","2 Samuel 21",
    ...ps(5,38,41,42),
    "2 Samuel 22","2 Samuel 23", ...ps(57),
    ...ps(95,97,98,99),
    "2 Samuel 24","1 Chronicles 21","1 Chronicles 22", ...ps(30),
    ...ps(108,109,110),
    ...ch("1 Chronicles",23,24,25),
    ...ps(131,138,139,143,144,145),
    ...ch("1 Chronicles",26,27,28,29), ...ps(127),
    ...ps(111,112,113,114,115,116,117,118),
    "1 Kings 1","1 Kings 2", ...ps(37,71,94),
    ...ps(119),
    "1 Kings 3","1 Kings 4",
    "2 Chronicles 1", ...ps(72),
    ...all("Song of Solomon"),
    ...ch("Proverbs",1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24),
    "1 Kings 5","1 Kings 6","2 Chronicles 2","2 Chronicles 3",
    "1 Kings 7","2 Chronicles 4",
    "1 Kings 8","2 Chronicles 5",
    "2 Chronicles 6","2 Chronicles 7", ...ps(136),
    ...ps(134,146,147,148,149,150),
    "1 Kings 9","2 Chronicles 8",
    ...ch("Proverbs",25,26,27,28,29),
    ...all("Ecclesiastes"),
    "1 Kings 10","1 Kings 11","2 Chronicles 9",
    "Proverbs 30","Proverbs 31",
    "1 Kings 12","1 Kings 13","1 Kings 14",
    "2 Chronicles 10","2 Chronicles 11","2 Chronicles 12",
    "1 Kings 15","2 Chronicles 13","2 Chronicles 14","2 Chronicles 15","2 Chronicles 16",
    "1 Kings 16","2 Chronicles 17",
    "1 Kings 17","1 Kings 18","1 Kings 19",
    "1 Kings 20","1 Kings 21",
    "1 Kings 22","2 Chronicles 18",
    "2 Chronicles 19","2 Chronicles 20","2 Chronicles 21","2 Chronicles 22","2 Chronicles 23",
    "Obadiah 1", ...ps(82,83),
    ...ch("2 Kings",1,2,3,4,5,6,7,8,9,10,11,12,13), "2 Chronicles 24",
    "2 Kings 14","2 Chronicles 25",
    ...all("Jonah"),
    "2 Kings 15","2 Chronicles 26",
    ...ch("Isaiah",1,2,3,4,5,6,7,8),
    ...all("Amos"),
    "2 Chronicles 27","Isaiah 9","Isaiah 10","Isaiah 11","Isaiah 12",
    ...all("Micah"),
    "2 Chronicles 28","2 Kings 16","2 Kings 17",
    ...ch("Isaiah",13,14,15,16,17,18,19,20,21,22,23,24,25,26,27),
    "2 Kings 18","2 Chronicles 29","2 Chronicles 30","2 Chronicles 31", ...ps(48),
    ...all("Hosea"),
    ...ch("Isaiah",28,29,30,31,32,33,34,35,36,37,38,39), ...ps(76),
    ...ch("Isaiah",40,41,42,43,44,45,46,47,48),
    "2 Kings 19", ...ps(46,80,135),
    ...ch("Isaiah",49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66),
    "2 Kings 20","2 Kings 21",
    "2 Chronicles 32","2 Chronicles 33",
    ...all("Nahum"),
    "2 Kings 22","2 Kings 23","2 Chronicles 34","2 Chronicles 35",
    ...all("Zephaniah"),
    // Jeremiah split by 2 Kings 24-25 / Habakkuk
    ...ch("Jeremiah",1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40),
    ...ps(74,79),
    "2 Kings 24","2 Kings 25","2 Chronicles 36",
    ...all("Habakkuk"),
    ...ch("Jeremiah",41,42,43,44,45,46,47,48,49,50,51,52),
    ...all("Lamentations"),
    ...all("Ezekiel"),
    ...all("Joel"),
    ...all("Daniel"),
    ...ch("Ezra",1,2,3,4,5,6), ...ps(137),
    ...all("Haggai"),
    ...all("Zechariah"),
    ...all("Esther"),
    ...ch("Ezra",7,8,9,10),
    ...ch("Nehemiah",1,2,3,4,5,6,7,8,9,10,11,12,13), ...ps(126),
    ...all("Malachi"),
    // New Testament â€” interleaved Gospels
    "Luke 1","John 1",
    "Matthew 1","Luke 2",
    "Matthew 2",
    "Matthew 3","Mark 1","Luke 3",
    "Matthew 4","Luke 4","Luke 5",
    "John 2","John 3","John 4",
    "Matthew 8","Mark 2",
    "John 5",
    "Matthew 12","Mark 3","Luke 6",
    "Matthew 5","Matthew 6","Matthew 7",
    "Matthew 9","Luke 7",
    "Matthew 11",
    "Luke 11",
    "Matthew 13","Luke 8",
    "Mark 4","Mark 5",
    "Matthew 10",
    "Matthew 14","Mark 6","Luke 9",
    "John 6",
    "Matthew 15","Mark 7",
    "Matthew 16","Mark 8",
    "Matthew 17","Mark 9",
    "Matthew 18",
    "John 7","John 8",
    "John 9","John 10",
    "Luke 10",
    "Luke 12","Luke 13",
    "Luke 14","Luke 15",
    "Luke 16","Luke 17",
    "John 11",
    "Luke 18",
    "Matthew 19","Mark 10",
    "Matthew 20","Matthew 21",
    "Luke 19",
    "Mark 11","John 12",
    "Matthew 22","Mark 12",
    "Matthew 23","Luke 20","Luke 21",
    "Mark 13",
    "Matthew 24",
    "Matthew 25",
    "Matthew 26","Mark 14",
    "Luke 22","John 13",
    "John 14","John 15","John 16","John 17",
    "Matthew 27","Mark 15",
    "Luke 23","John 18","John 19",
    "Matthew 28","Mark 16",
    "Luke 24","John 20","John 21",
    // Acts â€” interspersed with epistles
    ...ch("Acts",1,2,3,4,5,6,7,8,9,10,11,12,13,14),
    ...all("James"),
    ...ch("Acts",15,16),
    ...all("Galatians"),
    "Acts 17",
    ...all("1 Thessalonians"), ...all("2 Thessalonians"),
    ...ch("Acts",18,19),
    ...all("1 Corinthians"),
    ...all("2 Corinthians"),
    ...all("Romans"),
    ...ch("Acts",20,21,22,23,24,25,26,27,28),
    ...all("Colossians"), ...all("Philemon"),
    ...all("Ephesians"),
    ...all("Philippians"),
    ...all("1 Timothy"),
    ...all("Titus"),
    ...all("1 Peter"),
    ...all("Hebrews"),
    ...all("2 Timothy"),
    ...all("2 Peter"), ...all("Jude"),
    ...all("1 John"),
    ...all("2 John"), ...all("3 John"),
    ...all("Revelation"),
  ];
}

function getBooksForType(type) {
  if (type==="canonical") return BIBLE_BOOKS.map(b=>b.name);
  if (type==="nt") return BIBLE_BOOKS.filter(b=>b.testament==="NT").map(b=>b.name);
  if (type==="ot") return BIBLE_BOOKS.filter(b=>b.testament==="OT").map(b=>b.name);
  if (type==="gospels") return ["Matthew","Mark","Luke","John"];
  return [];
}

function buildChapters(bookNames) {
  const out = [];
  bookNames.forEach(n => {
    const b = BIBLE_BOOKS.find(x=>x.name===n);
    if (b) for (let i=1;i<=b.chapters;i++) out.push(`${n} ${i}`);
  });
  return out;
}

// Central chapter list builder â€” handles chronological specially
function getChapterList(type, customBooks=[]) {
  if (type==="chronological") return buildChronPlan();
  if (type==="custom") return buildChapters(customBooks.filter(b=>b.selected).map(b=>b.name));
  return buildChapters(getBooksForType(type));
}

function todayStr() { return new Date().toISOString().slice(0,10); }
function fmtDate(d) { try { return new Date(d+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); } catch(e){return d;} }
function getBook(ch) { const p=ch.split(" "); return p.slice(0,-1).join(" "); }

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// CHOIR SOUND â€” "Ahh-AHHH!"
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function playChoir() {
  try {
    const ctx = new (window.AudioContext||window.webkitAudioContext)();

    const makeVoice = (fund, detuneCents, startT, endT, peakGain) => {
      const osc   = ctx.createOscillator();
      const gain  = ctx.createGain();
      const f1    = ctx.createBiquadFilter(); // "Ah" formant ~800 Hz
      const f2    = ctx.createBiquadFilter(); // brightness ~1200 Hz
      const vib   = ctx.createOscillator();  // vibrato LFO
      const vibG  = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.value = fund * Math.pow(2, detuneCents/1200);

      // Vibrato
      vib.frequency.value = 5.2;
      vibG.gain.value = 3.5;
      vib.connect(vibG);
      vibG.connect(osc.frequency);

      // Formants (simulate "Ah" vowel)
      f1.type = "bandpass"; f1.frequency.value = 800;  f1.Q.value = 4.5;
      f2.type = "bandpass"; f2.frequency.value = 1150; f2.Q.value = 5;

      const mixer = ctx.createGain();
      mixer.gain.value = 0.5;

      osc.connect(f1); osc.connect(f2);
      f1.connect(mixer); f2.connect(mixer);
      mixer.connect(gain);
      gain.connect(ctx.destination);

      // Envelope
      gain.gain.setValueAtTime(0, ctx.currentTime + startT);
      gain.gain.linearRampToValueAtTime(peakGain, ctx.currentTime + startT + 0.18);
      gain.gain.setValueAtTime(peakGain, ctx.currentTime + endT - 0.14);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + endT);

      osc.start(ctx.currentTime + startT);
      vib.start(ctx.currentTime + startT);
      osc.stop(ctx.currentTime + endT + 0.05);
      vib.stop(ctx.currentTime + endT + 0.05);
    };

    // "Ahh" â€” soft chord on G4 (4 voices, slightly detuned for warmth)
    const G4 = 392;
    [[-18,-6,0,14]].flat().forEach(d => makeVoice(G4, d, 0, 0.42, 0.11));

    // "AHHH!" â€” triumphant chord on C5 (5 voices, louder)
    const C5 = 523;
    [[-20,-7,0,8,20]].flat().forEach(d => makeVoice(C5, d, 0.52, 1.45, 0.19));

  } catch(e) {}
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// CONFETTI â€” burst from click origin
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CC = ["#8B2635","#C4734A","#D4AF37","#4A7C59","#2E5A9C","#B87333","#9B4DCA","#C84B31","#3A8A5C"];

function Confetti({ origin }) {
  const parts = useRef(Array.from({length:62},(_,i)=>({
    id:i, angle:(i/62)*360+(Math.random()-0.5)*18,
    speed:90+Math.random()*230, size:4+Math.random()*7,
    color:CC[i%CC.length], isCircle:Math.random()>0.42,
    delay:Math.floor(Math.random()*90),
  })));
  if(!origin) return null;
  return (
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9999,overflow:"hidden"}}>
      {parts.current.map(p=>{
        const r=(p.angle*Math.PI)/180, tx=Math.cos(r)*p.speed, ty=Math.sin(r)*p.speed-80;
        return <div key={p.id} style={{position:"fixed",left:origin.x,top:origin.y,width:p.size,height:p.isCircle?p.size:p.size*0.55,borderRadius:p.isCircle?"50%":"2px",background:p.color,animation:`burstC 1.15s cubic-bezier(.25,.46,.45,.94) ${p.delay}ms forwards`,"--tx":`${tx}px`,"--ty":`${ty}px`}}/>;
      })}
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// THEMES
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const L={bg:"#F5EDD8",bgCard:"#FFFCF3",bgEl:"#FFFEF9",border:"#DFD0B4",borderS:"#C4AA80",text:"#2A1A0E",textM:"#7A6040",textL:"#A8895F",acc:"#8B2635",accL:"#B84040",accBg:"#FBF0EF",gold:"#A8762A",goldL:"#F5E8C8",done:"#B0A090",doneBg:"#EDE5D8",sh:"rgba(42,26,14,0.08)",shS:"rgba(42,26,14,0.18)",nav:"#FFFCF3"};
const D={bg:"#140E06",bgCard:"#1E1508",bgEl:"#271B09",border:"#3A2C14",borderS:"#503F20",text:"#EAD5A5",textM:"#907550",textL:"#5F4A28",acc:"#C4734A",accL:"#E09070",accBg:"#2A1A0E",gold:"#D4A843",goldL:"#2E2210",done:"#4A3820",doneBg:"#1C1408",sh:"rgba(0,0,0,0.35)",shS:"rgba(0,0,0,0.6)",nav:"#1A1106"};

const GS=`
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Crimson+Text:ital,wght@0,400;0,600;1,400;1,600&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Crimson Text',Georgia,serif;-webkit-font-smoothing:antialiased;}
@keyframes burstC{0%{transform:translate(0,0) rotate(0deg);opacity:1;}80%{opacity:0.85;}100%{transform:translate(var(--tx),var(--ty)) rotate(740deg);opacity:0;}}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
@keyframes glow{0%,100%{box-shadow:0 0 0 0 rgba(139,38,53,0.3);}50%{box-shadow:0 0 0 8px rgba(139,38,53,0);}}
::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:rgba(139,38,53,0.22);border-radius:2px;}
select,input{font-family:'Crimson Text',Georgia,serif;}
.chbtn{transition:transform 0.12s,background 0.12s,border-color 0.12s;}.chbtn:hover{transform:translateX(2px);}
.donebtn{transition:opacity 0.15s,background 0.15s;}.donebtn:hover{opacity:0.9;}
`;

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// CUSTOM BOOK PICKER
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function CustomBookPicker({ t, initialBooks, onConfirm, onBack }) {
  const [books, setBooks] = useState(initialBooks);
  const [cat, setCat] = useState("all");
  const [view, setView] = useState("browse");
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const visible = books.filter(b => { const bd=BIBLE_BOOKS.find(x=>x.name===b.name); return bd&&catFilter(bd,cat); });
  const selected = books.filter(b=>b.selected);
  const allVisSel = visible.length>0 && visible.every(b=>b.selected);

  const toggle = n => setBooks(p=>p.map(b=>b.name===n?{...b,selected:!b.selected}:b));
  const toggleAll = () => { const ns=new Set(visible.map(b=>b.name)); setBooks(p=>p.map(b=>ns.has(b.name)?{...b,selected:!allVisSel}:b)); };

  const handleDragStart=(e,i)=>{setDragIdx(i);e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text",i);};
  const handleDragOver=(e,i)=>{e.preventDefault();setDragOverIdx(i);};
  const handleDrop=(e,to)=>{
    e.preventDefault();
    if(dragIdx===null||dragIdx===to){setDragIdx(null);setDragOverIdx(null);return;}
    const ns=[...selected.map(b=>b.name)];
    const [mv]=ns.splice(dragIdx,1); ns.splice(to,0,mv);
    const nSet=new Set(ns);
    setBooks(p=>[...ns.map(n=>p.find(b=>b.name===n)),...p.filter(b=>!nSet.has(b.name))]);
    setDragIdx(null);setDragOverIdx(null);
  };

  return (
    <div style={{position:"fixed",inset:0,background:t.bg,zIndex:300,display:"flex",flexDirection:"column",animation:"fadeUp 0.2s ease"}}>
      <div style={{padding:"12px 16px",borderBottom:`1px solid ${t.border}`,background:t.bgCard,flexShrink:0,display:"flex",alignItems:"center",gap:"10px"}}>
        <button onClick={onBack} style={{background:"none",border:`1px solid ${t.border}`,color:t.textM,cursor:"pointer",padding:"6px 10px",borderRadius:"8px",display:"flex",alignItems:"center",gap:"5px"}}>
          <Icon type="chevron-right" size={14} color={t.textM} style={{transform:"rotate(180deg)"}}/>
          <span style={{fontSize:"13px"}}>Back</span>
        </button>
        <div style={{flex:1}}>
          <p style={{fontFamily:"'Playfair Display',serif",fontSize:"17px",color:t.text,fontWeight:600}}>Custom Reading Plan</p>
          <p style={{fontSize:"12px",color:t.textM}}>{selected.length} of 66 books selected</p>
        </div>
        <button onClick={()=>onConfirm(books)} style={{background:t.acc,color:"#fff",border:"none",borderRadius:"8px",padding:"8px 16px",fontSize:"14px",cursor:"pointer",fontWeight:600}}>Confirm</button>
      </div>

      <div style={{display:"flex",gap:"8px",padding:"8px 16px",background:t.bgCard,borderBottom:`1px solid ${t.border}`,flexShrink:0}}>
        {["browse","order"].map(v=>(
          <button key={v} onClick={()=>setView(v)} style={{padding:"5px 14px",borderRadius:"20px",border:`1px solid ${view===v?t.acc:t.border}`,background:view===v?t.accBg:"none",color:view===v?t.acc:t.textM,fontSize:"13px",cursor:"pointer",fontWeight:view===v?600:400}}>
            {v==="browse"?"Browse & Select":`Reading Order (${selected.length})`}
          </button>
        ))}
      </div>

      {view==="browse"&&<>
        <div style={{overflowX:"auto",display:"flex",gap:"5px",padding:"8px 16px",flexShrink:0,borderBottom:`1px solid ${t.border}`,background:t.bgCard}}>
          {Object.entries(BOOK_CATS).map(([id,{label}])=>(
            <button key={id} onClick={()=>setCat(id)} style={{padding:"4px 11px",borderRadius:"16px",fontSize:"12px",whiteSpace:"nowrap",border:`1px solid ${cat===id?t.acc:t.border}`,background:cat===id?t.accBg:t.bg,color:cat===id?t.acc:t.textM,cursor:"pointer",fontWeight:cat===id?600:400}}>
              {label}
            </button>
          ))}
        </div>
        <div style={{padding:"7px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0,borderBottom:`1px solid ${t.border}`}}>
          <p style={{fontSize:"13px",color:t.textM}}>{visible.filter(b=>b.selected).length} / {visible.length} selected</p>
          <button onClick={toggleAll} style={{padding:"5px 12px",borderRadius:"8px",fontSize:"13px",border:`1px solid ${t.border}`,background:t.bgCard,color:t.textM,cursor:"pointer"}}>
            {allVisSel?"Deselect All":"Select All"}
          </button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"8px 16px"}}>
          {visible.map(book=>{
            const bd=BIBLE_BOOKS.find(b=>b.name===book.name);
            return (
              <div key={book.name} onClick={()=>toggle(book.name)} style={{display:"flex",alignItems:"center",padding:"11px 13px",borderRadius:"10px",cursor:"pointer",marginBottom:"4px",background:book.selected?t.accBg:t.bgCard,border:`1.5px solid ${book.selected?t.acc:t.border}`,transition:"all 0.12s"}}>
                <div style={{width:"20px",height:"20px",borderRadius:"5px",marginRight:"12px",border:`2px solid ${book.selected?t.acc:t.border}`,background:book.selected?t.acc:"none",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.12s"}}>
                  {book.selected&&<Icon type="check" size={11} color="#fff" strokeWidth={2.5}/>}
                </div>
                <span style={{flex:1,fontSize:"15px",color:t.text,fontWeight:book.selected?600:400}}>{book.name}</span>
                <span style={{fontSize:"12px",color:t.textM}}>{bd?.chapters||0} ch.</span>
              </div>
            );
          })}
        </div>
      </>}

      {view==="order"&&(
        <div style={{flex:1,overflowY:"auto",padding:"12px 16px"}}>
          {selected.length===0
            ? <div style={{textAlign:"center",padding:"48px 16px",color:t.textM}}><Icon type="list" size={36} color={t.textL}/><p style={{marginTop:"14px",fontSize:"15px"}}>No books selected.</p></div>
            : <>
              <p style={{fontSize:"13px",color:t.textM,marginBottom:"10px"}}>Drag to set your reading order:</p>
              {selected.map((book,idx)=>(
                <div key={book.name} draggable onDragStart={e=>handleDragStart(e,idx)} onDragOver={e=>handleDragOver(e,idx)} onDrop={e=>handleDrop(e,idx)} onDragEnd={()=>{setDragIdx(null);setDragOverIdx(null);}}
                  style={{display:"flex",alignItems:"center",gap:"10px",padding:"11px 13px",borderRadius:"10px",marginBottom:"4px",background:dragOverIdx===idx?t.accBg:t.bgCard,border:`1.5px solid ${dragOverIdx===idx?t.acc:dragIdx===idx?t.borderS:t.border}`,cursor:"grab",opacity:dragIdx===idx?0.45:1,transition:"background 0.1s,border-color 0.1s"}}>
                  <Icon type="drag" size={16} color={t.textL}/>
                  <span style={{fontSize:"13px",color:t.textM,width:"22px",textAlign:"right",flexShrink:0}}>{idx+1}</span>
                  <span style={{flex:1,fontSize:"15px",color:t.text}}>{book.name}</span>
                  <span style={{fontSize:"12px",color:t.textM}}>{BIBLE_BOOKS.find(b=>b.name===book.name)?.chapters||0} ch.</span>
                  <button onClick={()=>toggle(book.name)} style={{background:"none",border:"none",color:t.textL,cursor:"pointer",padding:"2px",display:"flex"}}><Icon type="x" size={14} color={t.textL}/></button>
                </div>
              ))}
            </>
          }
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// NEW GOAL MODAL
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function NewGoalModal({ t, onClose, onCreate }) {
  const [step, setStep] = useState(1);
  const [type, setType] = useState(null);
  const [customBooks, setCustomBooks] = useState(BIBLE_BOOKS.map(b=>({name:b.name,selected:true})));
  const [showCustom, setShowCustom] = useState(false);
  const [startMode, setStartMode] = useState("fresh");
  const [startChapter, setStartChapter] = useState("");
  const [name, setName] = useState("");

  const TYPES=[{id:"canonical",label:"Canonical",desc:"All 66 books in biblical order"},{id:"chronological",label:"Chronological",desc:"Interleaved historically â€” as events occurred"},{id:"nt",label:"New Testament",desc:"Matthew through Revelation"},{id:"ot",label:"Old Testament",desc:"Genesis through Malachi"},{id:"gospels",label:"Gospels",desc:"Matthew, Mark, Luke & John"},{id:"custom",label:"Custom",desc:"Choose your own books & order"}];

  const chs = type ? getChapterList(type, customBooks) : [];

  if(showCustom) return <CustomBookPicker t={t} initialBooks={customBooks} onConfirm={b=>{setCustomBooks(b);setShowCustom(false);setStep(2);}} onBack={()=>{setShowCustom(false);setType(null);}}/>;

  const ov={position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"};
  const mv={background:t.bgEl,border:`1px solid ${t.borderS}`,borderRadius:"16px",width:"100%",maxWidth:"460px",maxHeight:"82vh",display:"flex",flexDirection:"column",boxShadow:`0 24px 64px ${t.shS}`,animation:"fadeUp 0.2s ease",overflow:"hidden"};

  return (
    <div style={ov} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={mv}>
        <div style={{padding:"18px 22px 14px",borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div>
            <p style={{fontFamily:"'Playfair Display',serif",fontSize:"18px",fontWeight:600,color:t.text}}>New Reading Plan</p>
            <p style={{fontSize:"13px",color:t.textM,marginTop:"2px"}}>{step===1?"Choose a plan type":step===2?"Set your starting point":"Name your plan"}</p>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer"}}><Icon type="x" size={18} color={t.textM}/></button>
        </div>

        <div style={{padding:"18px 22px",overflowY:"auto",flex:1}}>
          {step===1&&<div style={{display:"flex",flexDirection:"column",gap:"7px"}}>
            {TYPES.map(tp=>(
              <button key={tp.id} onClick={()=>{setType(tp.id);tp.id==="custom"?setShowCustom(true):setStep(2);}} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",borderRadius:"10px",cursor:"pointer",border:`1.5px solid ${type===tp.id?t.acc:t.border}`,background:type===tp.id?t.accBg:t.bgCard,textAlign:"left"}}>
                <div><p style={{fontSize:"15px",fontWeight:600,color:t.text,fontFamily:"'Playfair Display',serif"}}>{tp.label}</p><p style={{fontSize:"13px",color:t.textM}}>{tp.desc}</p></div>
                <Icon type="chevron-right" size={15} color={t.textL}/>
              </button>
            ))}
          </div>}

          {step===2&&<div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
            {["fresh","mid"].map(m=>(
              <button key={m} onClick={()=>setStartMode(m)} style={{padding:"14px 16px",borderRadius:"10px",cursor:"pointer",border:`1.5px solid ${startMode===m?t.acc:t.border}`,background:startMode===m?t.accBg:t.bgCard,textAlign:"left"}}>
                <p style={{fontSize:"15px",fontWeight:600,color:t.text,fontFamily:"'Playfair Display',serif"}}>{m==="fresh"?"Start Fresh":"Start In Progress"}</p>
                <p style={{fontSize:"13px",color:t.textM,marginTop:"3px"}}>{m==="fresh"?"Begin from the very first chapter":"Choose where you are â€” earlier chapters auto-complete"}</p>
              </button>
            ))}
            {startMode==="mid"&&<select value={startChapter} onChange={e=>setStartChapter(e.target.value)} style={{padding:"9px 10px",borderRadius:"8px",border:`1px solid ${t.border}`,background:t.bgCard,color:t.text,fontSize:"14px"}}>
              <option value="">â€” Choose starting chapter â€”</option>
              {chs.map(c=><option key={c} value={c}>{c}</option>)}
            </select>}
          </div>}

          {step===3&&<div>
            <p style={{fontSize:"14px",color:t.textM,marginBottom:"8px"}}>Name your plan:</p>
            <input value={name} onChange={e=>setName(e.target.value)} autoFocus placeholder={`My ${TYPES.find(tp=>tp.id===type)?.label||"Custom"} Plan`}
              style={{width:"100%",padding:"10px 12px",borderRadius:"8px",border:`1.5px solid ${t.borderS}`,background:t.bgCard,color:t.text,fontSize:"16px",fontFamily:"'Playfair Display',serif"}}/>
            <div style={{marginTop:"14px",padding:"12px 14px",borderRadius:"10px",background:t.goldL,border:`1px solid ${t.gold}30`}}>
              <p style={{fontSize:"11px",color:t.gold,fontWeight:600,letterSpacing:"0.06em"}}>SUMMARY</p>
              <p style={{fontSize:"14px",color:t.textM,marginTop:"4px"}}>{chs.length} chapters Â· {TYPES.find(tp=>tp.id===type)?.label} Â· {startMode==="mid"&&startChapter?`Starting at ${startChapter}`:"From the beginning"}</p>
            </div>
          </div>}
        </div>

        <div style={{padding:"14px 22px",borderTop:`1px solid ${t.border}`,display:"flex",gap:"8px",justifyContent:"flex-end",flexShrink:0}}>
          {step>1&&<button onClick={()=>setStep(s=>s-1)} style={{padding:"9px 18px",borderRadius:"8px",border:`1px solid ${t.border}`,background:"none",color:t.textM,cursor:"pointer",fontSize:"14px"}}>Back</button>}
          {step<3&&type&&<button onClick={()=>setStep(s=>s+1)} style={{padding:"9px 18px",borderRadius:"8px",border:"none",background:t.acc,color:"#fff",cursor:"pointer",fontSize:"14px",fontWeight:600}}>Next</button>}
          {step===3&&<button onClick={()=>{
            const readings=[];
            if(startMode==="mid"&&startChapter){const idx=chs.indexOf(startChapter);if(idx>0)chs.slice(0,idx).forEach((c,i)=>readings.push({chapter:c,date:todayStr(),ts:Date.now()-(idx-i)*500}));}
            onCreate({id:Date.now().toString(),name:name.trim()||(TYPES.find(tp=>tp.id===type)?.label+" Plan")||"My Plan",type,chapters:chs,readings,createdAt:todayStr()});
          }} style={{padding:"9px 18px",borderRadius:"8px",border:"none",background:t.acc,color:"#fff",cursor:"pointer",fontSize:"14px",fontWeight:600}}>Create Plan</button>}
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RANDOM READING MODAL
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function RandomModal({ t, onClose, onLog }) {
  const [book, setBook] = useState(""); const [ch, setCh] = useState("");
  const bd = BIBLE_BOOKS.find(b=>b.name===book);
  const sel={padding:"9px 10px",borderRadius:"8px",border:`1px solid ${t.border}`,background:t.bgCard,color:t.text,fontSize:"15px",width:"100%"};
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:t.bgEl,border:`1px solid ${t.borderS}`,borderRadius:"14px",width:"100%",maxWidth:"360px",padding:"22px",boxShadow:`0 24px 48px ${t.shS}`,animation:"fadeUp 0.2s ease"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:"16px"}}>
          <div><p style={{fontFamily:"'Playfair Display',serif",fontSize:"17px",color:t.text,fontWeight:600}}>Log Random Reading</p><p style={{fontSize:"13px",color:t.textM,marginTop:"2px"}}>Track outside your goals</p></div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer"}}><Icon type="x" size={18} color={t.textM}/></button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:"9px"}}>
          <select value={book} onChange={e=>{setBook(e.target.value);setCh("");}} style={sel}>
            <option value="">Select bookâ€¦</option>
            <optgroup label="Old Testament">{BIBLE_BOOKS.filter(b=>b.testament==="OT").map(b=><option key={b.name} value={b.name}>{b.name}</option>)}</optgroup>
            <optgroup label="New Testament">{BIBLE_BOOKS.filter(b=>b.testament==="NT").map(b=><option key={b.name} value={b.name}>{b.name}</option>)}</optgroup>
          </select>
          {bd&&<select value={ch} onChange={e=>setCh(e.target.value)} style={sel}>
            <option value="">Select chapterâ€¦</option>
            {Array.from({length:bd.chapters},(_,i)=><option key={i+1} value={String(i+1)}>{book} {i+1}</option>)}
          </select>}
        </div>
        <div style={{display:"flex",gap:"8px",marginTop:"18px",justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{padding:"8px 16px",borderRadius:"8px",border:`1px solid ${t.border}`,background:"none",color:t.textM,cursor:"pointer",fontSize:"14px"}}>Cancel</button>
          <button disabled={!book||!ch} onClick={()=>{onLog(`${book} ${ch}`);onClose();}} style={{padding:"8px 16px",borderRadius:"8px",border:"none",background:book&&ch?t.acc:t.border,color:book&&ch?"#fff":t.textM,cursor:book&&ch?"pointer":"default",fontSize:"14px",fontWeight:600}}>Log Reading</button>
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// LINE CHART
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function LineChart({ data, t }) {
  const W=320, H=72;
  const maxV=Math.max(...data.map(d=>d.count),1);
  const pts=data.map((d,i)=>({x:(i/(data.length-1))*W, y:H-(d.count/maxV)*(H-6)}));
  const pathD=pts.map((p,i)=>`${i===0?"M":"L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaD=pathD+` L ${W} ${H} L 0 ${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"72px",overflow:"visible"}}>
      <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={t.acc} stopOpacity="0.22"/><stop offset="100%" stopColor={t.acc} stopOpacity="0"/></linearGradient></defs>
      <path d={areaD} fill="url(#lg)"/>
      <path d={pathD} fill="none" stroke={t.acc} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      {pts.filter((_,i)=>i%12===0).map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="2.5" fill={t.acc}/>)}
    </svg>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ANALYTICS PAGE
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function AnalyticsPage({ t, goals, activeGoalId, randomReadings }) {
  const [viewMode, setViewMode] = useState("overall");
  const allReadings=[];
  goals.forEach(g=>(g.readings||[]).forEach(r=>allReadings.push({...r,goalId:g.id})));
  randomReadings.forEach(r=>allReadings.push({...r,goalId:"random"}));
  const chCount={}, bookCount={}, dayCount={}, monthCount={}, weekCount={};
  allReadings.forEach(r=>{
    chCount[r.chapter]=(chCount[r.chapter]||0)+1;
    const bk=getBook(r.chapter); bookCount[bk]=(bookCount[bk]||0)+1;
    if(r.date){
      dayCount[r.date]=(dayCount[r.date]||0)+1;
      const [y,m]=r.date.split("-"); monthCount[`${y}-${m}`]=(monthCount[`${y}-${m}`]||0)+1;
      const d=new Date(r.date+"T12:00:00"),j1=new Date(y,0,1),wk=Math.ceil(((d-j1)/86400000+j1.getDay()+1)/7);
      weekCount[`${y}-W${String(wk).padStart(2,"0")}`]=(weekCount[`${y}-W${String(wk).padStart(2,"0")}`]||0)+1;
    }
  });
  const topCh=Object.entries(chCount).sort((a,b)=>b[1]-a[1])[0];
  const topBk=Object.entries(bookCount).sort((a,b)=>b[1]-a[1])[0];
  const topDay=Object.entries(dayCount).sort((a,b)=>b[1]-a[1])[0];
  const topMo=Object.entries(monthCount).sort((a,b)=>b[1]-a[1])[0];
  const topWk=Object.entries(weekCount).sort((a,b)=>b[1]-a[1])[0];
  const lineData=[];
  for(let i=59;i>=0;i--){const d=new Date(Date.now()-i*86400000).toISOString().slice(0,10);lineData.push({date:d,count:dayCount[d]||0});}
  const sevenAgo=new Date(Date.now()-7*86400000).toISOString().slice(0,10);
  const stuckBooks=[];
  goals.forEach(g=>{
    const cSet=new Set((g.readings||[]).map(r=>r.chapter));
    [...new Set(g.chapters.map(c=>getBook(c)))].forEach(bk=>{
      const bkChs=g.chapters.filter(c=>getBook(c)===bk);
      const readBkChs=bkChs.filter(c=>cSet.has(c));
      if(readBkChs.length>0&&readBkChs.length<bkChs.length){
        const lastR=(g.readings||[]).filter(r=>getBook(r.chapter)===bk).map(r=>r.date).sort().pop();
        if(lastR&&lastR<sevenAgo) stuckBooks.push({book:bk,goal:g.name,lastRead:lastR,done:readBkChs.length,total:bkChs.length});
      }
    });
  });
  const bookStats={};
  goals.forEach(g=>{
    [...new Set(g.chapters.map(c=>getBook(c)))].forEach(bk=>{
      const bkChs=g.chapters.filter(c=>getBook(c)===bk);
      const bkRds=(g.readings||[]).filter(r=>getBook(r.chapter)===bk);
      if(bkRds.length===0) return;
      const dates=[...new Set(bkRds.map(r=>r.date))].sort();
      const done=bkChs.every(c=>(g.readings||[]).some(r=>r.chapter===c));
      if(!bookStats[bk]) bookStats[bk]={totalChs:0,activeDays:0,completions:0};
      bookStats[bk].totalChs+=bkRds.length; bookStats[bk].activeDays+=dates.length;
      if(done) bookStats[bk].completions++;
    });
  });
  const goal=goals.find(g=>g.id===viewMode);
  let gReadings=[],gCompleted=0,gTotal=0,gPct=0,gDates=[],gStreak=0,gLongest=0;
  if(goal){
    gReadings=goal.readings||[];
    const gSet=new Set(gReadings.map(r=>r.chapter));
    gCompleted=gSet.size; gTotal=goal.chapters.length; gPct=gTotal>0?Math.round((gCompleted/gTotal)*100):0;
    gDates=[...new Set(gReadings.map(r=>r.date))].sort().reverse();
    for(let i=0;i<365;i++){const d=new Date(Date.now()-i*86400000).toISOString().slice(0,10);if(gDates.includes(d))gStreak++;else if(i>0)break;}
    if(gDates.length>0){const s=[...gDates].sort();let run=1;for(let i=1;i<s.length;i++){const diff=(new Date(s[i]+"T12:00:00")-new Date(s[i-1]+"T12:00:00"))/86400000;if(diff===1){run++;gLongest=Math.max(gLongest,run);}else run=1;}gLongest=Math.max(gLongest,gStreak);}
  }
  const dayNames=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const dayBars=[0,0,0,0,0,0,0];
  (viewMode==="overall"?allReadings:gReadings).forEach(r=>{if(r.date)dayBars[new Date(r.date+"T12:00:00").getDay()]++;});
  const maxDB=Math.max(...dayBars,1);
  const sCard=(icon,lbl,val,sub)=>(
    <div style={{background:t.bgCard,border:`1px solid ${t.border}`,borderRadius:"12px",padding:"12px 14px",flex:1,minWidth:"85px"}}>
      <Icon type={icon} size={16} color={t.acc}/>
      <div style={{fontSize:"21px",fontWeight:700,color:t.text,fontFamily:"'Playfair Display',serif",marginTop:"4px"}}>{val}</div>
      <div style={{fontSize:"11px",color:t.textM,marginTop:"2px"}}>{lbl}</div>
      {sub&&<div style={{fontSize:"10px",color:t.textL}}>{sub}</div>}
    </div>
  );
  return (
    <div style={{flex:1,overflowY:"auto",padding:"14px 16px"}}>
      <select value={viewMode} onChange={e=>setViewMode(e.target.value)} style={{width:"100%",padding:"9px 12px",borderRadius:"10px",border:`1.5px solid ${t.borderS}`,background:t.bgCard,color:t.text,fontSize:"15px",fontFamily:"'Playfair Display',serif",fontWeight:600,marginBottom:"14px"}}>
        <option value="overall">Overall Statistics</option>
        {goals.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
      </select>

      {viewMode==="overall"&&<div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
        <div style={{display:"flex",gap:"9px",flexWrap:"wrap"}}>
          {sCard("book","Total Readings",allReadings.length,"all time")}
          {sCard("calendar","Days Active",Object.keys(dayCount).length,"unique")}
        </div>
        <div style={{background:t.bgCard,border:`1px solid ${t.border}`,borderRadius:"13px",padding:"14px 16px"}}>
          <p style={{fontFamily:"'Playfair Display',serif",fontSize:"14px",color:t.text,fontWeight:600,marginBottom:"12px"}}>Top Readings</p>
          {[
            {label:"Most Read Chapter",icon:"book",val:topCh?`${topCh[0]} (Ã—${topCh[1]})`:"â€”"},
            {label:"Most Read Book",icon:"bookmark",val:topBk?`${topBk[0]} (Ã—${topBk[1]})`:"â€”"},
            {label:"Most Active Day",icon:"calendar",val:topDay?`${fmtDate(topDay[0])} Â· ${topDay[1]} ch.`:"â€”"},
            {label:"Most Active Month",icon:"chart",val:topMo?(()=>{const [y,m]=topMo[0].split("-");return `${new Date(y,m-1).toLocaleString("en-US",{month:"long",year:"numeric"})} Â· ${topMo[1]} ch.`;})():"â€”"},
            {label:"Most Active Week",icon:"trending",val:topWk?`${topWk[0]} Â· ${topWk[1]} ch.`:"â€”"},
          ].map(({label,icon,val})=>(
            <div key={label} style={{display:"flex",alignItems:"flex-start",gap:"10px",marginBottom:"10px"}}>
              <Icon type={icon} size={14} color={t.gold}/>
              <div><p style={{fontSize:"12px",color:t.textM}}>{label}</p><p style={{fontSize:"14px",color:t.text,fontWeight:600}}>{val}</p></div>
            </div>
          ))}
        </div>
        <div style={{background:t.bgCard,border:`1px solid ${t.border}`,borderRadius:"13px",padding:"14px 16px"}}>
          <p style={{fontFamily:"'Playfair Display',serif",fontSize:"14px",color:t.text,fontWeight:600,marginBottom:"4px"}}>Reading Sessions Â· Last 60 Days</p>
          <p style={{fontSize:"12px",color:t.textM,marginBottom:"10px"}}>Chapters read per day</p>
          <LineChart data={lineData} t={t}/>
        </div>
        <div style={{background:t.bgCard,border:`1px solid ${t.border}`,borderRadius:"12px",padding:"14px 16px"}}>
          <p style={{fontFamily:"'Playfair Display',serif",fontSize:"14px",color:t.text,fontWeight:600,marginBottom:"10px"}}>Day of Week Activity</p>
          <div style={{display:"flex",gap:"5px",alignItems:"flex-end",height:"60px"}}>
            {dayBars.map((c,i)=>(
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:"3px"}}>
                <div style={{width:"100%",borderRadius:"3px 3px 0 0",height:`${(c/maxDB)*44}px`,background:c===maxDB&&maxDB>0?t.acc:t.gold,opacity:c>0?1:0.18,transition:"height 0.4s ease",minHeight:c>0?"3px":"0"}}/>
                <span style={{fontSize:"10px",color:t.textM}}>{dayNames[i]}</span>
              </div>
            ))}
          </div>
        </div>
        {stuckBooks.length>0&&<div style={{background:t.bgCard,border:`1px solid ${t.border}`,borderRadius:"13px",padding:"14px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}><Icon type="alert" size={15} color={t.gold}/><p style={{fontFamily:"'Playfair Display',serif",fontSize:"14px",color:t.text,fontWeight:600}}>Stuck Books</p></div>
          <p style={{fontSize:"12px",color:t.textM,marginBottom:"10px"}}>Started but not read in 7+ days</p>
          {stuckBooks.map((sb,i)=>(
            <div key={i} style={{padding:"9px 12px",borderRadius:"8px",background:t.bg,border:`1px solid ${t.border}`,marginBottom:"6px"}}>
              <div style={{display:"flex",justifyContent:"space-between"}}><p style={{fontSize:"14px",color:t.text,fontWeight:600}}>{sb.book}</p><p style={{fontSize:"12px",color:t.gold}}>{sb.done}/{sb.total} ch.</p></div>
              <p style={{fontSize:"12px",color:t.textM}}>Last read {fmtDate(sb.lastRead)} Â· {sb.goal}</p>
            </div>
          ))}
        </div>}
        {Object.keys(bookStats).length>0&&<div style={{background:t.bgCard,border:`1px solid ${t.border}`,borderRadius:"13px",padding:"14px 16px"}}>
          <p style={{fontFamily:"'Playfair Display',serif",fontSize:"14px",color:t.text,fontWeight:600,marginBottom:"10px"}}>Book Deep Stats</p>
          {Object.entries(bookStats).sort((a,b)=>b[1].totalChs-a[1].totalChs).slice(0,14).map(([bk,d])=>(
            <div key={bk} style={{padding:"9px 12px",borderRadius:"8px",background:t.bg,border:`1px solid ${t.border}`,marginBottom:"6px"}}>
              <p style={{fontSize:"14px",color:t.text,fontWeight:600,marginBottom:"4px"}}>{bk}</p>
              <div style={{display:"flex",flexWrap:"wrap",gap:"12px"}}>
                <span style={{fontSize:"12px",color:t.textM}}>Chapters: <b style={{color:t.text}}>{d.totalChs}</b></span>
                <span style={{fontSize:"12px",color:t.textM}}>Active days: <b style={{color:t.text}}>{d.activeDays}</b></span>
                <span style={{fontSize:"12px",color:t.textM}}>Avg ch/day: <b style={{color:t.text}}>{d.activeDays>0?(d.totalChs/d.activeDays).toFixed(1):"â€”"}</b></span>
                {d.completions>0&&<span style={{fontSize:"12px",color:t.textM}}>Completions: <b style={{color:t.gold}}>{d.completions}</b></span>}
              </div>
            </div>
          ))}
        </div>}
      </div>}

      {viewMode!=="overall"&&goal&&<div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
        <div style={{background:t.bgCard,border:`1px solid ${t.border}`,borderRadius:"13px",padding:"15px 17px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:"8px"}}>
            <p style={{fontFamily:"'Playfair Display',serif",fontSize:"16px",color:t.text,fontWeight:600}}>{goal.name}</p>
            <p style={{fontSize:"24px",fontWeight:700,color:t.acc,fontFamily:"'Playfair Display',serif"}}>{gPct}%</p>
          </div>
          <div style={{height:"8px",background:t.doneBg,borderRadius:"4px",overflow:"hidden"}}>
            <div style={{height:"100%",width:`${gPct}%`,background:`linear-gradient(90deg,${t.acc},${t.accL})`,borderRadius:"4px",transition:"width 0.5s ease"}}/>
          </div>
          <p style={{fontSize:"13px",color:t.textM,marginTop:"6px"}}>{gCompleted} of {gTotal} chapters</p>
        </div>
        <div style={{display:"flex",gap:"9px",flexWrap:"wrap"}}>
          {sCard("flame","Current Streak",gStreak,gStreak===1?"day":"days")}
          {sCard("trophy","Longest Streak",gLongest,"days")}
          {sCard("calendar","Days Active",gDates.length,"total")}
          {sCard("chart","Avg/Day",gDates.length>0?(gCompleted/gDates.length).toFixed(1):"0","chapters")}
        </div>
        <div style={{background:t.bgCard,border:`1px solid ${t.border}`,borderRadius:"12px",padding:"14px 16px"}}>
          <p style={{fontFamily:"'Playfair Display',serif",fontSize:"14px",color:t.text,marginBottom:"10px",fontWeight:600}}>Books Progress</p>
          {[...new Set(goal.chapters.map(c=>getBook(c)))].map(bk=>{
            const total=goal.chapters.filter(c=>getBook(c)===bk).length;
            const done=(goal.readings||[]).filter(r=>getBook(r.chapter)===bk).length;
            const pct=total>0?done/total:0;
            return <div key={bk} style={{marginBottom:"7px"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:"3px"}}>
                <span style={{fontSize:"13px",color:t.text}}>{bk}</span>
                <span style={{fontSize:"12px",color:t.textM}}>{done}/{total}</span>
              </div>
              <div style={{height:"5px",background:t.doneBg,borderRadius:"3px",overflow:"hidden"}}>
                <div style={{height:"100%",width:`${pct*100}%`,background:pct===1?t.gold:t.acc,borderRadius:"3px"}}/>
              </div>
            </div>;
          })}
        </div>
      </div>}
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// SHARE â€” Book Opening with Rich Heatmap Tooltip
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SharePage({ t, goals, randomReadings, onClose }) {
  const [open, setOpen] = useState(false);
  const [tooltip, setTooltip] = useState(null); // {name,total,readNums,totalReads,rect}

  useEffect(()=>{const id=setTimeout(()=>setOpen(true),280);return()=>clearTimeout(id);},[]);

  // Build read counts per chapter across all goals + random
  const readCount = {};
  goals.forEach(g=>(g.readings||[]).forEach(r=>{readCount[r.chapter]=(readCount[r.chapter]||0)+1;}));
  randomReadings.forEach(r=>{readCount[r.chapter]=(readCount[r.chapter]||0)+1;});
  const maxC = Math.max(...Object.values(readCount),1);

  const MINP=0.004, totalChs=BIBLE_BOOKS.reduce((a,b)=>a+b.chapters,0);
  const books = BIBLE_BOOKS.map(b=>({...b,prop:Math.max(b.chapters/totalChs,MINP)}));
  const totalP = books.reduce((a,b)=>a+b.prop,0);

  const totalRead=Object.keys(readCount).length;
  const allRds=goals.reduce((a,g)=>a+(g.readings?.length||0),0)+randomReadings.length;

  const handleBookHover = (e, book) => {
    // Build per-chapter read data for this book
    const readNums = Array.from({length:book.chapters},(_,i)=>{
      const key=`${book.name} ${i+1}`;
      return {num:i+1, count:readCount[key]||0};
    });
    const totalReads = readNums.reduce((a,r)=>a+r.count,0);
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({name:book.name, total:book.chapters, readNums, totalReads, rect});
  };

  // Smart tooltip positioning
  const TT = tooltip ? (() => {
    const r = tooltip.rect;
    const viewW = window.innerWidth;
    const left = r.left + r.width/2;
    const top = r.top;
    return { left: Math.min(Math.max(left-110,8), viewW-230), top: top - 8 };
  })() : null;

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:"12px"}}>

      {/* Rich tooltip */}
      {tooltip&&TT&&(
        <div style={{
          position:"fixed", left:TT.left, top:TT.top,
          transform:"translateY(-100%)",
          background:t.bgEl, border:`1px solid ${t.borderS}`, borderRadius:"12px",
          padding:"12px 14px", zIndex:400, pointerEvents:"none",
          boxShadow:`0 8px 24px ${t.shS}`, width:"220px",
          animation:"fadeUp 0.1s ease",
        }}>
          <p style={{fontFamily:"'Playfair Display',serif",fontSize:"14px",fontWeight:600,color:t.text,marginBottom:"4px"}}>{tooltip.name}</p>
          <p style={{fontSize:"12px",color:t.textM,marginBottom:"8px"}}>
            {tooltip.readNums.filter(r=>r.count>0).length} of {tooltip.total} chapters read
            {tooltip.totalReads>0&&` Â· ${tooltip.totalReads} total readings`}
          </p>
          {/* Mini chapter grid */}
          <div style={{display:"flex",flexWrap:"wrap",gap:"2px",marginBottom:"6px"}}>
            {tooltip.readNums.map(({num,count})=>(
              <div key={num} title={`Ch. ${num}: ${count} reading${count!==1?"s":""}`}
                style={{
                  width:"11px",height:"11px",borderRadius:"2px",
                  background:count===0?t.doneBg:`rgba(139,38,53,${Math.min(0.2+0.8*(count/maxC),1)})`,
                  border:`1px solid ${count>0?t.acc+"40":t.border}`,
                  flexShrink:0,
                }}/>
            ))}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
            {[{bg:t.doneBg,label:"Unread"},{bg:`rgba(139,38,53,0.3)`,label:"Read"},{bg:`rgba(139,38,53,0.85)`,label:"Often"}].map(({bg,label})=>(
              <div key={label} style={{display:"flex",alignItems:"center",gap:"3px"}}>
                <div style={{width:"8px",height:"8px",borderRadius:"1px",background:bg,border:`1px solid ${t.border}`}}/>
                <span style={{fontSize:"9px",color:t.textL}}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{width:"100%",maxWidth:"640px",maxHeight:"92vh",display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px",padding:"0 4px"}}>
          <p style={{fontFamily:"'Playfair Display',serif",fontSize:"16px",color:"rgba(255,255,255,0.9)",fontWeight:600}}>My Reading Journey</p>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.12)",border:"none",color:"#fff",cursor:"pointer",borderRadius:"8px",padding:"7px 12px",display:"flex",alignItems:"center",gap:"6px",fontSize:"13px"}}>
            <Icon type="x" size={15} color="#fff"/> Close
          </button>
        </div>

        {/*
          â”€â”€ THE BOOK â”€â”€
          Layers (bottom â†’ top):
            1. Right page: heatmap (always visible, right half)
            2. Inside-left page: title/stats (fades in as cover opens)
            3. Cover: perspective wrapper â†’ rotating leather cover
            4. Spine: always on top at center
          CRITICAL: NO overflow:hidden anywhere above a 3D-transformed element.
          Perspective must be the DIRECT parent of the rotating element.
        */}
        <div style={{
          position:"relative",
          height:"440px",
          borderRadius:"8px",
          boxShadow:`0 24px 64px rgba(0,0,0,0.75)`,
          flexShrink:0,
          // NO overflow:hidden here â€” that would kill 3D transforms
        }}>

          {/* LAYER 1 â€” Right page: heatmap (always visible) */}
          <div style={{
            position:"absolute", right:0, top:0, bottom:0, width:"50%",
            background:`linear-gradient(160deg,${t.bgCard} 0%,${t.goldL} 100%)`,
            borderRadius:"0 8px 8px 0",
            overflow:"auto", zIndex:1,
          }}>
            <div style={{padding:"14px 12px"}}>
              <p style={{fontFamily:"'Playfair Display',serif",fontSize:"10px",color:t.gold,letterSpacing:"0.12em",marginBottom:"10px",textAlign:"center"}}>âœ¦ HEATMAP âœ¦</p>
              <p style={{fontSize:"10px",color:t.textM,marginBottom:"8px",textAlign:"center"}}>Hover a book for details</p>
              <div style={{display:"flex",flexWrap:"wrap",gap:"2px",marginBottom:"10px"}}>
                {books.map(book=>{
                  const pxW=Math.max((book.prop/totalP)*240,10);
                  const bkRds=Array.from({length:book.chapters},(_,i)=>readCount[`${book.name} ${i+1}`]||0);
                  const totalReads=bkRds.reduce((a,b)=>a+b,0);
                  const intensity=totalReads===0?0:Math.min(1,0.15+0.85*(totalReads/(book.chapters*maxC)));
                  return (
                    <div key={book.name}
                      onMouseEnter={e=>handleBookHover(e,book)}
                      onMouseLeave={()=>setTooltip(null)}
                      style={{width:`${pxW}px`,height:"26px",borderRadius:"2px",overflow:"hidden",border:`1px solid ${t.border}`,cursor:"default",position:"relative",flexShrink:0,transition:"transform 0.12s",background:totalReads===0?t.doneBg:`rgba(139,38,53,${intensity})`}}
                      onMouseOver={e=>{e.currentTarget.style.transform="scale(1.18) translateY(-2px)";e.currentTarget.style.zIndex="20";}}
                      onMouseOut={e=>{e.currentTarget.style.transform="scale(1)";e.currentTarget.style.zIndex="1";}}>
                      {book.chapters<=14&&pxW>16&&(
                        <div style={{display:"flex",height:"100%"}}>
                          {bkRds.map((c,i)=><div key={i} style={{flex:1,background:c===0?t.doneBg:`rgba(139,38,53,${0.15+0.85*(c/maxC)})`}}/>)}
                        </div>
                      )}
                      {pxW>22&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"flex-end",padding:"1px 2px"}}>
                        <span style={{fontSize:"6px",color:t.text,opacity:0.55,lineHeight:1,overflow:"hidden",whiteSpace:"nowrap"}}>{book.name.length>6?book.name.slice(0,5)+"â€¦":book.name}</span>
                      </div>}
                    </div>
                  );
                })}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:"5px",justifyContent:"center",marginBottom:"10px"}}>
                <span style={{fontSize:"9px",color:t.textM}}>Unread</span>
                {[0.2,0.5,0.8].map(op=><div key={op} style={{width:"9px",height:"9px",borderRadius:"1px",background:`rgba(139,38,53,${op})`}}/>)}
                <span style={{fontSize:"9px",color:t.textM}}>Often</span>
              </div>
              <div style={{display:"flex",gap:"5px"}}>
                {[{l:"Chapters",v:totalRead},{l:"Plans",v:goals.length},{l:"Readings",v:allRds}].map(s=>(
                  <div key={s.l} style={{textAlign:"center",padding:"6px 4px",background:t.bgCard,borderRadius:"6px",border:`1px solid ${t.border}`,flex:1}}>
                    <div style={{fontSize:"15px",fontWeight:700,color:t.acc,fontFamily:"'Playfair Display',serif"}}>{s.v}</div>
                    <div style={{fontSize:"9px",color:t.textM,marginTop:"1px"}}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* LAYER 2 â€” Inside-left page: revealed as cover opens */}
          <div style={{
            position:"absolute", left:0, top:0, bottom:0, width:"50%",
            background:`linear-gradient(135deg, ${t.bgCard} 0%, ${t.goldL} 100%)`,
            borderRadius:"8px 0 0 8px",
            display:"flex", alignItems:"center", justifyContent:"center",
            zIndex:2,
            opacity: open ? 1 : 0,
            transition:"opacity 0.5s ease 0.7s",
          }}>
            <div style={{textAlign:"center",color:t.gold,padding:"20px"}}>
              <Icon type="book" size={32} color={t.gold} strokeWidth={1.2}/>
              <div style={{width:"32px",height:"1px",background:t.gold,margin:"12px auto",opacity:0.4}}/>
              <p style={{fontFamily:"'Playfair Display',serif",fontSize:"15px",fontWeight:700,marginBottom:"4px",color:t.text}}>My Reading</p>
              <p style={{fontFamily:"'Playfair Display',serif",fontSize:"15px",fontWeight:700,fontStyle:"italic",color:t.text}}>Journey</p>
              <div style={{width:"32px",height:"1px",background:t.gold,margin:"12px auto",opacity:0.4}}/>
              <p style={{fontSize:"11px",color:t.textM,marginBottom:"4px"}}>{totalRead} chapters</p>
              <p style={{fontSize:"11px",color:t.textM}}>{allRds} readings</p>
            </div>
          </div>

          {/* LAYER 3 â€” Cover: perspective is the DIRECT parent of the rotating div */}
          {/* overflow:visible is CRITICAL â€” never hidden on or above a 3D element */}
          <div style={{
            position:"absolute", left:0, top:0, bottom:0, width:"50%",
            perspective:"1000px",
            overflow:"visible",
            zIndex: open ? 0 : 5,
          }}>
            <div style={{
              width:"100%", height:"100%",
              transformOrigin:"right center",
              transform: open ? "rotateY(-180deg)" : "rotateY(0deg)",
              transition:"transform 1.3s cubic-bezier(0.645,0.045,0.355,1.000)",
              backfaceVisibility:"hidden",
              WebkitBackfaceVisibility:"hidden",
              borderRadius:"8px 0 0 8px",
              background:"linear-gradient(145deg,#1A0C05 0%,#3D2810 40%,#4A3318 70%,#2A1A08 100%)",
              boxShadow: open ? "none" : "4px 0 20px rgba(0,0,0,0.6)",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              <div style={{textAlign:"center",padding:"20px"}}>
                <Icon type="book" size={34} color="#D4AF37" strokeWidth={1.1}/>
                <div style={{width:"32px",height:"1px",background:"#D4AF37",margin:"12px auto",opacity:0.45}}/>
                <p style={{fontFamily:"'Playfair Display',serif",fontSize:"16px",fontWeight:700,color:"#D4AF37",letterSpacing:"0.04em"}}>Scripture</p>
                <p style={{fontFamily:"'Playfair Display',serif",fontSize:"11px",color:"#D4AF37",opacity:0.6,marginTop:"4px",fontStyle:"italic"}}>Reading Tracker</p>
              </div>
            </div>
          </div>

          {/* LAYER 4 â€” Spine (always on top) */}
          <div style={{
            position:"absolute",
            left:"calc(50% - 5px)", top:0, bottom:0, width:"10px",
            background:"linear-gradient(90deg,#080402,#2A1A0A,#080402)",
            zIndex:10,
            boxShadow:"0 0 8px rgba(0,0,0,0.8)",
          }}/>
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// SETTINGS PAGE
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SettingsPage({ t, settings, onUpdateSettings, goals, randomReadings }) {
  const [showShare, setShowShare] = useState(false);
  const tog = k => onUpdateSettings({...settings,[k]:!settings[k]});
  const TR = ({label,desc,k,icon})=>(
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 0",borderBottom:`1px solid ${t.border}`}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:"10px",flex:1}}>
        <Icon type={icon} size={15} color={t.textM} style={{marginTop:"2px"}}/>
        <div><p style={{fontSize:"15px",color:t.text}}>{label}</p>{desc&&<p style={{fontSize:"12px",color:t.textM,marginTop:"1px"}}>{desc}</p>}</div>
      </div>
      <div onClick={()=>tog(k)} style={{width:"42px",height:"23px",borderRadius:"12px",background:settings[k]?t.acc:t.border,position:"relative",cursor:"pointer",transition:"background 0.2s",flexShrink:0,marginLeft:"12px"}}>
        <div style={{position:"absolute",top:"2px",left:settings[k]?"21px":"2px",width:"19px",height:"19px",borderRadius:"50%",background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.2)"}}/>
      </div>
    </div>
  );
  return (
    <div style={{flex:1,overflowY:"auto",padding:"16px"}}>
      {showShare&&<SharePage t={t} goals={goals} randomReadings={randomReadings} onClose={()=>setShowShare(false)}/>}
      <button onClick={()=>setShowShare(true)} style={{width:"100%",padding:"15px 18px",borderRadius:"14px",cursor:"pointer",background:`linear-gradient(135deg,${t.acc},${t.accL})`,border:"none",marginBottom:"16px",textAlign:"left",boxShadow:`0 4px 18px ${t.acc}40`,display:"flex",alignItems:"center",gap:"12px"}}>
        <Icon type="share" size={20} color="#fff"/>
        <div><p style={{fontFamily:"'Playfair Display',serif",fontSize:"16px",color:"#fff",fontWeight:600}}>Share My Reading Journey</p><p style={{fontSize:"13px",color:"rgba(255,255,255,0.8)",marginTop:"2px"}}>Open your personalized Bible reading heatmap</p></div>
      </button>
      <div style={{background:t.bgCard,border:`1px solid ${t.border}`,borderRadius:"14px",padding:"0 16px",marginBottom:"16px"}}>
        <TR label="Dark Mode" desc="Warmer dark parchment theme" k="darkMode" icon={settings.darkMode?"moon":"sun"}/>
        <TR label="Sound Effects" desc="Choir fanfare when completing a chapter" k="audio" icon="audio"/>
        <TR label="Cross-Goal Sharing" desc="Reading a chapter counts toward all plans" k="crossGoalSharing" icon="link"/>
        <TR label="Auto-scroll to Next Chapter" desc="Jump to your next unread chapter on load" k="autoScroll" icon="arrow-right"/>
      </div>
      <div style={{background:t.bgCard,border:`1px solid ${t.border}`,borderRadius:"14px",padding:"16px"}}>
        <p style={{fontFamily:"'Playfair Display',serif",fontSize:"15px",color:t.text,fontWeight:600,marginBottom:"8px"}}>About Scripture</p>
        <p style={{fontSize:"13px",color:t.textM,lineHeight:1.7}}>A personal Bible reading tracker. All data is stored locally in your browser.</p>
        <p style={{fontSize:"12px",color:t.textL,marginTop:"8px"}}>1,189 chapters Â· 66 books Â· 2 testaments</p>
      </div>
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// CHAPTER LIST â€” with uncomplete on click
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ChapterList({ t, goal, onComplete, onUncomplete, autoScroll }) {
  const nextRef = useRef(null);
  const [showFull, setShowFull] = useState(false);

  useEffect(()=>{if(autoScroll&&nextRef.current)setTimeout(()=>nextRef.current?.scrollIntoView({behavior:"smooth",block:"center"}),350);},[goal.id,autoScroll]);

  // Sort by timestamp (completion order)
  const sorted=[...(goal.readings||[])].sort((a,b)=>(a.ts||new Date(a.date+"T12:00:00").getTime())-(b.ts||new Date(b.date+"T12:00:00").getTime()));
  const doneInOrder=sorted.map(r=>r.chapter).filter((c,i,a)=>a.indexOf(c)===i);
  const doneSet=new Set(doneInOrder);
  const dateMap={};
  sorted.forEach(r=>{if(!dateMap[r.chapter])dateMap[r.chapter]=r.date;});

  const remaining=goal.chapters.filter(c=>!doneSet.has(c));
  const nextCh=remaining[0]||null;
  const histShow=showFull?doneInOrder:doneInOrder.slice(-3);

  // Group remaining by book
  const groups=[];
  let curBk=null;
  remaining.forEach(ch=>{const pts=ch.split(" ");const n=pts[pts.length-1];const bk=pts.slice(0,-1).join(" ");if(bk!==curBk){curBk=bk;groups.push({bk,chs:[]});}groups[groups.length-1].chs.push({ch,n});});

  const handleClick=(e,ch)=>{
    const r=e.currentTarget.getBoundingClientRect();
    onComplete(ch,{x:r.left+r.width/2,y:r.top+r.height/2});
  };

  return (
    <div style={{flex:1,overflowY:"auto",padding:"12px 16px"}}>
      {/* History â€” clickable to uncomplete */}
      {doneInOrder.length>0&&<div style={{marginBottom:"8px"}}>
        {doneInOrder.length>3&&<button onClick={()=>setShowFull(v=>!v)} style={{display:"flex",alignItems:"center",gap:"6px",width:"100%",padding:"7px 10px",background:"none",border:`1px dashed ${t.border}`,borderRadius:"8px",color:t.textM,cursor:"pointer",fontSize:"13px",marginBottom:"5px",justifyContent:"center"}}>
          <Icon type="chevron-down" size={13} color={t.textM} style={{transform:showFull?"rotate(180deg)":"none",transition:"transform 0.2s"}}/>
          {showFull?"Hide history":`${doneInOrder.length-3} more completed`}
        </button>}

        {histShow.map(ch=>(
          <div key={ch} className="donebtn"
            onClick={()=>onUncomplete(ch)}
            title="Click to mark as unread"
            style={{
              display:"flex",alignItems:"center",justifyContent:"space-between",
              padding:"8px 12px",borderRadius:"8px",marginBottom:"3px",
              background:t.doneBg,opacity:0.7,cursor:"pointer",
              transition:"opacity 0.15s,background 0.15s",
            }}
            onMouseOver={e=>{e.currentTarget.style.opacity="0.95";e.currentTarget.style.background=t.border;}}
            onMouseOut={e=>{e.currentTarget.style.opacity="0.7";e.currentTarget.style.background=t.doneBg;}}>
            <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
              <Icon type="check-circle" size={13} color={t.gold}/>
              <span style={{fontSize:"14px",color:t.done,textDecoration:"line-through"}}>{ch}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
              <span style={{fontSize:"11px",color:t.textL}}>{dateMap[ch]?fmtDate(dateMap[ch]):""}</span>
              <Icon type="undo" size={11} color={t.textL}/>
            </div>
          </div>
        ))}
      </div>}

      {/* Next Chapter */}
      {nextCh&&<div ref={nextRef} style={{marginBottom:"14px",animation:"fadeUp 0.3s ease"}}>
        <p style={{fontSize:"11px",color:t.textM,letterSpacing:"0.08em",marginBottom:"6px",fontWeight:600}}>UP NEXT</p>
        <button onClick={e=>handleClick(e,nextCh)} className="chbtn"
          style={{width:"100%",padding:"16px 18px",borderRadius:"12px",cursor:"pointer",background:`linear-gradient(135deg,${t.accBg},${t.bgCard})`,border:`2px solid ${t.acc}`,display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:`0 4px 16px ${t.acc}18`,animation:"glow 2.5s infinite"}}>
          <div style={{textAlign:"left"}}>
            <p style={{fontFamily:"'Playfair Display',serif",fontSize:"19px",color:t.acc,fontWeight:700}}>{nextCh}</p>
            <p style={{fontSize:"12px",color:t.textM,marginTop:"2px"}}>{remaining.length} chapter{remaining.length!==1?"s":""} remaining</p>
          </div>
          <div style={{width:"44px",height:"44px",borderRadius:"50%",background:t.acc,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <Icon type="check" size={20} color="#fff" strokeWidth={2.5}/>
          </div>
        </button>
      </div>}

      {/* Coming up */}
      {remaining.length>1&&<div>
        <p style={{fontSize:"11px",color:t.textM,letterSpacing:"0.08em",marginBottom:"8px",fontWeight:600}}>COMING UP</p>
        {groups.map(({bk,chs},gi)=>(
          <div key={`${bk}-${gi}`} style={{marginBottom:"10px"}}>
            <p style={{fontSize:"12px",color:t.textM,marginBottom:"5px",fontStyle:"italic",fontFamily:"'Playfair Display',serif"}}>{bk}</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:"4px"}}>
              {chs.map(({ch,n},idx)=>{
                if(gi===0&&idx===0) return null;
                return <button key={ch} onClick={e=>handleClick(e,ch)} className="chbtn"
                  style={{padding:"5px 10px",borderRadius:"6px",cursor:"pointer",background:t.bgCard,border:`1px solid ${t.border}`,color:t.text,fontSize:"13px"}}
                  onMouseOver={e=>{e.currentTarget.style.borderColor=t.acc;e.currentTarget.style.background=t.accBg;}}
                  onMouseOut={e=>{e.currentTarget.style.borderColor=t.border;e.currentTarget.style.background=t.bgCard;}}>{n}</button>;
              })}
            </div>
          </div>
        ))}
      </div>}

      {remaining.length===0&&doneInOrder.length>0&&(
        <div style={{textAlign:"center",padding:"36px 16px",animation:"fadeUp 0.4s ease"}}>
          <Icon type="trophy" size={44} color={t.gold}/>
          <p style={{fontFamily:"'Playfair Display',serif",fontSize:"22px",color:t.gold,fontWeight:700,marginTop:"14px"}}>Plan Complete!</p>
          <p style={{fontSize:"14px",color:t.textM,marginTop:"6px"}}>You've finished {goal.name}</p>
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// MAIN APP
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function App() {
  const [goals, setGoals] = useState([]);
  const [activeGoalId, setActiveGoalId] = useState(null);
  const [randomReadings, setRandomReadings] = useState([]);
  const [settings, setSettings] = useState({darkMode:false,crossGoalSharing:false,autoScroll:true,audio:true});
  const [page, setPage] = useState("main");
  const [showNewGoal, setShowNewGoal] = useState(false);
  const [showRandom, setShowRandom] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [confettiOrigin, setConfettiOrigin] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const t = settings.darkMode ? D : L;

  useEffect(()=>{
    async function load(){
      try{
        const [g,ag,rr,s]=await Promise.all([
          storage.get("sc_goals").catch(()=>null),
          storage.get("sc_active").catch(()=>null),
          storage.get("sc_random").catch(()=>null),
          storage.get("sc_settings").catch(()=>null),
        ]);
        if(g?.value) setGoals(JSON.parse(g.value));
        if(ag?.value) setActiveGoalId(ag.value);
        if(rr?.value) setRandomReadings(JSON.parse(rr.value));
        if(s?.value) setSettings(p=>({...p,...JSON.parse(s.value)}));
      }catch(e){}
      setLoaded(true);
    }
    load();
  },[]);

  useEffect(()=>{if(loaded) storage.set("sc_goals",JSON.stringify(goals)).catch(()=>{});},[goals,loaded]);
  useEffect(()=>{if(loaded) storage.set("sc_active",activeGoalId||"").catch(()=>{});},[activeGoalId,loaded]);
  useEffect(()=>{if(loaded) storage.set("sc_random",JSON.stringify(randomReadings)).catch(()=>{});},[randomReadings,loaded]);
  useEffect(()=>{if(loaded) storage.set("sc_settings",JSON.stringify(settings)).catch(()=>{});},[settings,loaded]);

  const activeGoal = goals.find(g=>g.id===activeGoalId)||null;

  const handleCreate = ng => { setGoals(p=>[...p,ng]); setActiveGoalId(ng.id); setShowNewGoal(false); };

  // Complete a chapter (with fanfare) â€” only fires if not already done
  const handleComplete = (ch, origin) => {
    const alreadyDone = (activeGoal?.readings||[]).some(r=>r.chapter===ch);
    if (alreadyDone) return; // prevent double-complete on "next" button if already done

    setConfettiOrigin(origin);
    if (settings.audio) playChoir();
    setTimeout(()=>setConfettiOrigin(null), 1900);

    setGoals(p=>p.map(g=>{
      const shouldUpd = g.id===activeGoalId || (settings.crossGoalSharing&&g.chapters.includes(ch)&&g.id!==activeGoalId);
      if(!shouldUpd) return g;
      if((g.readings||[]).some(r=>r.chapter===ch)) return g;
      return {...g, readings:[...(g.readings||[]),{chapter:ch,date:todayStr(),ts:Date.now()}]};
    }));
  };

  // Uncomplete a chapter â€” removes it from the active goal only
  const handleUncomplete = ch => {
    setGoals(p=>p.map(g=>{
      if(g.id!==activeGoalId) return g;
      return {...g, readings:(g.readings||[]).filter(r=>r.chapter!==ch)};
    }));
  };

  const handleLogRandom = ch => setRandomReadings(p=>[...p,{chapter:ch,date:todayStr(),ts:Date.now()}]);

  const doneCount = activeGoal ? new Set((activeGoal.readings||[]).map(r=>r.chapter)).size : 0;
  const totCount = activeGoal?.chapters?.length||0;
  const prog = totCount>0 ? doneCount/totCount : 0;

  const activeGoals = goals.filter(g=>new Set((g.readings||[]).map(r=>r.chapter)).size<g.chapters.length||g.chapters.length===0);
  const compGoals  = goals.filter(g=>g.chapters.length>0&&new Set((g.readings||[]).map(r=>r.chapter)).size>=g.chapters.length);

  if(!loaded) return (
    <div style={{width:"100%",height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:L.bg}}>
      <div style={{textAlign:"center"}}><Icon type="book" size={32} color={L.accL}/><p style={{fontFamily:"'Playfair Display',serif",color:L.textM,fontSize:"15px",marginTop:"12px"}}>Loadingâ€¦</p></div>
    </div>
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{__html:GS}}/>
      <div style={{width:"100%",height:"100vh",display:"flex",flexDirection:"column",background:t.bg,color:t.text,fontFamily:"'Crimson Text',Georgia,serif",transition:"background 0.3s"}}>
        {confettiOrigin&&<Confetti origin={confettiOrigin}/>}
        {showNewGoal&&<NewGoalModal t={t} onClose={()=>setShowNewGoal(false)} onCreate={handleCreate}/>}
        {showRandom&&<RandomModal t={t} onClose={()=>setShowRandom(false)} onLog={handleLogRandom}/>}

        {/* TOP BAR */}
        <div style={{padding:"12px 16px 10px",borderBottom:`1px solid ${t.border}`,background:t.nav,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"8px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"9px"}}>
              <Icon type="book" size={22} color={t.acc}/>
              <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:"21px",color:t.text,fontWeight:700,letterSpacing:"-0.02em"}}>Scripture</h1>
            </div>
            <div style={{display:"flex",gap:"6px"}}>
              <button onClick={()=>setShowRandom(true)} style={{padding:"6px 10px",borderRadius:"8px",border:`1px solid ${t.border}`,background:t.bg,color:t.textM,cursor:"pointer",display:"flex",alignItems:"center",gap:"5px"}}>
                <Icon type="bookmark" size={14} color={t.textM}/>
                <span style={{fontSize:"13px"}}>Log</span>
              </button>
              <button onClick={()=>setShowNewGoal(true)} style={{padding:"6px 12px",borderRadius:"8px",border:"none",background:t.acc,color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",gap:"5px"}}>
                <Icon type="plus" size={14} color="#fff"/>
                <span style={{fontSize:"13px",fontWeight:600}}>Plan</span>
              </button>
            </div>
          </div>

          {goals.length>0?(
            <div style={{position:"relative"}}>
              <button onClick={()=>setShowPicker(v=>!v)} style={{display:"flex",alignItems:"center",gap:"8px",padding:"7px 10px",borderRadius:"9px",cursor:"pointer",border:`1px solid ${t.border}`,background:t.bg,width:"100%"}}>
                <Icon type="target" size={14} color={t.acc}/>
                <div style={{flex:1,textAlign:"left",overflow:"hidden"}}>
                  <p style={{fontSize:"13px",color:t.acc,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{activeGoal?.name||"Select a plan"}</p>
                  {activeGoal&&<p style={{fontSize:"11px",color:t.textM}}>{doneCount}/{totCount} Â· {Math.round(prog*100)}%</p>}
                </div>
                <Icon type="chevron-down" size={13} color={t.textM}/>
              </button>

              {showPicker&&<div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:t.bgEl,border:`1px solid ${t.borderS}`,borderRadius:"10px",zIndex:100,overflow:"hidden",boxShadow:`0 8px 24px ${t.shS}`,animation:"fadeUp 0.15s ease"}}>
                {activeGoals.map(g=>{const gc=new Set((g.readings||[]).map(r=>r.chapter)).size;return(
                  <button key={g.id} onClick={()=>{setActiveGoalId(g.id);setShowPicker(false);}} style={{display:"flex",alignItems:"center",gap:"10px",width:"100%",padding:"10px 14px",textAlign:"left",background:g.id===activeGoalId?t.accBg:"none",border:"none",borderBottom:`1px solid ${t.border}`,cursor:"pointer"}}>
                    <Icon type="target" size={13} color={g.id===activeGoalId?t.acc:t.textL}/>
                    <div style={{flex:1}}><p style={{fontSize:"14px",color:g.id===activeGoalId?t.acc:t.text,fontWeight:g.id===activeGoalId?600:400}}>{g.name}</p><p style={{fontSize:"12px",color:t.textM}}>{gc}/{g.chapters.length} Â· {g.chapters.length>0?Math.round((gc/g.chapters.length)*100):0}%</p></div>
                  </button>
                );})}
                {compGoals.length>0&&<>
                  <div style={{padding:"6px 14px 4px",background:t.bg}}><p style={{fontSize:"10px",color:t.textL,letterSpacing:"0.07em",fontWeight:600}}>COMPLETED PLANS</p></div>
                  {compGoals.map(g=>(
                    <button key={g.id} onClick={()=>{setActiveGoalId(g.id);setShowPicker(false);}} style={{display:"flex",alignItems:"center",gap:"10px",width:"100%",padding:"9px 14px",textAlign:"left",background:g.id===activeGoalId?t.goldL:"none",border:"none",borderBottom:`1px solid ${t.border}`,cursor:"pointer",opacity:0.8}}>
                      <Icon type="trophy" size={13} color={t.gold}/>
                      <div><p style={{fontSize:"14px",color:t.textM}}>{g.name}</p><p style={{fontSize:"11px",color:t.textL}}>Complete Â· {g.chapters.length} chapters</p></div>
                    </button>
                  ))}
                </>}
              </div>}
            </div>
          ):<p style={{fontSize:"13px",color:t.textM}}>Create a plan to begin tracking your reading â†’</p>}

          {activeGoal&&<div style={{height:"3px",background:t.doneBg,borderRadius:"2px",marginTop:"8px",overflow:"hidden"}}>
            <div style={{height:"100%",width:`${prog*100}%`,background:`linear-gradient(90deg,${t.acc},${t.gold})`,borderRadius:"2px",transition:"width 0.4s ease"}}/>
          </div>}
        </div>

        {/* PAGE CONTENT */}
        <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}} onClick={()=>showPicker&&setShowPicker(false)}>
          {page==="main"&&(activeGoal
            ? <ChapterList t={t} goal={activeGoal} onComplete={handleComplete} onUncomplete={handleUncomplete} autoScroll={settings.autoScroll}/>
            : <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px",textAlign:"center"}}>
                <Icon type="book" size={52} color={t.borderS}/>
                <p style={{fontFamily:"'Playfair Display',serif",fontSize:"23px",color:t.text,fontWeight:700,marginTop:"16px"}}>Welcome to Scripture</p>
                <p style={{fontSize:"15px",color:t.textM,marginTop:"8px",maxWidth:"280px",lineHeight:1.7}}>Create your first reading plan to start tracking your journey through the Bible.</p>
                <button onClick={()=>setShowNewGoal(true)} style={{marginTop:"22px",padding:"12px 26px",borderRadius:"10px",background:t.acc,color:"#fff",border:"none",cursor:"pointer",fontSize:"16px",fontFamily:"'Playfair Display',serif",fontWeight:600,boxShadow:`0 4px 16px ${t.acc}40`,display:"flex",alignItems:"center",gap:"8px"}}>
                  <Icon type="plus" size={16} color="#fff"/> Create a Plan
                </button>
              </div>
          )}
          {page==="analytics"&&<AnalyticsPage t={t} goals={goals} activeGoalId={activeGoalId} randomReadings={randomReadings}/>}
          {page==="settings"&&<SettingsPage t={t} settings={settings} onUpdateSettings={setSettings} goals={goals} randomReadings={randomReadings}/>}
        </div>

        {/* BOTTOM NAV */}
        <div style={{borderTop:`1px solid ${t.border}`,background:t.nav,display:"flex",flexShrink:0}}>
          {[{id:"main",icon:"book",label:"Reading"},{id:"analytics",icon:"chart",label:"Analytics"},{id:"settings",icon:"settings",label:"Settings"}].map(tab=>(
            <button key={tab.id} onClick={()=>setPage(tab.id)} style={{flex:1,padding:"10px 4px 12px",border:"none",cursor:"pointer",background:"none",display:"flex",flexDirection:"column",alignItems:"center",gap:"3px"}}>
              <Icon type={tab.icon} size={20} color={page===tab.id?t.acc:t.textM}/>
              <span style={{fontSize:"10px",color:page===tab.id?t.acc:t.textM,fontWeight:page===tab.id?600:400,letterSpacing:"0.04em"}}>{tab.label}</span>
              {page===tab.id&&<div style={{width:"18px",height:"2px",background:t.acc,borderRadius:"1px"}}/>}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

