package com.elearning.learning.service;

import com.elearning.learning.common.exception.*;
import com.elearning.learning.dto.DictationModels.*;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

@Service
@Transactional
public class DictationService {

    private final JdbcTemplate jdbc;
    private final JsonMapper json;
    private final DictationGrader grader;
    private final DictationAudioService audio;
    private final Clock clock;

    public DictationService(
        JdbcTemplate jdbc,
        JsonMapper json,
        DictationGrader grader,
        DictationAudioService audio,
        Clock clock
    ) {
        this.jdbc = jdbc;
        this.json = json;
        this.grader = grader;
        this.audio = audio;
        this.clock = clock;
    }

    private record Exercise(String id, int version, Integer published, boolean archived) {}

    private record Run(
        String id,
        long user,
        String exercise,
        int version,
        int index,
        Instant started,
        Instant finished,
        String scoringMode
    ) {}

    private record Saved(
        int index,
        String text,
        boolean revealed,
        boolean skipped,
        Grade first,
        Grade latest,
        List<Integer> hints,
        List<Integer> earned
    ) {}

    @Transactional(readOnly = true)
    public Catalog catalog(
        long user,
        String keyword,
        String level,
        String topic,
        int page,
        int size,
        boolean admin
    ) {
        return catalog(user, keyword, level, topic, page, size, admin, "");
    }

    @Transactional(readOnly = true)
    public Catalog catalog(
        long user,
        String keyword,
        String level,
        String topic,
        int page,
        int size,
        boolean admin,
        String status
    ) {
        page = Math.max(0, Math.min(page, 100000));
        size = Math.max(1, Math.min(size, 50));
        String join =
            " FROM dictation_exercises e JOIN dictation_revisions r ON r.exercise_id=e.id AND r.version=" +
            (admin ? "e.current_version" : "e.published_version");
        String where =
            " WHERE " +
            (admin ? "1=1" : "e.archived=FALSE") +
            " AND LOWER(r.title) LIKE ? AND (?='' OR r.level=?) AND (?='' OR r.topic=?)";
        if (admin) {
            where += switch (Objects.requireNonNullElse(status, "").strip().toUpperCase(Locale.ROOT)) {
                case "" -> "";
                case "PUBLISHED" -> " AND e.archived=FALSE AND e.published_version IS NOT NULL";
                case "DRAFT" -> " AND e.archived=FALSE AND e.published_version IS NULL";
                case "ARCHIVED" -> " AND e.archived=TRUE";
                default -> throw new AppException(ErrorCode.BAD_REQUEST);
            };
        }
        String search =
            "%" +
            Objects.requireNonNullElse(keyword, "")
                .toLowerCase(Locale.ROOT)
                .replace("%", "")
                .replace("_", "") +
            "%";
        Object[] params = { search, level, level, topic, topic };
        long total = jdbc.queryForObject("SELECT COUNT(*)" + join + where, Long.class, params);
        var args = new ArrayList<>(Arrays.asList(params));
        args.add(size);
        args.add((long) page * size);
        List<Item> items = jdbc.query(
            "SELECT e.*, r.definition, r.duration_seconds" +
                join +
                where +
                " ORDER BY e.updated_at DESC, e.id LIMIT ? OFFSET ?",
            (rs, row) -> {
                var definition = json.readValue(rs.getString("definition"), Definition.class);
                String id = rs.getString("id");
                List<Run> runs = admin
                    ? List.of()
                    : jdbc.query(
                          "SELECT * FROM dictation_attempts WHERE user_id=? AND exercise_id=? ORDER BY started_at DESC, id DESC LIMIT 1",
                          this::mapRun,
                          user,
                          id
                      );
                Attempt progress = runs.isEmpty() ? null : view(runs.getFirst());
                Integer published = rs.getObject("published_version", Integer.class);
                return new Item(
                    id,
                    definition.title(),
                    definition.description(),
                    definition.topic(),
                    definition.level(),
                    rs.getDouble("duration_seconds"),
                    definition.sentences().size(),
                    rs.getBoolean("archived") ? "ARCHIVED" : published == null ? "DRAFT" : "PUBLISHED",
                    published == null || published != rs.getInt("current_version"),
                    rs.getInt("current_version"),
                    progress == null ? null : progress.id(),
                    progress == null ? 0 : progress.completed(),
                    progress == null ? definition.sentences().size() : progress.sentences().size(),
                    progress != null && progress.completedAt() != null,
                    progress == null ? null : progress.accuracy()
                );
            },
            args.toArray()
        );
        List<String> topics = jdbc.queryForList(
            "SELECT DISTINCT r.topic" + join + (admin ? "" : " WHERE e.archived=FALSE") + " ORDER BY r.topic",
            String.class
        );
        return new Catalog(items, total, page, size, topics);
    }

