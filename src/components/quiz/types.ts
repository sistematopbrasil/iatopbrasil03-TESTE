export interface Question {
  id: number;
  type: "text" | "tel" | "number" | "choice" | "textarea";
  question: string;
  placeholder?: string;
  options?: string[];
  required: boolean;
}

export interface QuizData {
  [key: number]: string;
}
