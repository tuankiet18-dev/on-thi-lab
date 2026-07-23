import type { Exam } from "@onthilab/contracts";

export const demoExam: Exam = {
  id: "demo-swd392-sp26-fe",
  code: "SWD392-SP26-FE",
  courseCode: "SWD392",
  courseName: "Software Architecture and Design",
  semester: "Spring 2026",
  campus: "Hòa Lạc",
  examType: "FE",
  isRetake: false,
  durationMinutes: 60,
  questionCount: 5,
  publishedAt: "2026-06-20T08:00:00.000Z",
  answerConfidence: "reviewed",
  shuffleQuestions: true,
  instructions: [
    "Đây là điểm số tham khảo, không phải kết quả chính thức của nhà trường.",
    "Bài thi không thể tạm dừng và sẽ tự động nộp khi hết giờ.",
    "Câu nhiều đáp án chỉ được tính đúng khi chọn chính xác toàn bộ đáp án.",
  ],
  questions: [
    {
      id: "q1",
      order: 1,
      imageUrl: "/demo/question-001.svg",
      imageAlt: "Câu hỏi về software modeling với bốn lựa chọn A đến D",
      type: "single",
      options: ["A", "B", "C", "D"],
    },
    {
      id: "q2",
      order: 2,
      imageUrl: "/demo/question-002.svg",
      imageAlt: "Câu hỏi về software design concept với bốn lựa chọn",
      type: "single",
      options: ["A", "B", "C", "D"],
    },
    {
      id: "q3",
      order: 3,
      imageUrl: "/demo/question-003.svg",
      imageAlt: "Câu hỏi chọn nhiều đáp án về nguyên lý thiết kế",
      type: "multiple",
      options: ["A", "B", "C", "D"],
    },
    {
      id: "q4",
      order: 4,
      imageUrl: "/demo/question-004.svg",
      imageAlt: "Câu hỏi về architectural pattern với bốn lựa chọn",
      type: "single",
      options: ["A", "B", "C", "D"],
    },
    {
      id: "q5",
      order: 5,
      imageUrl: "/demo/question-005.svg",
      imageAlt: "Câu hỏi chọn nhiều đáp án về quality attributes",
      type: "multiple",
      options: ["A", "B", "C", "D", "E", "F"],
    },
  ],
};

export const demoAnswerKey: Record<string, number[]> = {
  q1: [1],
  q2: [2],
  q3: [0, 2],
  q4: [3],
  q5: [0, 1, 4],
};