    public AdminDetail save(String id, SaveRequest request) {
        Definition definition = validate(request.definition(), false);
        if (id == null) {
            if (request.version() != 0) throw new AppException(ErrorCode.CONFLICT);
            id = UUID.randomUUID().toString();
            jdbc.update(
                "INSERT INTO dictation_exercises (id, current_version, archived, updated_at) VALUES (?, 0, FALSE, ?)",
                id,
                now()
            );
        }
        Exercise exercise = exercise(id, true);
        if (exercise.version() != request.version()) throw new AppException(ErrorCode.CONFLICT);
        int next = exercise.version() + 1;
        Audio info = audio.metadata(definition.audioKey());
        jdbc.update(
            "INSERT INTO dictation_revisions (exercise_id, version, title, topic, level, duration_seconds, definition) VALUES (?, ?, ?, ?, ?, ?, ?)",
            id,
            next,
            definition.title().strip(),
            definition.topic().strip(),
            definition.level(),
            info == null ? 0 : info.duration(),
            json.writeValueAsString(definition)
        );
        jdbc.update(
            "UPDATE dictation_exercises SET current_version=?, updated_at=? WHERE id=?",
            next,
            now(),
            id
        );
        return adminDetail(id);
    }

    public AdminDetail saveAndPublish(String id, SaveRequest request) {
        Definition definition = validate(request.definition(), true);
        AdminDetail saved = save(id, new SaveRequest(definition, request.version()));
        return publish(saved.id(), saved.version());
    }

    @Transactional(readOnly = true)
    public AdminDetail adminDetail(String id) {
        Exercise exercise = exercise(id, false);
        Definition definition = definition(id, exercise.version());
        return new AdminDetail(
            id,
            exercise.version(),
            exercise.archived(),
            exercise.published() != null,
            exercise.published() == null || exercise.published() != exercise.version(),
            definition,
            audio.metadata(definition.audioKey())
        );
    }

    public AdminDetail publish(String id, int version) {
        Exercise exercise = exercise(id, true);
        if (exercise.version() != version) throw new AppException(ErrorCode.CONFLICT);
        validate(definition(id, version), true);
        jdbc.update(
            "UPDATE dictation_exercises SET published_version=?, archived=FALSE, updated_at=? WHERE id=?",
            version,
            now(),
            id
        );
        return adminDetail(id);
    }

    public AdminDetail visibility(String id, boolean archived) {
        exercise(id, true);
        jdbc.update(
            "UPDATE dictation_exercises SET archived=?, updated_at=? WHERE id=?",
            archived,
            now(),
            id
        );
        return adminDetail(id);
    }

    public Attempt start(long user, String id, StartRequest request) {
        Exercise exercise = exercise(id, true);
        if (exercise.archived() || exercise.published() == null) throw new AppException(ErrorCode.NOT_FOUND);
        var same = jdbc.query(
            "SELECT * FROM dictation_attempts WHERE user_id=? AND request_id=?",
            this::mapRun,
            user,
            request.requestId()
        );
        if (!same.isEmpty()) {
            if (!same.getFirst().exercise().equals(id)) throw new AppException(ErrorCode.CONFLICT);
            return view(same.getFirst());
        }
        var prior = jdbc.query(
            "SELECT * FROM dictation_attempts WHERE user_id=? AND exercise_id=? ORDER BY started_at DESC, id DESC LIMIT 1",
            this::mapRun,
            user,
            id
        );
        if (!request.restart() && !prior.isEmpty()) return view(prior.getFirst());
        String attemptId = UUID.randomUUID().toString();
        Instant started = clock.instant().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        // Keep restart order deterministic even with a fixed clock or microsecond timestamp ties.
        if (!prior.isEmpty() && !started.isAfter(prior.getFirst().started())) {
            started = prior.getFirst().started().plusNanos(1000);
        }
        jdbc.update(
            "INSERT INTO dictation_attempts (id, user_id, exercise_id, version, current_index, request_id, started_at) VALUES (?, ?, ?, ?, 0, ?, ?)",
            attemptId,
            user,
            id,
            exercise.published(),
            request.requestId(),
            Timestamp.from(started)
        );
        return attempt(user, attemptId);
    }

