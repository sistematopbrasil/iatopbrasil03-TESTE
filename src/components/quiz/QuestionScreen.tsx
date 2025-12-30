import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ArrowRight } from "lucide-react";
import { Question } from "./types";
import logoIcon from "@/assets/logo-icon.png";

interface QuestionScreenProps {
  question: Question;
  onAnswer: (questionId: number, answer: string) => void;
  progress: number;
  questionNumber: number;
  totalQuestions: number;
  currentAnswer?: string;
}

export const QuestionScreen = ({
  question,
  onAnswer,
  progress,
  questionNumber,
  totalQuestions,
  currentAnswer,
}: QuestionScreenProps) => {
  const [inputValue, setInputValue] = useState(currentAnswer || "");
  const [error, setError] = useState("");

  const validateAndSubmit = () => {
    if (question.required && !inputValue.trim()) {
      setError("Por favor, responda esta pergunta para continuar.");
      return;
    }

    if (question.type === "tel" && inputValue) {
      const phoneRegex = /^[\d\s\-\(\)]+$/;
      if (!phoneRegex.test(inputValue)) {
        setError("Por favor, insira um telefone válido.");
        return;
      }
    }

    if (question.type === "number" && inputValue) {
      const age = parseInt(inputValue);
      if (age < 18 || age > 100) {
        setError("Por favor, insira uma idade válida (18-100).");
        return;
      }
    }

    setError("");
    onAnswer(question.id, inputValue);
    setInputValue("");
  };

  const handleChoiceClick = (option: string) => {
    setInputValue(option);
    setError("");
    setTimeout(() => {
      onAnswer(question.id, option);
      setInputValue("");
    }, 200);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && question.type !== "textarea") {
      e.preventDefault();
      validateAndSubmit();
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-start justify-center p-4 pt-12 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-radial opacity-50"></div>

      <div className="w-full max-w-2xl relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <img src={logoIcon} alt="TOP Brasil" className="h-12 w-auto" />
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-muted-foreground">
              Pergunta {questionNumber} de {totalQuestions}
            </span>
            <span className="text-sm font-semibold text-primary">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2 bg-muted" />
        </div>

        {/* Question Card */}
        <div className="bg-card border border-border rounded-3xl p-8 md:p-12 shadow-2xl shadow-primary/10 animate-slide-in-right">
          {/* Question */}
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-8 leading-tight">
            {question.question}
          </h2>

          {/* Input Fields */}
          {question.type === "text" && (
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={question.placeholder}
              className="text-lg p-6 bg-background border-border focus:border-primary focus:ring-primary"
              onKeyPress={handleKeyPress}
              autoFocus
            />
          )}

          {question.type === "tel" && (
            <Input
              type="tel"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={question.placeholder}
              className="text-lg p-6 bg-background border-border focus:border-primary focus:ring-primary"
              onKeyPress={handleKeyPress}
              autoFocus
            />
          )}

          {question.type === "number" && (
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={inputValue}
              onChange={(e) => {
                // Aceitar apenas dígitos
                const value = e.target.value.replace(/\D/g, '');
                setInputValue(value);
              }}
              placeholder={question.placeholder}
              className="text-lg p-6 bg-background border-border focus:border-primary focus:ring-primary"
              onKeyPress={handleKeyPress}
              autoFocus
            />
          )}

          {question.type === "textarea" && (
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={question.placeholder}
              className="text-lg p-6 min-h-[150px] bg-background border-border focus:border-primary focus:ring-primary resize-none"
              autoFocus
            />
          )}

          {question.type === "choice" && question.options && (
            <div className="space-y-3">
              {question.options.map((option, index) => (
                <Button
                  key={index}
                  variant={inputValue === option ? "default" : "outline"}
                  className="w-full text-left justify-start p-6 text-lg h-auto whitespace-normal break-words"
                  onClick={() => handleChoiceClick(option)}
                >
                  {option}
                </Button>
              ))}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <p className="text-destructive text-sm mt-4 animate-slide-in-up">{error}</p>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-4 mt-8">
            {question.type !== "choice" && (
              <Button
                onClick={validateAndSubmit}
                className="flex-1"
                disabled={!inputValue.trim()}
              >
                {questionNumber === totalQuestions ? "Finalizar" : "Próxima"}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
