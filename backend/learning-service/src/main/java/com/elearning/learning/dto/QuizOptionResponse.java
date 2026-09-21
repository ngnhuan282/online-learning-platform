package com.elearning.learning.dto;

import com.elearning.learning.entity.QuizOption;

public record QuizOptionResponse(Long id, String optionText, Integer position) {
    public static QuizOptionResponse from(QuizOption option) {
        return new QuizOptionResponse(option.getId(), option.getOptionText(), option.getPosition());
    }
}
