export type ExamFormatStatus = "fe_candidate" | "requires_review" | "not_fe";

export interface PriorityCourse {
  sourceId: number;
  code: string;
  name: string;
  termNumber: number;
  priorityWave: number;
  examFormatStatus: ExamFormatStatus;
}

const requiresFormatReview = new Set([
  "LAB211",
  "SWP391",
  "WDU203c",
  "OJT202",
  "EXE101",
  "EXE201",
  "PRJ301",
  "PRU213",
  "PRM393",
]);

const rawPriorityCourses = [
  [7, "CSI106", "Introduction to Computer Science", 1],
  [8, "SSL101c", "Academic Skills for University Success", 1],
  [9, "PRF192", "Programming Fundamentals", 1],
  [10, "MAE101", "Mathematics for Engineering", 1],
  [11, "CEA201", "Computer Organization and Architecture", 1],
  [12, "PRO192", "Object-Oriented Programming", 2],
  [13, "MAD101", "Discrete mathematics", 2],
  [14, "OSG202", "Operating Systems", 2],
  [15, "NWC204", "Computer Networking", 2],
  [16, "SSG104", "Communication and In-Group Working Skills", 2],
  [17, "CSD201", "Data Structures and Algorithms", 3],
  [18, "DBI202", "Database Systems", 3],
  [19, "LAB211", "OOP with Java Lab", 3],
  [20, "JPD113", "Elementary Japanese 1- A1.1", 3],
  [21, "WED201c", "Web Design", 3],
  [22, "SWE201c", "Introduction to Software Engineering", 4],
  [23, "JPD123", "Elementary Japanese 1-A1.2", 4],
  [24, "IOT102", "Internet of Things", 4],
  [25, "PRJ301", "Java Web application development", 4],
  [26, "MAS291", "Statistics & Probability", 4],
  [27, "SWR302", "Software Requirements", 5],
  [28, "SWT301", "Software Testing", 5],
  [29, "SWP391", "Software development project", 5],
  [30, "WDU203c", "The UI/UX Design", 5],
  [31, "PRN212", "BasicCross-Platform Application Programming With .NET", 5],
  [32, "ENW493c", "Research Methods & Academic Writing Skills", 6],
  [33, "OJT202", "On the job training", 6],
  [34, "EXE101", "Experiential Entrepreneurship 1", 7],
  [35, "PMG201c", "Project Management", 7],
  [
    36,
    "PRN222",
    "Advanced Cross-Platform Application Programming With .NET",
    7,
  ],
  [37, "PRU213", "Game Programming with C#", 7],
  [38, "SWD392", "Software Architecture and Design", 7],
  [39, "PRM393", "Mobile Programming", 8],
  [40, "PRN232", "Building Cross-Platform Back-End Application With .NET", 8],
  [41, "EXE201", "Experiential Entrepreneurship 2", 8],
  [42, "ITE302c", "Ethics in IT", 8],
  [43, "MLN122", "Political economics of Marxism – Leninism", 8],
  [44, "MLN111", "Philosophy of Marxism – Leninism", 8],
  [45, "MLN131", "Scientific socialism", 9],
  [46, "VNR202", "History of Vietnam Communist Party", 9],
  [47, "HCM202", "Ho Chi Minh Ideology", 9],
] as const;

function priorityWaveForTerm(termNumber: number): number {
  if (termNumber <= 3) return 1;
  if (termNumber <= 5) return 2;
  if (termNumber <= 7) return 3;
  return 4;
}

export const priorityCourses: PriorityCourse[] = rawPriorityCourses.map(
  ([sourceId, code, name, termNumber]) => ({
    sourceId,
    code,
    name,
    termNumber,
    priorityWave: priorityWaveForTerm(termNumber),
    examFormatStatus: requiresFormatReview.has(code)
      ? "requires_review"
      : "fe_candidate",
  }),
);

export const initialCampuses = [
  { code: "HL", name: "Hòa Lạc" },
  { code: "HCM", name: "Hồ Chí Minh" },
  { code: "DN", name: "Đà Nẵng" },
  { code: "CT", name: "Cần Thơ" },
  { code: "QN", name: "Quy Nhơn" },
] as const;

export const initialMajor = {
  code: "SE",
  name: "Software Engineering",
} as const;

export const initialCurriculum = {
  code: "SE-ONT-2026",
  name: "Software Engineering — OnThiLab priority curriculum",
  effectiveFrom: "2026",
} as const;
