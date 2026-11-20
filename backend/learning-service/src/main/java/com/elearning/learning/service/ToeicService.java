package com.elearning.learning.service;

import com.elearning.learning.common.exception.AppException;
import com.elearning.learning.common.exception.ErrorCode;
import com.elearning.learning.dto.ToeicModels.*;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

@Service
@Transactional
public class ToeicService {

    private static final Set<String> OPTION_IDS = Set.of("A", "B", "C", "D");
    private static final Set<String> PART_TWO_OPTION_IDS = Set.of("A", "B", "C");
    private static final String SUMMARY_COLUMNS =
        "id, slug, title, description, duration_minutes, question_count, lesson_count, source_label, version, published, section";
    private final JdbcTemplate jdbc;
    private final JsonMapper mapper;
    private final Clock clock;

    public ToeicService(JdbcTemplate jdbc, JsonMapper mapper, Clock clock) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<Summary> catalog() {
        return jdbc.query(
            "SELECT " +
                SUMMARY_COLUMNS +
                " FROM toeic_exams WHERE deleted = FALSE AND published = TRUE ORDER BY id",
            (row, i) -> summary(row)
        );
    }

    @Transactional(readOnly = true)
    public List<Summary> listAdmin() {
        return jdbc.query(
            "SELECT " + SUMMARY_COLUMNS + " FROM toeic_exams WHERE deleted = FALSE ORDER BY id DESC",
            (row, i) -> summary(row)
        );
    }

    @Transactional(readOnly = true)
    public Detail detail(long examId) {
        Exam exam = exam(examId, true, false);
        Definition definition = decode(exam.json(), Definition.class);
        return new Detail(
            exam.id(),
            definition.slug(),
            definition.title(),
            definition.description(),
            definition.durationMinutes(),
            definition.sourceLabel(),
            definition.lessons(),
            questionViews(definition.questions(), false),
            exam.version(),
            companionExamId(definition)
        );
    }

    @Transactional(readOnly = true)
    public AdminDetail adminDetail(long examId) {
        return adminView(exam(examId, false, false));
    }

    public AdminDetail create(Definition input) {
        Definition definition = normalize(input);
        boolean published = Boolean.TRUE.equals(input.published());
        validate(definition, published);
        long id = insert(definition, published, null);
        return adminView(exam(id, false, false));
    }

    public AdminDetail update(long examId, Definition input) {
        Exam current = exam(examId, false, true);
        if (input == null || input.version() == null) throw badRequest();
        if (input.version() != current.version()) throw new AppException(ErrorCode.CONFLICT);
        Definition definition = normalize(input);
        // Publication is a separate explicit operation; ordinary edits cannot accidentally unpublish an exam.
        validate(definition, current.published());
        jdbc.update(
            """
            UPDATE toeic_exams SET slug = ?, title = ?, description = ?, duration_minutes = ?,
            source_label = ?, question_count = ?, lesson_count = ?, definition_json = ?, section = ?,
            version = version + 1, updated_at = ? WHERE id = ?
            """,
            definition.slug(),
            definition.title(),
            definition.description(),
            definition.durationMinutes(),
            definition.sourceLabel(),
            definition.questions().size(),
            definition.lessons().size(),
            encode(definition),
            section(definition),
            timestamp(clock.instant()),
            examId
        );
        return adminView(exam(examId, false, false));
    }

    public AdminDetail publish(long examId, PublishRequest request) {
        if (request == null || request.published() == null) throw badRequest();
        Exam current = exam(examId, false, true);
        Definition definition = decode(current.json(), Definition.class);
        validate(definition, request.published());
        if (current.published() != request.published()) {
            jdbc.update(
                "UPDATE toeic_exams SET published = ?, version = version + 1, updated_at = ? WHERE id = ?",
                request.published(),
                timestamp(clock.instant()),
                examId
            );
        }
        return adminView(exam(examId, false, false));
    }

    public void delete(long examId) {
        exam(examId, false, true);
        // Keep the row and immutable attempt snapshots for learners' existing results.
        jdbc.update(
            "UPDATE toeic_exams SET deleted = TRUE, published = FALSE, version = version + 1, updated_at = ? WHERE id = ?",
            timestamp(clock.instant()),
            examId
        );
    }

