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
    void aShortMistypedAnswerIsAlignedWithTheFirstWordNotTheLast() {
        var grade = grader.grade("I agree.", "aaaa");
        assertThat(grade.words()).containsExactly(
            new Edit("wrong", "i", "aaaa"),
            new Edit("missing", "agree", null)
        );
        var longAnswer = grader.grade("The food was great, by the way.", "a");
        assertThat(longAnswer.words().getFirst()).isEqualTo(new Edit("wrong", "the", "a"));
        assertThat(longAnswer.words().subList(1, 7)).allMatch(word -> word.type().equals("missing"));
    }

    @Test
    void theFirstWordTypoDoesNotShiftCorrectFollowingWords() {
        var grade = grader.grade("Everybody seemed to enjoy it.", "Everbody seemed to enjoy it");
        assertThat(grade.words().getFirst()).isEqualTo(new Edit("wrong", "everybody", "everbody"));
        assertThat(grade.correct()).isEqualTo(4);
        assertThat(grade.accuracy()).isEqualTo(80);
    }

    @Test
    void missingAndExtraLeadingWordsRetainTheirActualPositions() {
        var missing = grader.grade("We really enjoyed it", "really enjoyed it");
        assertThat(missing.words().getFirst()).isEqualTo(new Edit("missing", "we", null));
        assertThat(missing.correct()).isEqualTo(3);
        var extra = grader.grade("We enjoyed it", "Yesterday we enjoyed it");
        assertThat(extra.words().getFirst()).isEqualTo(new Edit("extra", null, "yesterday"));
        assertThat(extra.extra()).isEqualTo(1);
        assertThat(extra.correct()).isEqualTo(3);
    }

    @Test
    void repeatedWordsHaveStableHintIndicesAndNormalizationIsUnchanged() {
        var grade = grader.grade("We really really enjoyed it.", "we really enjoyed it");
        assertThat(grade.words().get(1)).isEqualTo(new Edit("correct", "really", "really"));
        assertThat(grade.words().get(2)).isEqualTo(new Edit("missing", "really", null));
        assertThat(grader.withoutHintCredit(grade, List.of(1)).correct()).isEqualTo(3);
        assertThat(grader.withoutHintCredit(grade, List.of(2)).correct()).isEqualTo(4);
        assertThat(grader.grade("I'll watch it.", "I’LL WATCH IT!").accuracy()).isEqualTo(100);
    }

    @Test
    void finalPrefixIsPartialOnlyWhileTheTokenIsStillBeingTyped() {
        assertThat(grader.feedback(grader.grade("We really enjoyed it.", "We re"), "We re"))
            .containsExactly(new Feedback(0, "correct", "we"), new Feedback(1, "partial", null),
                new Feedback(2, "empty", null), new Feedback(3, "empty", null));
        for (String actual : List.of("We re ", "We re.", "We re wrong")) {
            assertThat(grader.feedback(grader.grade("We really enjoyed it.", actual), actual).get(1))
                .isEqualTo(new Feedback(1, "incorrect", null));
        }
        assertThat(grader.feedback(grader.grade("Hello.", ""), ""))
            .containsExactly(new Feedback(0, "empty", null));
    }

    @Test
    void feedbackIndicesIgnoreExtraEditsAndRedactionRetainsActualWords() {
        var grade = grader.grade("We really enjoyed it.", "Yesterday we re");
        assertThat(grader.feedback(grade, "Yesterday we re"))
            .containsExactly(new Feedback(0, "correct", "we"), new Feedback(1, "partial", null),
                new Feedback(2, "empty", null), new Feedback(3, "empty", null));
        var safe = grader.redact(grade);
        assertThat(safe.words()).extracting(Edit::actual).containsExactly("yesterday", "we", "re", null, null);
        assertThat(safe.words()).extracting(Edit::expected).containsExactly(null, "we", null, null, null);
        assertThat(safe.extra()).isEqualTo(1);
        var missing = grader.grade("We really really enjoyed it.", "We really enjoyed it");
        assertThat(grader.feedback(missing, "We really enjoyed it")).containsExactly(
            new Feedback(0, "correct", "we"), new Feedback(1, "correct", "really"),
            new Feedback(2, "empty", null), new Feedback(3, "correct", "enjoyed"), new Feedback(4, "correct", "it"));
    }
}
