package com.elearning.learning.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;

import com.elearning.learning.dto.ToeicModels.Definition;
import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

class ToeicDictionaryServiceTests {

    @Test
    void lookup_whenInflectedTermMatchesReadingVocabulary_shouldReturnIndexedHeadword() {
        // Arrange
        var mapper = mock(JsonMapper.class);
        var reader = JsonMapper.builder().build();
        String explanation = """
            Tạm dịch: Nhân viên cập nhật lịch.
            Từ vựng
            (A) update: verb (cập nhật)
            preview (v) xem trước
            study (v) học
            box (n) hộp
            plan (v) lập kế hoạch
            happy (adj) hạnh phúc
            change (v) thay đổi
            large (adj) lớn
            stop (v) dừng
            """;
        Definition exam = reader.readValue("""
            {"questions":[{
                "prompt":"The staff --- the schedule.",
                "options":[{"id":"A","text":"update"}],
                "correctOptionId":"A",
                "explanation":%s
            }, {"prompt":"Question without vocabulary"}]}
            """.formatted(reader.writeValueAsString(explanation)), Definition.class);
        Definition withoutQuestions = reader.readValue("{}", Definition.class);
        doReturn(List.of(withoutQuestions, exam))
            .when(mapper)
            .readValue(any(InputStream.class), any(TypeReference.class));
        var dictionary = new ToeicDictionaryService(mapper);
        dictionary.init();
        var expectedHeadwords = Map.of(
            "studies", "study",
            "studied", "study",
            "boxes", "box",
            "previewed", "preview",
            "planning", "plan",
            "stopped", "stop",
            "happily", "happy",
            "changing", "change",
            "larger", "large",
            "largest", "large"
        );

        // Act
        var headwords = new HashMap<String, String>();
        expectedHeadwords.keySet().forEach(form -> headwords.put(form, dictionary.lookup(form).headword()));
        var normalized = dictionary.lookup("  ‘UPDATE!’ ");
        var missing = dictionary.lookup(null);
        var unknown = dictionary.lookup("two unknown words");

        // Assert
        assertThat(headwords).isEqualTo(expectedHeadwords);
        assertThat(normalized.meanings()).anySatisfy(meaning -> {
            assertThat(meaning.partOfSpeech()).isEqualTo("Động từ (v)");
            assertThat(meaning.meaningVi()).isEqualTo("cập nhật");
            assertThat(meaning.exampleEn()).isEqualTo("The staff update the schedule.");
            assertThat(meaning.exampleVi()).isEqualTo("Nhân viên cập nhật lịch.");
        });
        assertThat(missing.found()).isFalse();
        assertThat(unknown.relatedForms()).isEmpty();
    }

    @Test
    void lookup_whenReadingCatalogCannotBeIndexed_shouldRetainCoreWords() {
        // Arrange
        var mapper = mock(JsonMapper.class);
        doThrow(new IllegalStateException("Missing reading catalog"))
            .when(mapper).readValue(any(InputStream.class), any(TypeReference.class));
        var dictionary = new ToeicDictionaryService(mapper);
        dictionary.init();

        // Act
        var coreWord = dictionary.lookup("accommodate");
        var unknown = dictionary.lookup("unindexed-word");

        // Assert
        assertThat(coreWord.found()).isTrue();
        assertThat(unknown.found()).isFalse();
    }
}