    public void seed(Definition input) {
        Definition definition = normalize(input);
        String seedKey =
            input.seedKey() == null || input.seedKey().isBlank() ? definition.slug() : input.seedKey();
        if (
            jdbc.queryForObject(
                "SELECT COUNT(*) FROM toeic_exams WHERE seed_key = ? OR slug = ?",
                Integer.class,
                seedKey,
                definition.slug()
            ) > 0
        ) return;
        if (seedKey.length() > 128) throw badRequest();
        boolean published = Boolean.TRUE.equals(input.published());
        validate(definition, published);
        insert(definition, published, seedKey);
    }

    public Progress progress(long userId, long examId) {
        Exam current = exam(examId, true, false);
        Definition definition = decode(current.json(), Definition.class);
        Set<String> currentLessons = new HashSet<>(definition.lessons().stream().map(Lesson::id).toList());
        List<String> completed = jdbc
            .queryForList(
                "SELECT lesson_id FROM toeic_lesson_progress WHERE user_id = ? AND exam_id = ? AND exam_version = ? ORDER BY id",
                String.class,
                userId,
                examId,
                current.version()
            )
            .stream()
            .filter(currentLessons::contains)
            .toList();
        List<Attempt> attempts = jdbc.query(
            "SELECT * FROM toeic_attempts WHERE user_id = ? AND exam_id = ? ORDER BY id DESC",
            (row, i) -> attemptRow(row),
            userId,
            examId
        );
        List<AttemptSummary> summaries = new ArrayList<>();
        Long active = null;
        for (Attempt item : attempts) {
            Attempt value = item;
            if (expired(item)) value = finish(attempt(item.id(), userId), null);
            if (active == null && value.status().equals("IN_PROGRESS")) active = value.id();
            summaries.add(
                new AttemptSummary(
                    value.id(),
                    value.mode(),
                    value.part(),
                    attemptDuration(value),
                    value.status(),
                    value.score(),
                    value.correctCount(),
                    value.totalQuestions(),
                    value.startedAt(),
                    value.submittedAt(),
                    value.deadlineAt()
                )
            );
        }
        return new Progress(completed, summaries, active);
    }

    public Progress completeLesson(long userId, long examId, String lessonId) {
        Exam current = exam(examId, true, true);
        Definition definition = decode(current.json(), Definition.class);
        if (
            definition
                .lessons()
                .stream()
                .noneMatch(item -> item.id().equals(lessonId))
        ) {
            throw new AppException(ErrorCode.NOT_FOUND);
        }
        // Serializing on the exam root makes retry/concurrent completion idempotent on both MySQL and H2.
        Integer existing = jdbc.queryForObject(
            "SELECT COUNT(*) FROM toeic_lesson_progress WHERE user_id = ? AND exam_id = ? AND lesson_id = ? AND exam_version = ?",
            Integer.class,
            userId,
            examId,
            lessonId,
            current.version()
        );
        if (existing == 0) jdbc.update(
            "INSERT INTO toeic_lesson_progress(user_id, exam_id, lesson_id, exam_version, completed_at) VALUES (?, ?, ?, ?, ?)",
            userId,
            examId,
            lessonId,
            current.version(),
            timestamp(clock.instant())
        );
        return progress(userId, examId);
    }

