package com.elearning.auth.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.nio.charset.StandardCharsets;

// OIDC subjects are case-sensitive; never use MySQL's default case-insensitive text collation.
@Converter
public class ProviderSubjectConverter implements AttributeConverter<String, byte[]> {

    @Override
    public byte[] convertToDatabaseColumn(String subject) {
        return subject == null ? null : subject.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    public String convertToEntityAttribute(byte[] subject) {
        return subject == null ? null : new String(subject, StandardCharsets.UTF_8);
    }
}
