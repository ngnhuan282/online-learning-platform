package com.elearning.learning.service;

import com.elearning.learning.dto.DictationModels.*;
import java.text.Normalizer;
import java.util.*;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

@Component
public class DictationGrader {

    private static final Pattern WORD = Pattern.compile("[\\p{L}\\p{N}]+(?:'[\\p{L}\\p{N}]+)*");

    public List<String> tokens(String value) {
        var matcher = WORD.matcher(
            Normalizer.normalize(value, Normalizer.Form.NFKC)
                .replace('\u2019', '\'')
                .replace('\u2018', '\'')
                .toLowerCase(Locale.ROOT)
        );
        List<String> words = new ArrayList<>();
        while (matcher.find()) words.add(matcher.group());
        return words;
    }

    public Grade grade(String expected, String actual) {
        List<String> left = tokens(expected),
            right = tokens(actual);
        int n = left.size(),
            m = right.size();
        int[][] distance = new int[n + 1][m + 1];
        int[][] matches = new int[n + 1][m + 1];
        for (int i = 0; i <= n; i++) distance[i][m] = n - i;
        for (int j = 0; j <= m; j++) distance[n][j] = m - j;
        for (int i = n - 1; i >= 0; i--) for (int j = m - 1; j >= 0; j--) {
            distance[i][j] = Math.min(
                distance[i + 1][j + 1] + (left.get(i).equals(right.get(j)) ? 0 : 1),
                Math.min(distance[i + 1][j] + 1, distance[i][j + 1] + 1)
            );
            int best = -1;
            if (distance[i][j] == distance[i + 1][j + 1] + (left.get(i).equals(right.get(j)) ? 0 : 1)) {
                best = matches[i + 1][j + 1] + (left.get(i).equals(right.get(j)) ? 1 : 0);
            }
            if (distance[i][j] == distance[i + 1][j] + 1) best = Math.max(best, matches[i + 1][j]);
            if (distance[i][j] == distance[i][j + 1] + 1) best = Math.max(best, matches[i][j + 1]);
            matches[i][j] = best;
        }
        List<Edit> edits = new ArrayList<>();
        int i = 0,
            j = 0,
            correct = 0,
            extra = 0;
        // Prefer exact matches on tied edit distances, then resolve ties from the beginning.
        while (i < n || j < m) {
            if (
                i < n && j < m && left.get(i).equals(right.get(j)) && distance[i][j] == distance[i + 1][j + 1] &&
                matches[i][j] == matches[i + 1][j + 1] + 1
            ) {
                edits.add(new Edit("correct", left.get(i++), right.get(j++)));
                correct++;
            } else if (i < n && j < m && distance[i][j] == distance[i + 1][j + 1] + 1 &&
                matches[i][j] == matches[i + 1][j + 1]) {
                edits.add(new Edit("wrong", left.get(i++), right.get(j++)));
            } else if (i < n && distance[i][j] == distance[i + 1][j] + 1 && matches[i][j] == matches[i + 1][j]) {
                edits.add(new Edit("missing", left.get(i++), null));
            } else {
                edits.add(new Edit("extra", null, right.get(j++)));
                extra++;
            }
        }
        double accuracy = n == 0 ? 0 : Math.round((Math.max(0, correct - extra) * 1000.0) / n) / 10.0;
        return new Grade(correct, n, extra, accuracy, edits);
    }

    public Grade withoutHintCredit(Grade grade, List<Integer> hints) {
        int index = 0,
            correct = grade.correct();
        for (Edit word : grade.words()) {
            if (word.expected() == null) continue;
            if (word.type().equals("correct") && hints.contains(index)) correct--;
            index++;
        }
        double accuracy =
            grade.total() == 0
                ? 0
                : Math.round((Math.max(0, correct - grade.extra()) * 1000.0) / grade.total()) / 10.0;
        return new Grade(correct, grade.total(), grade.extra(), accuracy, grade.words());
    }

    public Grade redact(Grade grade) {
        return new Grade(
            grade.correct(), grade.total(), grade.extra(), grade.accuracy(),
            grade.words().stream().map(edit -> new Edit(
                edit.type(), "correct".equals(edit.type()) ? edit.expected() : null, edit.actual()
            )).toList()
        );
    }

    public List<Feedback> feedback(Grade grade, String actual) {
        List<Feedback> result = new ArrayList<>();
        int expectedIndex = 0, actualIndex = 0;
        int actualCount = tokens(actual).size();
        boolean unfinishedToken = !actual.isEmpty() &&
            Character.isLetterOrDigit(actual.codePointBefore(actual.length()));
        for (Edit edit : grade.words()) {
            if (edit.actual() != null) actualIndex++;
            if (edit.expected() == null) continue;
            String state = switch (edit.type()) {
                case "correct" -> "correct";
                case "missing" -> "empty";
                default -> unfinishedToken && actualIndex == actualCount && edit.actual() != null &&
                    edit.expected().startsWith(edit.actual()) ? "partial" : "incorrect";
            };
            result.add(new Feedback(expectedIndex++, state, "correct".equals(state) ? edit.expected() : null));
        }
        return result;
    }
}
