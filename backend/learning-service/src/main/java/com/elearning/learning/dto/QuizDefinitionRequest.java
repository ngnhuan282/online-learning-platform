package com.elearning.learning.dto;

import com.elearning.learning.entity.enums.QuestionType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;

public record QuizDefinitionRequest(
    @NotNull @Positive Long courseId,
    @Positive Long lessonId,
    @NotBlank @Size(max = 255) String title,
    @Size(max = 1000) String description,
    @NotNull @Min(0) @Max(100) Integer passingScore,
    @Positive Integer timeLimitMinutes,
    @NotEmpty List<@NotNull @Valid Question> questions
) {
    public record Question(
        @NotBlank @Size(max = 1000) String questionText,
        @NotNull QuestionType questionType,
        @NotNull @Positive Integer points,
        @NotEmpty List<@NotNull @Valid Option> options
    ) {}

    public record Option(@NotBlank @Size(max = 1000) String optionText, @NotNull Boolean correct) {}
}
