package com.elearning.learning.service;

import com.elearning.learning.common.exception.AppException;
import com.elearning.learning.common.exception.ErrorCode;
import com.elearning.learning.dto.*;
import com.elearning.learning.entity.*;
import com.elearning.learning.entity.enums.AttemptStatus;
import com.elearning.learning.entity.enums.EnrollmentStatus;
import com.elearning.learning.entity.enums.QuestionType;
import com.elearning.learning.repository.EnrollmentRepository;
import com.elearning.learning.repository.QuizAttemptRepository;
import com.elearning.learning.repository.QuizRepository;
import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class QuizService {

    private final QuizRepository quizzes;
    private final QuizAttemptRepository attempts;
    private final EnrollmentRepository enrollments;
    private final CourseCatalogClient courseCatalog;
    private final NotificationService notifications;

    public QuizService(
        QuizRepository quizzes,
        QuizAttemptRepository attempts,
        EnrollmentRepository enrollments,
        CourseCatalogClient courseCatalog,
        NotificationService notifications
    ) {
        this.quizzes = quizzes;
        this.attempts = attempts;
        this.enrollments = enrollments;
        this.courseCatalog = courseCatalog;
        this.notifications = notifications;
    }

    public List<QuizListItemResponse> listPublished(Long userId, Long courseId) {
        ensureEnrolled(userId, courseId);
        return quizzes.findByCourseIdAndPublishedTrueOrderByIdAsc(courseId)
            .stream().map(QuizListItemResponse::from).toList();
    }

    public QuizResponse getPublished(Long userId, Long quizId) {
        Quiz quiz = quizzes.findWithQuestionsByIdAndPublishedTrue(quizId)
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
        ensureEnrolled(userId, quiz.getCourseId());
        return QuizResponse.from(quiz);
    }

    public List<QuizListItemResponse> listAdmin() {
        return quizzes.findAllByOrderByIdDesc().stream().map(QuizListItemResponse::from).toList();
    }

    public AdminQuizResponse getAdmin(Long id) {
        return AdminQuizResponse.from(findAdminQuiz(id));
    }

    @Transactional
    public AdminQuizResponse create(QuizDefinitionRequest request) {
        validateDefinition(request);
        courseCatalog.requireExistingCourse(request.courseId());
        Quiz quiz = new Quiz();
        applyDefinition(quiz, request);
        return AdminQuizResponse.from(quizzes.saveAndFlush(quiz));
    }

    @Transactional
    public AdminQuizResponse update(Long id, QuizDefinitionRequest request) {
        Quiz quiz = findAdminQuiz(id);
        if (quiz.getPublished() || attempts.existsByQuizId(id)) {
            throw new AppException(ErrorCode.CONFLICT);
        }
        validateDefinition(request);
        courseCatalog.requireExistingCourse(request.courseId());
        quiz.getQuestions().clear();
        quizzes.flush();
        applyDefinition(quiz, request);
        return AdminQuizResponse.from(quizzes.saveAndFlush(quiz));
    }

    @Transactional
    public AdminQuizResponse publish(Long id) {
        Quiz quiz = findAdminQuiz(id);
        if (quiz.getQuestions().isEmpty()) throw new AppException(ErrorCode.CONFLICT);
        courseCatalog.requireExistingCourse(quiz.getCourseId());
        quiz.setPublished(true);
        return AdminQuizResponse.from(quizzes.save(quiz));
    }

    @Transactional
    public void deleteDraft(Long id) {
        Quiz quiz = findAdminQuiz(id);
        if (quiz.getPublished() || attempts.existsByQuizId(id)) {
            throw new AppException(ErrorCode.CONFLICT);
        }
        quizzes.delete(quiz);
    }

    @Transactional
    public QuizResultResponse start(Long userId, Long quizId) {
        Quiz quiz = quizzes.findById(quizId)
            .filter(item -> item.getPublished())
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
        ensureEnrolledForUpdate(userId, quiz.getCourseId());
        if (quiz.getQuestions().isEmpty()) throw new AppException(ErrorCode.CONFLICT);

        var current = attempts.findTopByUserIdAndQuizIdOrderByIdDesc(userId, quizId);
        if (current.isPresent() && current.get().getStatus() == AttemptStatus.IN_PROGRESS
            && !expired(current.get(), quiz, Instant.now())) {
            return QuizResultResponse.from(current.get());
        }

        QuizAttempt attempt = new QuizAttempt();
        attempt.setQuiz(quiz);
        attempt.setUserId(userId);
        attempt.setCourseId(quiz.getCourseId());
        return QuizResultResponse.from(attempts.save(attempt));
    }

    @Transactional
    public QuizResultResponse submit(Long userId, Long attemptId, QuizSubmissionRequest request) {
        QuizAttempt attempt = attempts.findByIdAndUserId(attemptId, userId)
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
        if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) throw new AppException(ErrorCode.CONFLICT);
        Quiz quiz = quizzes.findWithQuestionsById(attempt.getQuiz().getId())
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
        ensureEnrolled(userId, quiz.getCourseId());
        Instant now = Instant.now();
        if (expired(attempt, quiz, now)) throw new AppException(ErrorCode.CONFLICT);

        Map<Long, Set<Long>> selections = new HashMap<>();
        for (QuizSubmissionRequest.Answer answer : request.answers()) {
            Set<Long> ids = new HashSet<>(answer.optionIds());
            if (selections.putIfAbsent(answer.questionId(), ids) != null
                || ids.size() != answer.optionIds().size()) {
                throw new AppException(ErrorCode.BAD_REQUEST);
            }
        }

        long total = 0;
        long earned = 0;
        for (QuizQuestion question : quiz.getQuestions()) {
            total += question.getPoints();
            Set<Long> selected = selections.remove(question.getId());
            if (selected == null) selected = Set.of();
            if (question.getQuestionType() == QuestionType.SINGLE_CHOICE && selected.size() > 1) {
                throw new AppException(ErrorCode.BAD_REQUEST);
            }
            Set<Long> valid = new HashSet<>();
            Set<Long> correct = new HashSet<>();
            for (QuizOption option : question.getOptions()) {
                valid.add(option.getId());
                if (option.getCorrect()) correct.add(option.getId());
            }
            if (!valid.containsAll(selected)) throw new AppException(ErrorCode.BAD_REQUEST);
            boolean matched = !selected.isEmpty() && selected.equals(correct);
            if (matched) earned += question.getPoints();
            boolean awarded = false;
            for (QuizOption option : question.getOptions()) {
                if (!selected.contains(option.getId())) continue;
                QuizAnswer answer = new QuizAnswer();
                answer.setAttempt(attempt);
                answer.setQuestion(question);
                answer.setSelectedOption(option);
                answer.setCorrect(matched);
                answer.setPointsAwarded(matched && !awarded ? question.getPoints() : 0);
                attempt.getAnswers().add(answer);
                awarded = true;
            }
        }
        if (!selections.isEmpty()) throw new AppException(ErrorCode.BAD_REQUEST);
        int score = (int) Math.round(earned * 100.0 / total);
        attempt.setScore(score);
        attempt.setPassed(score >= quiz.getPassingScore());
        attempt.setStatus(AttemptStatus.GRADED);
        attempt.setSubmittedAt(now);
        var saved = attempts.save(attempt);
        notifications.quizResult(userId, saved.getId(), quiz.getTitle(), score, saved.getPassed());
        return QuizResultResponse.from(saved);
    }

    public QuizResultResponse latestResult(Long userId, Long quizId) {
        return attempts.findTopByUserIdAndQuizIdAndStatusOrderByIdDesc(
            userId, quizId, AttemptStatus.GRADED
        ).map(QuizResultResponse::from).orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
    }

    public QuizReviewResponse review(Long userId, Long attemptId) {
        QuizAttempt attempt = attempts.findOwned(attemptId, userId)
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
        if (attempt.getStatus() != AttemptStatus.GRADED) {
            throw new AppException(ErrorCode.CONFLICT);
        }
        Quiz quiz = quizzes.findWithQuestionsById(attempt.getQuiz().getId())
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
        return QuizReviewResponse.from(attempt, quiz);
    }

    private Quiz findAdminQuiz(Long id) {
        return quizzes.findWithQuestionsById(id)
            .orElseThrow(() -> new AppException(ErrorCode.NOT_FOUND));
    }

    private void ensureEnrolled(Long userId, Long courseId) {
        if (enrollments.findByUserIdAndCourseId(userId, courseId)
            .filter(item -> item.getStatus() != EnrollmentStatus.CANCELLED).isEmpty()) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }
    }

    private void ensureEnrolledForUpdate(Long userId, Long courseId) {
        if (enrollments.findForUpdateByUserIdAndCourseId(userId, courseId)
            .filter(item -> item.getStatus() != EnrollmentStatus.CANCELLED).isEmpty()) {
            throw new AppException(ErrorCode.FORBIDDEN);
        }
    }

    private boolean expired(QuizAttempt attempt, Quiz quiz, Instant now) {
        return quiz.getTimeLimitMinutes() != null
            && now.isAfter(attempt.getStartedAt().plusSeconds(quiz.getTimeLimitMinutes() * 60L));
    }

    private void validateDefinition(QuizDefinitionRequest request) {
        for (QuizDefinitionRequest.Question question : request.questions()) {
            if (question.questionType() == QuestionType.TEXT || question.options().size() < 2) {
                throw new AppException(ErrorCode.BAD_REQUEST);
            }
            long correct = question.options().stream().filter(option -> option.correct()).count();
            if (correct == 0 || (question.questionType() == QuestionType.SINGLE_CHOICE && correct != 1)) {
                throw new AppException(ErrorCode.BAD_REQUEST);
            }
        }
    }

    private void applyDefinition(Quiz quiz, QuizDefinitionRequest request) {
        quiz.setCourseId(request.courseId());
        quiz.setLessonId(request.lessonId());
        quiz.setTitle(request.title().trim());
        quiz.setDescription(request.description());
        quiz.setPassingScore(request.passingScore());
        quiz.setTimeLimitMinutes(request.timeLimitMinutes());
        int questionPosition = 1;
        for (QuizDefinitionRequest.Question input : request.questions()) {
            QuizQuestion question = new QuizQuestion();
            question.setQuiz(quiz);
            question.setQuestionText(input.questionText().trim());
            question.setQuestionType(input.questionType());
            question.setPoints(input.points());
            question.setPosition(questionPosition++);
            int optionPosition = 1;
            for (QuizDefinitionRequest.Option choice : input.options()) {
                QuizOption option = new QuizOption();
                option.setQuestion(question);
                option.setOptionText(choice.optionText().trim());
                option.setCorrect(choice.correct());
                option.setPosition(optionPosition++);
                question.getOptions().add(option);
            }
            quiz.getQuestions().add(question);
        }
    }
}