    public AttemptView start(long userId, long examId, StartRequest request) {
        if (
            request == null ||
            !Set.of("PRACTICE", "EXAM").contains(request.mode() == null ? "" : request.mode())
        ) {
            throw badRequest();
        }
        if (
            request.part() != null &&
            (request.part() < 1 || request.part() > 7 || request.mode().equals("EXAM"))
        ) {
            throw badRequest();
        }
        if (
            request.durationMinutes() != null &&
            (request.durationMinutes() < 1 || request.durationMinutes() > 180)
        ) {
            throw badRequest();
        }
        Exam current = exam(examId, true, true);
        Definition definition = decode(current.json(), Definition.class);
        validate(definition, true);
        if (
            request.mode().equals("EXAM") &&
            request.durationMinutes() != null &&
            !request.durationMinutes().equals(definition.durationMinutes())
        ) {
            throw badRequest();
        }
        Integer chosenDuration = request.mode().equals("EXAM")
            ? definition.durationMinutes()
            : request.durationMinutes();
        List<Attempt> active = jdbc.query(
            "SELECT * FROM toeic_attempts WHERE user_id = ? AND exam_id = ? AND status = 'IN_PROGRESS' ORDER BY id DESC",
            (row, i) -> attemptRow(row),
            userId,
            examId
        );
        for (Attempt item : active) {
            if (
                !item.mode().equals(request.mode()) ||
                !Objects.equals(item.part(), request.part()) ||
                !Objects.equals(attemptDuration(item), chosenDuration)
            ) continue;
            Attempt owned = attempt(item.id(), userId);
            if (expired(owned)) finish(owned, null);
            else return view(owned);
        }
        List<Question> selected = definition
            .questions()
            .stream()
            .filter(item -> request.part() == null || request.part().equals(item.part()))
            .toList();
        if (selected.isEmpty()) throw badRequest();
        Definition snapshot = new Definition(
            definition.slug(),
            definition.title(),
            definition.description(),
            chosenDuration != null ? chosenDuration : definition.durationMinutes(),
            definition.sourceLabel(),
            definition.lessons(),
            selected,
            true,
            current.version(),
            null
        );
        Instant started = clock.instant().truncatedTo(ChronoUnit.SECONDS);
        Instant deadline = chosenDuration != null ? started.plusSeconds(chosenDuration * 60L) : null;
        var keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var statement = connection.prepareStatement(
                """
                INSERT INTO toeic_attempts(exam_id, user_id, mode, part, status, snapshot_json,
                    answers_json, total_questions, started_at, deadline_at)
                VALUES (?, ?, ?, ?, 'IN_PROGRESS', ?, '{}', ?, ?, ?)
                """,
                java.sql.Statement.RETURN_GENERATED_KEYS
            );
            statement.setLong(1, examId);
            statement.setLong(2, userId);
            statement.setString(3, request.mode());
            statement.setObject(4, request.part());
            statement.setString(5, encode(snapshot));
            statement.setInt(6, selected.size());
            statement.setTimestamp(7, timestamp(started));
            statement.setTimestamp(8, timestamp(deadline));
            return statement;
        }, keys);
        return view(attempt(Objects.requireNonNull(keys.getKey()).longValue(), userId));
    }

    public AttemptView getAttempt(long userId, long attemptId) {
        Attempt current = attempt(attemptId, userId);
        return view(expired(current) ? finish(current, null) : current);
    }

    public AttemptView saveAnswers(long userId, long attemptId, AnswersRequest request) {
        Attempt current = attempt(attemptId, userId);
        if (current.status().equals("GRADED")) return view(current);
        if (expired(current)) return view(finish(current, null));
        Map<String, String> answers = validAnswers(current, request);
        jdbc.update("UPDATE toeic_attempts SET answers_json = ? WHERE id = ?", encode(answers), attemptId);
        return view(attempt(attemptId, userId));
    }

    public AttemptView submit(long userId, long attemptId, AnswersRequest request) {
        Attempt current = attempt(attemptId, userId);
        if (current.status().equals("GRADED")) return view(current);
        // Late request bodies never replace the last server-saved answers at the exam deadline.
        return view(finish(current, expired(current) ? null : validAnswers(current, request)));
    }

    private Attempt finish(Attempt current, Map<String, String> supplied) {
        if (current.status().equals("GRADED")) return current;
        Map<String, String> answers = supplied == null ? answers(current.answers()) : supplied;
        Definition definition = decode(current.snapshot(), Definition.class);
        int correct = (int) definition
            .questions()
            .stream()
            .filter(item -> item.correctOptionId().equals(answers.get(item.id())))
            .count();
        int score = (int) Math.round((correct * 100.0) / current.totalQuestions());
        Instant finished = expired(current) ? current.deadlineAt() : clock.instant();
        jdbc.update(
            """
            UPDATE toeic_attempts SET status = 'GRADED', answers_json = ?, score = ?,
            correct_count = ?, submitted_at = ? WHERE id = ?
            """,
            encode(answers),
            score,
            correct,
            timestamp(finished),
            current.id()
        );
        return attempt(current.id(), current.userId());
    }

    private Map<String, String> validAnswers(Attempt attempt, AnswersRequest request) {
        if (request == null || request.answers() == null) throw badRequest();
        Definition definition = decode(attempt.snapshot(), Definition.class);
        Map<String, Integer> partsByQuestion = new LinkedHashMap<>();
        definition.questions().forEach(question -> partsByQuestion.put(question.id(), question.part()));
        Map<String, String> validated = new LinkedHashMap<>();
        request.answers().forEach((key, value) -> {
            Integer part = partsByQuestion.get(key);
            if (part == null || value == null || !allowedOptions(part).contains(value)) throw badRequest();
            validated.put(key, value);
        });
        return validated;
    }

    private AttemptView view(Attempt attempt) {
        Definition definition = decode(attempt.snapshot(), Definition.class);
        boolean revealAnswers = attempt.status().equals("GRADED") || attempt.mode().equals("PRACTICE");
        return new AttemptView(
            attempt.id(),
            attempt.examId(),
            definition.title(),
            attempt.mode(),
            attempt.part(),
            attemptDuration(attempt),
            attempt.status(),
            attempt.startedAt(),
            attempt.deadlineAt(),
            attempt.submittedAt(),
            clock.instant(),
            attempt.score(),
            attempt.correctCount(),
            attempt.totalQuestions(),
            answers(attempt.answers()),
            questionViews(definition.questions(), revealAnswers)
        );
    }

    private List<QuestionView> questionViews(List<Question> questions, boolean review) {
        return questions
            .stream()
            .map(item ->
                new QuestionView(
                    item.id(),
                    item.number(),
                    item.part(),
                    item.passage(),
                    item.prompt(),
                    item.imageUrl(),
                    item.passageImageUrls(),
                    item.part() <= 2
                        ? item
                              .options()
                              .stream()
                              .map(option -> new Option(option.id(), ""))
                              .toList()
                        : item.options(),
                    review ? item.correctOptionId() : null,
                    review ? item.explanation() : null,
                    item.source(),
                    item.listening() == null
                        ? null
                        : new Listening(
                              item.listening().audioUrl(),
                              review ? item.listening().transcript() : null
                          )
                )
            )
            .toList();
    }

    private AdminDetail adminView(Exam exam) {
        Definition definition = decode(exam.json(), Definition.class);
        return new AdminDetail(
            exam.id(),
            definition.slug(),
            definition.title(),
            definition.description(),
            definition.durationMinutes(),
            definition.sourceLabel(),
            definition.lessons(),
            definition.questions(),
            exam.published(),
            exam.version()
        );
    }

    private long insert(Definition definition, boolean published, String seedKey) {
        var keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var statement = connection.prepareStatement(
                """
                INSERT INTO toeic_exams(slug, seed_key, title, description, duration_minutes,
                    source_label, question_count, lesson_count, definition_json, section, published, deleted,
                    version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, 1, ?, ?)
                """,
                java.sql.Statement.RETURN_GENERATED_KEYS
            );
            statement.setString(1, definition.slug());
            statement.setString(2, seedKey);
            statement.setString(3, definition.title());
            statement.setString(4, definition.description());
            statement.setInt(5, definition.durationMinutes());
            statement.setString(6, definition.sourceLabel());
            statement.setInt(7, definition.questions().size());
            statement.setInt(8, definition.lessons().size());
            statement.setString(9, encode(definition));
            statement.setString(10, section(definition));
            statement.setBoolean(11, published);
            statement.setTimestamp(12, timestamp(clock.instant()));
            statement.setTimestamp(13, timestamp(clock.instant()));
            return statement;
        }, keys);
        return Objects.requireNonNull(keys.getKey()).longValue();
    }

    private Definition normalize(Definition input) {
        if (input == null) throw badRequest();
        return new Definition(
            trim(input.slug()),
            trim(input.title()),
            input.description(),
            input.durationMinutes() == null ? 75 : input.durationMinutes(),
            input.sourceLabel(),
            input.lessons() == null ? List.of() : input.lessons(),
            input.questions() == null ? List.of() : input.questions(),
            null,
            null,
            null
        );
    }

    private void validate(Definition definition, boolean scorable) {
        if (
            definition.slug() == null ||
            !definition.slug().matches("[a-z0-9][a-z0-9-]{0,127}") ||
            blank(definition.title()) ||
            definition.title().length() > 255 ||
            length(definition.description()) > 2000 ||
            length(definition.sourceLabel()) > 1000 ||
            definition.durationMinutes() < 1 ||
            definition.durationMinutes() > 180 ||
            definition.lessons().size() > 100 ||
            definition.questions().size() > 1000 ||
            (scorable && definition.questions().isEmpty())
        ) throw badRequest();
        Set<String> lessonIds = new HashSet<>();
        for (Lesson lesson : definition.lessons()) {
            if (
                lesson == null ||
                !validId(lesson.id()) ||
                !lessonIds.add(lesson.id()) ||
                length(lesson.title()) > 255 ||
                length(lesson.content()) > 100000 ||
                (scorable && (blank(lesson.title()) || blank(lesson.content())))
            ) throw badRequest();
        }
        Set<String> questionIds = new HashSet<>();
        Set<Integer> numbers = new HashSet<>();
        Boolean listeningSection = null;
        Map<String, String> transcriptsByClip = new LinkedHashMap<>();
        for (Question question : definition.questions()) {
            if (
                question == null ||
                !validId(question.id()) ||
                !questionIds.add(question.id()) ||
                question.number() == null ||
                question.number() < 1 ||
                question.number() > 10000 ||
                !numbers.add(question.number()) ||
                question.part() == null ||
                question.part() < 1 ||
                question.part() > 7 ||
                length(question.prompt()) > 20000 ||
                length(question.passage()) > 100000 ||
                length(question.explanation()) > 50000 ||
                length(question.source()) > 2000 ||
                !validImage(question.imageUrl()) ||
                question.options() == null ||
                question.options().size() > 4
            ) throw badRequest();
            boolean listening = question.part() <= 4;
            if (listeningSection != null && listeningSection != listening) throw badRequest();
            listeningSection = listening;
            validateListening(question, scorable, transcriptsByClip);
            Set<String> allowedOptions = allowedOptions(question.part());
            boolean audioOnly = question.part() <= 2;
            boolean optionsInImage = listening && blank(question.prompt()) && !blank(question.imageUrl());
            if (
                scorable &&
                (question.options().size() != allowedOptions.size() ||
                    (!audioOnly && blank(question.prompt()) && blank(question.imageUrl())) ||
                    (!listening && blank(question.explanation())))
            ) throw badRequest();
            if (
                question.passageImageUrls() != null &&
                (question.passageImageUrls().size() > 8 ||
                    question
                        .passageImageUrls()
                        .stream()
                        .anyMatch(url -> blank(url) || !validImage(url)))
            ) throw badRequest();
            Set<String> optionIds = new HashSet<>();
            for (Option option : question.options()) {
                if (
                    option == null ||
                    !allowedOptions.contains(option.id() == null ? "" : option.id()) ||
                    !optionIds.add(option.id()) ||
                    length(option.text()) > 4000 ||
                    (scorable && !audioOnly && !optionsInImage && blank(option.text()))
                ) throw badRequest();
            }
            if (
                question.correctOptionId() != null && !optionIds.contains(question.correctOptionId())
            ) throw badRequest();
            if (scorable && question.correctOptionId() == null) throw badRequest();
        }
    }

    private Set<String> allowedOptions(int part) {
        return part == 2 ? PART_TWO_OPTION_IDS : OPTION_IDS;
    }

    private void validateListening(
        Question question,
        boolean scorable,
        Map<String, String> transcriptsByClip
    ) {
        Listening listening = question.listening();
        if (question.part() > 4) {
            if (listening != null) throw badRequest();
            return;
        }
        if (scorable && (listening == null || blank(listening.audioUrl()) || blank(listening.transcript()))) {
            throw badRequest();
        }
        if (scorable && question.part() == 1 && blank(question.imageUrl())) throw badRequest();
        if (listening == null) return;
        if (
            length(listening.audioUrl()) > 2048 ||
            length(listening.transcript()) > 20000 ||
            (!blank(listening.audioUrl()) &&
                !listening.audioUrl().matches("/toeic-assets/[a-zA-Z0-9_/-]+\\.mp3"))
        ) throw badRequest();
        if (scorable) {
            String previous = transcriptsByClip.putIfAbsent(listening.audioUrl(), listening.transcript());
            if (previous != null && !previous.equals(listening.transcript())) throw badRequest();
        }
    }

    private String section(Definition definition) {
        return !definition.questions().isEmpty() && definition.questions().getFirst().part() <= 4
            ? "LISTENING"
            : "READING";
    }

    private Long companionExamId(Definition definition) {
        String slug = definition.slug();
        if (!slug.matches("ets-2024-test-\\d{2}(-listening)?")) return null;
        String suffix = "-listening";
        String companion = slug.endsWith(suffix)
            ? slug.substring(0, slug.length() - suffix.length())
            : slug + suffix;
        String companionSection = section(definition).equals("LISTENING") ? "READING" : "LISTENING";
        return jdbc
            .query(
                "SELECT id FROM toeic_exams WHERE slug = ? AND section = ? AND published = TRUE AND deleted = FALSE",
                (row, index) -> row.getLong("id"),
                companion,
                companionSection
            )
            .stream()
            .findFirst()
            .orElse(null);
    }

    private boolean validImage(String value) {
        return (
            blank(value) ||
            (!value.contains("..") && value.matches("/toeic-assets/[a-zA-Z0-9_./-]+\\.(png|webp|jpg|jpeg)"))
        );
    }

    private Exam exam(long id, boolean publishedOnly, boolean lock) {
        List<Exam> found = jdbc.query(
            "SELECT id, version, published, definition_json FROM toeic_exams WHERE id = ? AND deleted = FALSE" +
                (publishedOnly ? " AND published = TRUE" : "") +
                (lock ? " FOR UPDATE" : ""),
            (row, i) ->
                new Exam(
                    row.getLong("id"),
                    row.getLong("version"),
                    row.getBoolean("published"),
                    row.getString("definition_json")
                ),
            id
        );
        if (found.isEmpty()) throw new AppException(ErrorCode.NOT_FOUND);
        return found.getFirst();
    }

    private Attempt attempt(long id, long userId) {
        List<Attempt> found = jdbc.query(
            "SELECT * FROM toeic_attempts WHERE id = ? AND user_id = ? FOR UPDATE",
            (row, i) -> attemptRow(row),
            id,
            userId
        );
        if (found.isEmpty()) throw new AppException(ErrorCode.NOT_FOUND);
        return found.getFirst();
    }

    private Summary summary(ResultSet row) throws SQLException {
        return new Summary(
            row.getLong("id"),
            row.getString("slug"),
            row.getString("title"),
            row.getString("description"),
            row.getInt("duration_minutes"),
            row.getInt("question_count"),
            row.getInt("lesson_count"),
            row.getString("source_label"),
            row.getLong("version"),
            row.getBoolean("published"),
            row.getString("section")
        );
    }

    private Attempt attemptRow(ResultSet row) throws SQLException {
        return new Attempt(
            row.getLong("id"),
            row.getLong("exam_id"),
            row.getLong("user_id"),
            row.getString("mode"),
            row.getObject("part", Integer.class),
            row.getString("status"),
            row.getString("snapshot_json"),
            row.getString("answers_json"),
            row.getInt("total_questions"),
            row.getObject("score", Integer.class),
            row.getObject("correct_count", Integer.class),
            instant(row, "started_at"),
            instant(row, "deadline_at"),
            instant(row, "submitted_at")
        );
    }

    private Map<String, String> answers(String json) {
        try {
            return mapper.readValue(json, new TypeReference<LinkedHashMap<String, String>>() {});
        } catch (Exception error) {
            throw new IllegalStateException("Invalid stored TOEIC answers", error);
        }
    }

    private String encode(Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (Exception error) {
            throw new IllegalStateException("Cannot encode TOEIC content", error);
        }
    }

    private <T> T decode(String json, Class<T> type) {
        try {
            return mapper.readValue(json, type);
        } catch (Exception error) {
            throw new IllegalStateException("Invalid stored TOEIC content", error);
        }
    }

    private boolean expired(Attempt attempt) {
        return (
            attempt.status().equals("IN_PROGRESS") &&
            attempt.deadlineAt() != null &&
            !clock.instant().isBefore(attempt.deadlineAt())
        );
    }

    private static Integer attemptDuration(Attempt attempt) {
        if (attempt.deadlineAt() == null || attempt.startedAt() == null) return null;
        return (int) Math.max(
            1,
            java.time.Duration.between(attempt.startedAt(), attempt.deadlineAt()).toMinutes()
        );
    }

    private static Timestamp timestamp(Instant value) {
        return value == null ? null : Timestamp.from(value);
    }

    private static Instant instant(ResultSet row, String column) throws SQLException {
        Timestamp value = row.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }

    private static int length(String value) {
        return value == null ? 0 : value.length();
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static boolean validId(String value) {
        return value != null && value.matches("[A-Za-z0-9_-]{1,80}");
    }

    private static AppException badRequest() {
        return new AppException(ErrorCode.BAD_REQUEST);
    }

    private record Exam(long id, long version, boolean published, String json) {}

    private record Attempt(
        long id,
        long examId,
        long userId,
        String mode,
        Integer part,
        String status,
        String snapshot,
        String answers,
        int totalQuestions,
        Integer score,
        Integer correctCount,
        Instant startedAt,
        Instant deadlineAt,
        Instant submittedAt
    ) {}
}
