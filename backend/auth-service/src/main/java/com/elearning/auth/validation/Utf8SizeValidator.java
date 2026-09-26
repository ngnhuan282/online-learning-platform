package com.elearning.auth.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.nio.charset.StandardCharsets;

public class Utf8SizeValidator implements ConstraintValidator<Utf8Size, String> {

    private int max;

    @Override
    public void initialize(Utf8Size constraint) {
        max = constraint.max();
    }

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        // Presence is handled by @NotBlank; BCrypt limits bytes, not characters.
        return value == null || value.getBytes(StandardCharsets.UTF_8).length <= max;
    }
}
