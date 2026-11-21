package com.elearning.learning;

import static org.assertj.core.api.Assertions.*;

import com.elearning.learning.dto.DictationModels.Edit;
import com.elearning.learning.dto.DictationModels.Feedback;
import com.elearning.learning.service.DictationGrader;
import java.util.List;
import org.junit.jupiter.api.Test;

class DictationGraderTests {

    private final DictationGrader grader = new DictationGrader();

    @Test
    void grade_whenShortAnswerIsMistyped_shouldAlignWithFirstWord() {
        // Arrange
        String shortTranscript = "I agree.";
        String longTranscript = "The food was great, by the way.";

        // Act
        var grade = grader.grade(shortTranscript, "aaaa");
        var longAnswer = grader.grade(longTranscript, "a");

        // Assert
        assertThat(grade.words()).containsExactly(
            new Edit("wrong", "i", "aaaa"),
            new Edit("missing", "agree", null)
        );
        assertThat(longAnswer.words().getFirst()).isEqualTo(new Edit("wrong", "the", "a"));
        assertThat(longAnswer.words().subList(1, 7)).allMatch(word -> word.type().equals("missing"));
    }

    @Test
    void grade_whenFirstWordHasTypo_shouldKeepFollowingWordsAligned() {
        // Arrange
        String transcript = "Everybody seemed to enjoy it.";
        String answer = "Everbody seemed to enjoy it";

        // Act
        var grade = grader.grade(transcript, answer);

        // Assert
        assertThat(grade.words().getFirst()).isEqualTo(new Edit("wrong", "everybody", "everbody"));
        assertThat(grade.correct()).isEqualTo(4);
        assertThat(grade.accuracy()).isEqualTo(80);
    }

    @Test
    void grade_whenLeadingWordIsMissingOrExtra_shouldPreserveEditPositions() {
        // Arrange
        String missingFirstWord = "really enjoyed it";
        String extraFirstWord = "Yesterday we enjoyed it";

        // Act
        var missing = grader.grade("We really enjoyed it", missingFirstWord);
        var extra = grader.grade("We enjoyed it", extraFirstWord);

        // Assert
        assertThat(missing.words().getFirst()).isEqualTo(new Edit("missing", "we", null));
        assertThat(missing.correct()).isEqualTo(3);
        assertThat(extra.words().getFirst()).isEqualTo(new Edit("extra", null, "yesterday"));
        assertThat(extra.extra()).isEqualTo(1);
        assertThat(extra.correct()).isEqualTo(3);
    }

    @Test
    void withoutHintCredit_whenWordsRepeat_shouldKeepStableHintIndices() {
        // Arrange
        var grade = grader.grade("We really really enjoyed it.", "we really enjoyed it");

        // Act
        var hintOnCorrectWord = grader.withoutHintCredit(grade, List.of(1));
        var hintOnMissingWord = grader.withoutHintCredit(grade, List.of(2));
        var normalizedGrade = grader.grade("I'll watch it.", "I’LL WATCH IT!");

        // Assert
        assertThat(grade.words().get(1)).isEqualTo(new Edit("correct", "really", "really"));
        assertThat(grade.words().get(2)).isEqualTo(new Edit("missing", "really", null));
        assertThat(hintOnCorrectWord.correct()).isEqualTo(3);
        assertThat(hintOnMissingWord.correct()).isEqualTo(4);
        assertThat(normalizedGrade.accuracy()).isEqualTo(100);
    }

    @Test
    void feedback_whenFinalPrefixIsUnfinished_shouldMarkItPartial() {
        // Arrange
        String transcript = "We really enjoyed it.";
        String partialAnswer = "We re";
        var completedInputs = List.of("We re ", "We re.", "We re wrong");

        // Act
        var partial = grader.feedback(grader.grade(transcript, partialAnswer), partialAnswer);
        var completed = completedInputs.stream().map(answer -> grader.feedback(grader.grade(transcript, answer), answer).get(1)).toList();
        var empty = grader.feedback(grader.grade("Hello.", ""), "");

        // Assert
        assertThat(partial).containsExactly(new Feedback(0, "correct", "we"), new Feedback(1, "partial", null),
            new Feedback(2, "empty", null), new Feedback(3, "empty", null));
        assertThat(completed).hasSize(3).containsOnly(new Feedback(1, "incorrect", null));
        assertThat(empty).containsExactly(new Feedback(0, "empty", null));
    }

    @Test
    void feedback_whenAnswerHasExtraEdits_shouldKeepExpectedWordIndices() {
        // Arrange
        String extraAnswer = "Yesterday we re";
        String missingAnswer = "We really enjoyed it";
        var grade = grader.grade("We really enjoyed it.", extraAnswer);
        var missing = grader.grade("We really really enjoyed it.", missingAnswer);

        // Act
        var extraFeedback = grader.feedback(grade, extraAnswer);
        var missingFeedback = grader.feedback(missing, missingAnswer);
        var safe = grader.redact(grade);

        // Assert
        assertThat(extraFeedback)
            .containsExactly(new Feedback(0, "correct", "we"), new Feedback(1, "partial", null),
                new Feedback(2, "empty", null), new Feedback(3, "empty", null));
        assertThat(safe.words()).extracting(Edit::actual).containsExactly("yesterday", "we", "re", null, null);
        assertThat(safe.words()).extracting(Edit::expected).containsExactly(null, "we", null, null, null);
        assertThat(safe.extra()).isEqualTo(1);
        assertThat(missingFeedback).containsExactly(
            new Feedback(0, "correct", "we"), new Feedback(1, "correct", "really"),
            new Feedback(2, "empty", null), new Feedback(3, "correct", "enjoyed"), new Feedback(4, "correct", "it"));
    }
}