    @Transactional(readOnly = true)
    public Attempt attempt(long user, String id) {
        Run run = run(user, id, false);
        requireReadable(run);
        return view(run);
    }

    @Transactional(readOnly = true)
    public History history(
        long user,
        String keyword,
        String level,
        String topic,
        String status,
        int page,
        int size
    ) {
        page = Math.max(0, Math.min(page, 100000));
        size = Math.max(1, Math.min(size, 50));
        String join =
            " FROM dictation_attempts a JOIN dictation_revisions r ON r.exercise_id=a.exercise_id AND r.version=a.version";
        String latest =
            " AND NOT EXISTS (SELECT 1 FROM dictation_attempts newer" +
            " WHERE newer.user_id=a.user_id AND newer.exercise_id=a.exercise_id" +
            " AND (newer.started_at>a.started_at OR (newer.started_at=a.started_at AND newer.id>a.id)))";
        String where =
            " WHERE a.user_id=?" +
            latest +
            " AND LOWER(r.title) LIKE ? AND (?='' OR r.level=?) AND (?='' OR r.topic=?)";
        String search =
            "%" +
            Objects.requireNonNullElse(keyword, "")
                .strip()
                .toLowerCase(Locale.ROOT)
                .replace("%", "")
                .replace("_", "") +
            "%";
        if ("IN_PROGRESS".equals(status)) where += " AND a.completed_at IS NULL";
        else if ("COMPLETED".equals(status)) where += " AND a.completed_at IS NOT NULL";
        else if (!"".equals(status)) throw new AppException(ErrorCode.BAD_REQUEST);
        Object[] params = { user, search, level, level, topic, topic };
        long total = jdbc.queryForObject("SELECT COUNT(*)" + join + where, Long.class, params);
        var args = new ArrayList<>(Arrays.asList(params));
        args.add(size);
        args.add((long) page * size);
        List<Attempt> items = jdbc
            .query(
                "SELECT a.*" + join + where + " ORDER BY a.started_at DESC, a.id DESC LIMIT ? OFFSET ?",
                this::mapRun,
                args.toArray()
            )
            .stream()
            .map(this::view)
            .toList();
        List<String> topics = jdbc.queryForList(
            "SELECT DISTINCT r.topic" + join + " WHERE a.user_id=?" + latest + " ORDER BY r.topic",
            String.class,
            user
        );
        return new History(items, total, page, size, topics);
    }

    public Attempt progress(long user, String id, AnswerRequest request) {
        Run run = activeRun(user, id);
        Sentence sentence = sentence(run, request.index());
        Saved prior = saved(id, request.index());
        if (run.finished() != null || isCompleted(prior, sentence.text())) {
            if (!prior.text().equals(request.text())) throw new AppException(ErrorCode.CONFLICT);
            if (run.finished() == null) {
                jdbc.update("UPDATE dictation_attempts SET current_index=? WHERE id=?", request.index(), id);
                return view(run(user, id, false));
            }
            return view(run);
        }
        Grade latest = grader.grade(sentence.text(), request.text());
        List<Integer> earned = earn(prior, latest, sentence.text());
        upsert(
            id,
            new Saved(
                request.index(),
                request.text(),
                prior.revealed(),
                prior.skipped(),
                prior.first(),
                latest,
                prior.hints(),
                earned
            )
        );
        jdbc.update("UPDATE dictation_attempts SET current_index=? WHERE id=?", request.index(), id);
        return view(run(user, id, false));
    }

    public Attempt check(long user, String id, AnswerRequest request) {
        return progress(user, id, request);
    }

