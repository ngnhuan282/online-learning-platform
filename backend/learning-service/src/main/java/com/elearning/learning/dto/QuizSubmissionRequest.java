package com.elearning.learning.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record QuizSubmissionRequest(@NotNull List<@NotNull @Valid Answer> answers) {
    public record Answer(@NotNull Long questionId, @NotNull List<@NotNull Long> optionIds) {}
}
