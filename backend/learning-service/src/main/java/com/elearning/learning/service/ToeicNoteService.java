package com.elearning.learning.service;

import com.elearning.learning.common.exception.AppException;
import com.elearning.learning.common.exception.ErrorCode;
import com.elearning.learning.dto.ToeicModels.*;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ToeicNoteService {

    public static final int FREE_NOTE_LIMIT = 100;
    private static final Set<String> COLORS = Set.of("yellow", "blue", "green", "pink");

    private final JdbcTemplate jdbc;
    private final ProMembershipService proMembership;
    private final Clock clock;

    public ToeicNoteService(JdbcTemplate jdbc, ProMembershipService proMembership, Clock clock) {
        this.jdbc = jdbc;
        this.proMembership = proMembership;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public NotesCollection list(long userId, Long examId) {
        boolean isPro = proMembership.isActive(userId);
        int total = totalCount(userId);
        List<NoteItem> items =
            examId == null
                ? jdbc.query(
                      "SELECT * FROM toeic_notes WHERE user_id = ? ORDER BY created_at DESC, id DESC",
                      (row, i) -> mapRow(row),
                      userId
                  )
                : jdbc.query(
                      "SELECT * FROM toeic_notes WHERE user_id = ? AND exam_id = ? ORDER BY created_at DESC, id DESC",
                      (row, i) -> mapRow(row),
                      userId,
                      examId
                  );
        return new NotesCollection(items, total, isPro ? null : FREE_NOTE_LIMIT, isPro);
    }

    public NoteMutationResult create(long userId, CreateNoteRequest request) {
        if (request == null || request.examId() == null) {
            throw new AppException(ErrorCode.BAD_REQUEST);
        }
        String selectedText = clean(request.selectedText());
        String noteContent = request.noteContent() == null ? "" : request.noteContent().trim();
        String color =
            request.color() == null || request.color().isBlank()
                ? "yellow"
                : request.color().trim().toLowerCase();
        if (
            selectedText.isEmpty() ||
            selectedText.length() > 500 ||
            noteContent.length() > 2000 ||
            !COLORS.contains(color)
        ) {
            throw new AppException(ErrorCode.BAD_REQUEST);
        }
        if (request.part() != null && !Set.of(5, 6, 7).contains(request.part())) {
            throw new AppException(ErrorCode.BAD_REQUEST);
        }
        if (
            request.questionNumber() != null &&
            (request.questionNumber() < 1 || request.questionNumber() > 10000)
        ) {
            throw new AppException(ErrorCode.BAD_REQUEST);
        }

        List<String> exams = jdbc.query(
            "SELECT title FROM toeic_exams WHERE id = ? AND deleted = FALSE",
            (row, i) -> row.getString("title"),
            request.examId()
        );
        if (exams.isEmpty()) {
            throw new AppException(ErrorCode.NOT_FOUND);
        }
        String examTitle = exams.getFirst();

        if (request.attemptId() != null) {
            Integer attemptMatch = jdbc.queryForObject(
                "SELECT COUNT(*) FROM toeic_attempts WHERE id = ? AND user_id = ? AND exam_id = ?",
                Integer.class,
                request.attemptId(),
                userId,
                request.examId()
            );
            if (attemptMatch == null || attemptMatch == 0) {
                throw new AppException(ErrorCode.BAD_REQUEST);
            }
        }

        boolean isPro = proMembership.isActive(userId);
        int currentCount = totalCount(userId);
        if (!isPro && currentCount >= FREE_NOTE_LIMIT) {
            throw new AppException(ErrorCode.NOTE_LIMIT_REACHED);
        }

        Instant now = clock.instant();
        var keys = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var statement = connection.prepareStatement(
                """
                INSERT INTO toeic_notes(user_id, exam_id, attempt_id, question_number, part,
                    exam_title, selected_text, note_content, color, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                Statement.RETURN_GENERATED_KEYS
            );
            statement.setLong(1, userId);
            statement.setLong(2, request.examId());
            statement.setObject(3, request.attemptId());
            statement.setObject(4, request.questionNumber());
            statement.setObject(5, request.part());
            statement.setString(6, examTitle);
            statement.setString(7, selectedText);
            statement.setString(8, noteContent);
            statement.setString(9, color);
            statement.setTimestamp(10, Timestamp.from(now));
            statement.setTimestamp(11, Timestamp.from(now));
            return statement;
        }, keys);

        long id = Objects.requireNonNull(keys.getKey()).longValue();
        int updatedCount = totalCount(userId);
        return new NoteMutationResult(
            findOwned(userId, id),
            updatedCount,
            isPro ? null : FREE_NOTE_LIMIT,
            isPro
        );
    }

    public NoteMutationResult update(long userId, long noteId, UpdateNoteRequest request) {
        if (request == null) throw new AppException(ErrorCode.BAD_REQUEST);
        NoteItem existing = findOwned(userId, noteId);
        String noteContent =
            request.noteContent() == null ? existing.noteContent() : request.noteContent().trim();
        String color =
            request.color() == null || request.color().isBlank()
                ? existing.color()
                : request.color().trim().toLowerCase();
        if (noteContent.length() > 2000 || !COLORS.contains(color)) {
            throw new AppException(ErrorCode.BAD_REQUEST);
        }
        jdbc.update(
            "UPDATE toeic_notes SET note_content = ?, color = ?, updated_at = ? WHERE id = ? AND user_id = ?",
            noteContent,
            color,
            Timestamp.from(clock.instant()),
            noteId,
            userId
        );
        boolean isPro = proMembership.isActive(userId);
        return new NoteMutationResult(
            findOwned(userId, noteId),
            totalCount(userId),
            isPro ? null : FREE_NOTE_LIMIT,
            isPro
        );
    }

    public NotesCollection delete(long userId, long noteId) {
        int removed = jdbc.update("DELETE FROM toeic_notes WHERE id = ? AND user_id = ?", noteId, userId);
        if (removed == 0) throw new AppException(ErrorCode.NOT_FOUND);
        return list(userId, null);
    }

    private int totalCount(long userId) {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM toeic_notes WHERE user_id = ?",
            Integer.class,
            userId
        );
        return count == null ? 0 : count;
    }

    private NoteItem findOwned(long userId, long noteId) {
        List<NoteItem> found = jdbc.query(
            "SELECT * FROM toeic_notes WHERE id = ? AND user_id = ?",
            (row, i) -> mapRow(row),
            noteId,
            userId
        );
        if (found.isEmpty()) throw new AppException(ErrorCode.NOT_FOUND);
        return found.getFirst();
    }

    private static String clean(String value) {
        if (value == null) return "";
        return value.replaceAll("\\s+", " ").trim();
    }

    private static NoteItem mapRow(ResultSet row) throws SQLException {
        return new NoteItem(
            row.getLong("id"),
            row.getLong("exam_id"),
            row.getObject("attempt_id", Long.class),
            row.getObject("question_number", Integer.class),
            row.getObject("part", Integer.class),
            row.getString("exam_title"),
            row.getString("selected_text"),
            row.getString("note_content"),
            row.getString("color"),
            row.getTimestamp("created_at").toInstant(),
            row.getTimestamp("updated_at").toInstant()
        );
    }
}