    public Attempt hint(long user, String id, HintRequest request) {
        Run run = editable(user, id, request.index());
        String reference = definition(run.exercise(), run.version()).sentences().get(request.index()).text();
        List<String> words = grader.tokens(reference);
        if (request.wordIndex() < 0 || request.wordIndex() >= words.size()) throw new AppException(
            ErrorCode.BAD_REQUEST
        );
        Saved prior = saved(id, request.index());
        if (isCompleted(prior, reference)) return view(run);
        List<Integer> hints = new ArrayList<>(prior.hints());
        if (!hints.contains(request.wordIndex())) hints.add(request.wordIndex());
        boolean fullyHinted = hints.size() == words.size();
        upsert(
            id,
            new Saved(
                prior.index(),
                prior.text(),
                prior.revealed() || fullyHinted,
                prior.skipped(),
                prior.first(),
                prior.latest(),
                hints,
                earned(prior, reference)
            )
        );
        return view(run);
    }

    public Attempt revealOrSkip(long user, String id, int index, boolean reveal) {
        Run run = editable(user, id, index);
        Saved prior = saved(id, index);
        String reference = sentence(run, index).text();
        if (isCompleted(prior, reference)) return view(run);
        upsert(
            id,
            new Saved(
                index,
                prior.text(),
                prior.revealed() || reveal,
                prior.skipped() || !reveal,
                prior.first(),
                prior.latest(),
                prior.hints(),
                earned(prior, reference)
            )
        );
        jdbc.update("UPDATE dictation_attempts SET current_index=? WHERE id=?", index, id);
        return view(run(user, id, false));
    }

    public Attempt finish(long user, String id) {
        Run run = activeRun(user, id);
        Attempt attempt = view(run);
        if (attempt.completedAt() != null) return attempt;
        if (attempt.completed() != attempt.sentences().size()) throw new DictationValidationException(
            "Vui lòng hoàn thành các câu còn lại."
        );
        jdbc.update("UPDATE dictation_attempts SET completed_at=? WHERE id=?", now(), id);
        return view(run(user, id, false));
    }

    @Transactional(readOnly = true)
    public String audioKey(long user, String id) {
        Run run = run(user, id, false);
        requireReadable(run);
        return definition(run.exercise(), run.version()).audioKey();
    }

    private void requireReadable(Run run) {
        if (run.finished() == null && exercise(run.exercise(), false).archived()) throw new AppException(
            ErrorCode.DICTATION_ARCHIVED
        );
    }

    private Run activeRun(long user, String id) {
        Run run = run(user, id, false);
        // Serialize learner writes with visibility changes, using the same lock order as start().
        if (exercise(run.exercise(), true).archived()) throw new AppException(ErrorCode.DICTATION_ARCHIVED);
        return run(user, id, true);
    }

    private Run editable(long user, String id, int index) {
        Run run = activeRun(user, id);
        if (run.finished() != null) throw new AppException(ErrorCode.CONFLICT);
        sentence(run, index);
        return run;
    }

    private Sentence sentence(Run run, int index) {
        List<Sentence> sentences = definition(run.exercise(), run.version()).sentences();
        if (index < 0 || index >= sentences.size()) throw new AppException(ErrorCode.BAD_REQUEST);
        return sentences.get(index);
    }

    private boolean isCompleted(Saved value, String reference) {
        return (
            value.revealed() ||
            value.skipped() ||
            value.hints().size() == grader.tokens(reference).size() ||
            grader.grade(reference, value.text()).accuracy() == 100
        );
    }

    private List<Integer> earned(Saved value, String reference) {
        if (value.earned() != null) return value.earned();
        // Old unfinished responses adopt live scoring from their current unassisted matches.
        if (value.revealed() || value.skipped()) return List.of();
        return earn(value, grader.grade(reference, value.text()), reference);
    }

    private List<Integer> earn(Saved value, Grade grade, String reference) {
        Set<Integer> indices = new TreeSet<>(value.earned() == null ? List.of() : value.earned());
        if (value.earned() == null && !value.revealed() && !value.skipped()) {
            Grade previous = grader.grade(reference, value.text());
            if (previous.extra() == 0) indices.addAll(
                grader
                    .feedback(previous, value.text())
                    .stream()
                    .filter(word -> "correct".equals(word.state()) && !value.hints().contains(word.index()))
                    .map(Feedback::index)
                    .toList()
            );
        }
        // Insertions cannot bank credit from a submission padded with possible answers.
        if (grade.extra() > 0) return List.copyOf(indices);
        int index = 0;
        for (Edit edit : grade.words()) {
            if (edit.expected() == null) continue;
            if ("correct".equals(edit.type()) && !value.hints().contains(index)) indices.add(index);
            index++;
        }
        return List.copyOf(indices);
    }

