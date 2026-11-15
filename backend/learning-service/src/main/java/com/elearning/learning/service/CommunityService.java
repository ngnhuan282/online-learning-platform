package com.elearning.learning.service;

import com.elearning.learning.common.exception.AppException;
import com.elearning.learning.common.exception.ErrorCode;
import com.elearning.learning.common.response.PageResponse;
import com.elearning.learning.dto.CommunityModels.*;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class CommunityService {

    private static final String POST_SELECT = """
    SELECT p.*, u.display_name, t.code AS topic_code,
        (SELECT COUNT(*) FROM community_comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL) AS comment_count
    FROM community_posts p JOIN learner_profiles u ON u.user_id = p.author_id
    JOIN community_topics t ON t.id = p.topic_id
    """;
    private final JdbcTemplate jdbc;
    private final EngagementService engagement;
    private final Clock clock;

    public CommunityService(JdbcTemplate jdbc, EngagementService engagement, Clock clock) {
        this.jdbc = jdbc;
        this.engagement = engagement;
        this.clock = clock;
    }

    public List<Topic> topics() {
        return jdbc.query("SELECT id, code FROM community_topics ORDER BY position, id", (row, i) ->
            new Topic(row.getLong(1), row.getString(2))
        );
    }

    public PageResponse<Post> posts(
        Long topicId,
        String keyword,
        String kind,
        boolean unanswered,
        int page,
        int size
    ) {
        validatePage(page, size);
        if (kind != null && !Set.of("DISCUSSION", "QUESTION").contains(kind)) throw new AppException(
            ErrorCode.BAD_REQUEST
        );
        if (keyword != null && keyword.length() > 160) throw new AppException(ErrorCode.BAD_REQUEST);
        String where = " WHERE p.deleted_at IS NULL ";
        List<Object> parameters = new ArrayList<>();
        if (topicId != null) {
            where += " AND p.topic_id = ? ";
            parameters.add(topicId);
        }
        if (keyword != null && !keyword.isBlank()) {
            where += " AND (LOCATE(LOWER(?), LOWER(p.title)) > 0 OR LOCATE(LOWER(?), LOWER(p.body)) > 0) ";
            parameters.add(keyword.strip());
            parameters.add(keyword.strip());
        }
        if (kind != null) {
            where += " AND p.kind = ? ";
            parameters.add(kind);
        }
        if (unanswered) where += " AND p.kind = 'QUESTION' AND p.accepted_comment_id IS NULL ";
        long total = jdbc.queryForObject(
            "SELECT COUNT(*) FROM community_posts p " + where,
            Long.class,
            parameters.toArray()
        );
        parameters.add(size);
        parameters.add((long) page * size);
        var content = jdbc.query(
            POST_SELECT + where + " ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?",
            this::postRow,
            parameters.toArray()
        );
        return page(content, page, size, total);
    }

    public Post get(long id) {
        return jdbc
            .query(POST_SELECT + " WHERE p.id = ? AND p.deleted_at IS NULL", this::postRow, id)
            .stream()
            .findFirst()
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
    }

    @Transactional
    public Post create(long userId, PostRequest request, CurrentProfileClient.Profile profile) {
        engagement.syncProfile(userId, profile);
        requireTopic(request.topicId());
        rateLimit("community_posts", userId, 30);
        long id = insert(
            """
            INSERT INTO community_posts (author_id, topic_id, kind, title, body, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            userId,
            request.topicId(),
            request.kind(),
            request.title().strip(),
            request.body().strip(),
            now(),
            now()
        );
        return get(id);
    }

    @Transactional
    public Post update(long userId, boolean admin, long id, PostRequest request) {
        Post post = lockPost(id);
        requireOwner(userId, admin, post.authorId());
        requireOpen(post, admin);
        requireTopic(request.topicId());
        if (!request.kind().equals(post.kind()) && post.acceptedCommentId() != null) throw new AppException(
            ErrorCode.CONFLICT
        );
        jdbc.update(
            "UPDATE community_posts SET topic_id = ?, kind = ?, title = ?, body = ?, updated_at = ? WHERE id = ?",
            request.topicId(),
            request.kind(),
            request.title().strip(),
            request.body().strip(),
            now(),
            id
        );
        return get(id);
    }

    @Transactional
    public void delete(long userId, boolean admin, long id) {
        Post post = lockPost(id);
        requireOwner(userId, admin, post.authorId());
        requireOpen(post, admin);
        jdbc.update(
            "UPDATE community_posts SET deleted_at = ?, updated_at = ? WHERE id = ?",
            now(),
            now(),
            id
        );
    }

    @Transactional
    public Post setLocked(long id, boolean locked) {
        lockPost(id);
        jdbc.update("UPDATE community_posts SET locked = ?, updated_at = ? WHERE id = ?", locked, now(), id);
        return get(id);
    }

    public PageResponse<Comment> comments(long postId, int page, int size) {
        validatePage(page, size);
        get(postId);
        long total = jdbc.queryForObject(
            "SELECT COUNT(*) FROM community_comments WHERE post_id = ? AND deleted_at IS NULL",
            Long.class,
            postId
        );
        var content = jdbc.query(
            """
            SELECT c.*, u.display_name FROM community_comments c
            JOIN learner_profiles u ON u.user_id = c.author_id
            WHERE c.post_id = ? AND c.deleted_at IS NULL ORDER BY c.created_at, c.id LIMIT ? OFFSET ?
            """,
            this::commentRow,
            postId,
            size,
            (long) page * size
        );
        return page(content, page, size, total);
    }

    @Transactional
    public Comment addComment(
        long userId,
        boolean admin,
        long postId,
        CommentRequest request,
        CurrentProfileClient.Profile profile
    ) {
        Post post = lockPost(postId);
        requireOpen(post, admin);
        engagement.syncProfile(userId, profile);
        rateLimit("community_comments", userId, 5);
        long id = insert(
            """
            INSERT INTO community_comments (post_id, author_id, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
            """,
            postId,
            userId,
            request.body().strip(),
            now(),
            now()
        );
        return comment(postId, id);
    }

    @Transactional
    public Comment updateComment(long userId, boolean admin, long postId, long id, CommentRequest request) {
        Post post = lockPost(postId);
        requireOpen(post, admin);
        Comment comment = comment(postId, id);
        requireOwner(userId, admin, comment.authorId());
        jdbc.update(
            "UPDATE community_comments SET body = ?, updated_at = ? WHERE id = ?",
            request.body().strip(),
            now(),
            id
        );
        return comment(postId, id);
    }

    @Transactional
    public void deleteComment(long userId, boolean admin, long postId, long id) {
        Post post = lockPost(postId);
        requireOpen(post, admin);
        Comment comment = comment(postId, id);
        requireOwner(userId, admin, comment.authorId());
        jdbc.update(
            "UPDATE community_comments SET deleted_at = ?, updated_at = ? WHERE id = ?",
            now(),
            now(),
            id
        );
        if (Long.valueOf(id).equals(post.acceptedCommentId())) {
            jdbc.update(
                "UPDATE community_posts SET accepted_comment_id = NULL, updated_at = ? WHERE id = ?",
                now(),
                postId
            );
        }
    }

    @Transactional
    public Post acceptAnswer(long userId, boolean admin, long postId, Long commentId) {
        Post post = lockPost(postId);
        requireOwner(userId, admin, post.authorId());
        requireOpen(post, admin);
        if (!"QUESTION".equals(post.kind())) throw new AppException(ErrorCode.CONFLICT);
        if (commentId != null) comment(postId, commentId);
        jdbc.update(
            "UPDATE community_posts SET accepted_comment_id = ?, updated_at = ? WHERE id = ?",
            commentId,
            now(),
            postId
        );
        return get(postId);
    }

    private Comment comment(long postId, long id) {
        return jdbc
            .query(
                """
                SELECT c.*, u.display_name FROM community_comments c JOIN learner_profiles u ON u.user_id = c.author_id
                WHERE c.id = ? AND c.post_id = ? AND c.deleted_at IS NULL
                """,
                this::commentRow,
                id,
                postId
            )
            .stream()
            .findFirst()
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
    }

    private Post lockPost(long id) {
        var found = jdbc.queryForList(
            "SELECT id FROM community_posts WHERE id = ? AND deleted_at IS NULL FOR UPDATE",
            Long.class,
            id
        );
        if (found.isEmpty()) throw new AppException(ErrorCode.NOT_FOUND);
        return get(id);
    }

    private void requireOwner(long userId, boolean admin, long ownerId) {
        if (userId != ownerId && !admin) throw new AppException(ErrorCode.FORBIDDEN);
    }

    private void requireOpen(Post post, boolean admin) {
        if (post.locked() && !admin) throw new AppException(ErrorCode.CONFLICT);
    }

    private void requireTopic(long id) {
        if (jdbc.queryForObject("SELECT COUNT(*) FROM community_topics WHERE id = ?", Long.class, id) == 0) {
            throw new AppException(ErrorCode.NOT_FOUND);
        }
    }

    private void rateLimit(String table, long userId, int seconds) {
        // Table is an internal constant; user input is always bound as a parameter.
        long count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM " + table + " WHERE author_id = ? AND created_at > ?",
            Long.class,
            userId,
            Timestamp.from(clock.instant().minusSeconds(seconds))
        );
        if (count > 0) throw new AppException(ErrorCode.RATE_LIMITED);
    }

    private long insert(String sql, Object... parameters) {
        var key = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            var statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS);
            for (int i = 0; i < parameters.length; i++) statement.setObject(i + 1, parameters[i]);
            return statement;
        }, key);
        if (key.getKey() == null) throw new AppException(ErrorCode.INTERNAL_ERROR);
        return key.getKey().longValue();
    }

    private Timestamp now() {
        return Timestamp.from(clock.instant());
    }

    private void validatePage(int page, int size) {
        if (page < 0 || page > 100000 || size < 1 || size > 50) throw new AppException(ErrorCode.BAD_REQUEST);
    }

    private <T> PageResponse<T> page(List<T> content, int page, int size, long total) {
        int totalPages = (int) ((total + size - 1) / size);
        return new PageResponse<>(content, page, size, total, totalPages, page + 1 >= totalPages);
    }

    private Post postRow(ResultSet row, int index) throws SQLException {
        return new Post(
            row.getLong("id"),
            row.getLong("author_id"),
            row.getString("display_name"),
            row.getLong("topic_id"),
            row.getString("topic_code"),
            row.getString("kind"),
            row.getString("title"),
            row.getString("body"),
            row.getBoolean("locked"),
            row.getObject("accepted_comment_id", Long.class),
            row.getLong("comment_count"),
            row.getTimestamp("created_at").toInstant(),
            row.getTimestamp("updated_at").toInstant()
        );
    }

    private Comment commentRow(ResultSet row, int index) throws SQLException {
        return new Comment(
            row.getLong("id"),
            row.getLong("post_id"),
            row.getLong("author_id"),
            row.getString("display_name"),
            row.getString("body"),
            row.getTimestamp("created_at").toInstant(),
            row.getTimestamp("updated_at").toInstant()
        );
    }
}