    private Attempt view(Run run) {
        Definition definition = definition(run.exercise(), run.version());
        Map<Integer, Saved> saved = new HashMap<>();
        jdbc.query("SELECT * FROM dictation_responses WHERE attempt_id=?", this::mapSaved, run.id()).forEach(
            value -> saved.put(value.index(), value)
        );
        List<Response> responses = new ArrayList<>();
        List<Segment> segments = new ArrayList<>();
        int completed = 0,
            correct = 0,
            total = 0;
        for (int index = 0; index < definition.sentences().size(); index++) {
            Sentence sentence = definition.sentences().get(index);
            List<String> tokens = grader.tokens(sentence.text());
            int words = tokens.size();
            total += words;
            segments.add(
                new Segment(
                    index,
                    sentence.start(),
                    sentence.end(),
                    words,
                    tokens.stream().map(String::length).toList()
                )
            );
            Saved value = saved.getOrDefault(
                index,
                new Saved(index, "", false, false, null, null, List.of(), List.of())
            );
            boolean legacy = "LEGACY".equals(run.scoringMode());
            boolean fullyHinted = value.hints().size() == words;
            Grade first =
                value.first() == null && fullyHinted ? grader.grade(sentence.text(), "") : value.first();
            boolean done = legacy ? first != null : isCompleted(value, sentence.text());
            if (done) completed++;
            int sentenceEarned = legacy
                ? first == null
                    ? 0
                    : Math.max(0, first.correct() - first.extra())
                : earned(value, sentence.text()).size();
            correct += sentenceEarned;
            Grade aligned = grader.grade(sentence.text(), value.text());
            Grade latest = legacy
                ? value.latest()
                : value.latest() == null && value.text().isEmpty()
                  ? null
                  : aligned;
            responses.add(
                new Response(
                    index,
                    value.text(),
                    latest != null,
                    value.revealed() || fullyHinted,
                    value.skipped(),
                    legacy
                        ? first == null
                            ? null
                            : first.accuracy()
                        : Math.round((sentenceEarned * 1000.0) / words) / 10.0,
                    latest == null ? null : done ? latest : grader.redact(latest),
                    done ? sentence.text() : null,
                    value
                        .hints()
                        .stream()
                        .map(word -> new Hint(word, tokens.get(word)))
                        .toList(),
                    done,
                    grader.feedback(aligned, value.text())
                )
            );
        }
        return new Attempt(
            run.id(),
            run.exercise(),
            run.version(),
            definition.title(),
            definition.topic(),
            definition.level(),
            audio.metadata(definition.audioKey()).duration(),
            run.index(),
            segments,
            responses,
            completed,
            total == 0 ? 0 : Math.round((correct * 1000.0) / total) / 10.0,
            run.started(),
            run.finished(),
            run.scoringMode(),
            exercise(run.exercise(), false).archived()
        );
    }

    private Definition validate(Definition definition, boolean publish) {
        Audio info = audio.metadata(definition.audioKey());
        if (publish && info == null) throw new DictationValidationException(
            "Vui lòng thêm audio trước khi xuất bản."
        );
        double priorEnd = 0;
        List<Sentence> sentences = new ArrayList<>();
        for (int index = 0; index < definition.sentences().size(); index++) {
            Sentence sentence = definition.sentences().get(index);
            String prefix = "Câu " + (index + 1) + ": ";
            if (grader.grade(sentence.text(), "").total() == 0) throw new DictationValidationException(
                prefix + "transcript cần có từ."
            );
            Double start = sentence.start(),
                end = sentence.end();
            if (publish && (start == null || end == null)) throw new DictationValidationException(
                prefix + "chưa đủ mốc bắt đầu và kết thúc."
            );
            if (
                (start != null && (!Double.isFinite(start) || start < 0)) ||
                (end != null && (!Double.isFinite(end) || end <= 0)) ||
                (start != null && end != null && start >= end)
            ) throw new DictationValidationException(prefix + "mốc thời gian không hợp lệ.");
            if (info != null) {
                if (start != null && start >= info.duration()) throw new DictationValidationException(
                    prefix + "mốc thời gian vượt quá audio."
                );
                if (end != null) end = Math.min(end, info.duration());
            }
            if (publish && start < priorEnd) throw new DictationValidationException(
                prefix + "thời gian đang chồng lên câu trước."
            );
            if (end != null) priorEnd = end;
            sentences.add(new Sentence(sentence.text(), start, end));
        }
        return new Definition(
            definition.title(),
            definition.description(),
            definition.topic(),
            definition.level(),
            definition.audioKey(),
            List.copyOf(sentences)
        );
    }

    private Exercise exercise(String id, boolean lock) {
        return jdbc
            .query(
                "SELECT * FROM dictation_exercises WHERE id=?" + (lock ? " FOR UPDATE" : ""),
                (rs, row) ->
                    new Exercise(
                        rs.getString("id"),
                        rs.getInt("current_version"),
                        rs.getObject("published_version", Integer.class),
                        rs.getBoolean("archived")
                    ),
                id
            )
            .stream()
            .findFirst()
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
    }

    private Definition definition(String id, int version) {
        String value = jdbc.queryForObject(
            "SELECT definition FROM dictation_revisions WHERE exercise_id=? AND version=?",
            String.class,
            id,
            version
        );
        return json.readValue(value, Definition.class);
    }

    private Run run(long user, String id, boolean lock) {
        return jdbc
            .query(
                "SELECT * FROM dictation_attempts WHERE id=? AND user_id=?" + (lock ? " FOR UPDATE" : ""),
                this::mapRun,
                id,
                user
            )
            .stream()
            .findFirst()
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
    }

    private Run mapRun(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
        Timestamp finished = rs.getTimestamp("completed_at");
        return new Run(
            rs.getString("id"),
            rs.getLong("user_id"),
            rs.getString("exercise_id"),
            rs.getInt("version"),
            rs.getInt("current_index"),
            rs.getTimestamp("started_at").toInstant(),
            finished == null ? null : finished.toInstant(),
            rs.getString("scoring_mode")
        );
    }

    private Saved mapSaved(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
        String first = rs.getString("first_grade"),
            latest = rs.getString("latest_grade");
        return new Saved(
            rs.getInt("sentence_index"),
            rs.getString("answer_text"),
            rs.getBoolean("revealed"),
            rs.getBoolean("skipped"),
            first == null ? null : json.readValue(first, Grade.class),
            latest == null ? null : json.readValue(latest, Grade.class),
            rs.getString("hint_indices") == null
                ? List.of()
                : Arrays.asList(json.readValue(rs.getString("hint_indices"), Integer[].class)),
            rs.getString("earned_indices") == null
                ? null
                : Arrays.asList(json.readValue(rs.getString("earned_indices"), Integer[].class))
        );
    }

    private Saved saved(String id, int index) {
        return jdbc
            .query(
                "SELECT * FROM dictation_responses WHERE attempt_id=? AND sentence_index=?",
                this::mapSaved,
                id,
                index
            )
            .stream()
            .findFirst()
            .orElse(new Saved(index, "", false, false, null, null, List.of(), List.of()));
    }

    private void upsert(String id, Saved value) {
        jdbc.update(
            "DELETE FROM dictation_responses WHERE attempt_id=? AND sentence_index=?",
            id,
            value.index()
        );
        jdbc.update(
            "INSERT INTO dictation_responses (attempt_id, sentence_index, answer_text, revealed, skipped, first_grade, latest_grade, hint_indices, earned_indices) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            id,
            value.index(),
            value.text(),
            value.revealed(),
            value.skipped(),
            value.first() == null ? null : json.writeValueAsString(value.first()),
            value.latest() == null ? null : json.writeValueAsString(value.latest()),
            json.writeValueAsString(value.hints()),
            json.writeValueAsString(value.earned())
        );
    }

    private Timestamp now() {
        return Timestamp.from(clock.instant());
    }
}
